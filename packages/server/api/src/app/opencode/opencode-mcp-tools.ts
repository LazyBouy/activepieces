import { isNil, tryCatch } from '@activepieces/core-utils'
import { PiecePropertyMap, PropertyType } from '@activepieces/pieces-framework'
import { AgentFlowTool, AgentPieceTool, AgentTool, AgentToolType, FieldControlMode, FlowTriggerType, MCP_TRIGGER_PIECE_NAME, McpToolResult, PopulatedFlow, PredefinedInputsStructure } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { flowService } from '../flows/flow/flow.service'
import { extractMcpTriggerInput, resolveRunnableFlow, runFlowAsTool } from '../mcp/mcp-server-builder'
import { mcpToolInput } from '../mcp/mcp-tool-input'
import { executePieceActionRun } from '../mcp/tools/flow-run-utils'
import { mcpUtils } from '../mcp/tools/mcp-utils'
import { pieceMetadataService } from '../pieces/metadata/piece-metadata-service'
import { opencodeMcpNames } from './opencode-mcp-names'
import { opencodeToolGuards } from './opencode-tool-guards'

export const opencodeMcpTools = (log: FastifyBaseLogger) => ({
    async build({ stepId, projectId, platformId, tools, withSchemas }: BuildParams): Promise<OpencodeMcpTool[]> {
        const built = await Promise.all(opencodeMcpNames.bridgedTools({ tools }).map((tool) => tool.type === AgentToolType.PIECE
            ? pieceTool({ stepId, projectId, platformId, tool, withSchemas, log })
            : tool.type === AgentToolType.FLOW
                ? flowTool({ stepId, projectId, tool, log })
                : Promise.resolve(null)))
        return built.filter((tool): tool is OpencodeMcpTool => !isNil(tool))
    },
})

async function pieceTool({ stepId, projectId, platformId, tool, withSchemas, log }: PieceToolParams): Promise<OpencodeMcpTool | null> {
    const { pieceName, pieceVersion, actionName, predefinedInput } = tool.pieceMetadata
    const piece = await pieceMetadataService(log).get({ name: pieceName, version: pieceVersion, projectId, platformId })
    const action = piece?.actions[actionName]
    if (isNil(piece) || isNil(action)) {
        log.warn({ piece: { name: pieceName, version: pieceVersion }, opencodeStep: { id: stepId } }, '[opencodeMcpTools] An agent tool names a piece action that is not installed')
        return null
    }
    const key = opencodeMcpNames.toolKey({ toolName: tool.toolName })
    const pinned = opencodeToolGuards.pinnedFields({ predefined: predefinedInput })
    const modelProps = Object.fromEntries(Object.entries(action.props).filter(([name]) => !pinned.has(name)))
    const resolved = withSchemas
        ? await resolveOptions({ pieceName: piece.name, pieceVersion: piece.version, actionName, props: modelProps, predefined: predefinedInput, projectId, platformId, log })
        : {}
    return {
        key,
        description: [`${piece.displayName}: ${action.displayName}.`, action.description].filter((part) => !isNil(part) && part.length > 0).join(' '),
        inputSchema: withSchemas ? z.object(propertyShape({ props: modelProps, resolved })) : z.looseObject({}),
        run: async (args) => {
            const input = opencodeToolGuards.neutralize(opencodeToolGuards.applyPins({ modelInput: args, predefined: predefinedInput }))
            const refusal = opencodeToolGuards.absoluteUrlRefusal({ actionName, input: asRecord(input) })
            if (!isNil(refusal)) {
                return refused({ text: refusal })
            }
            log.info({ opencodeStep: { id: stepId }, tool: { name: key, phase: 'call', input } }, '[opencodeMcpTools] Running an agent tool')
            return executePieceActionRun({
                projectId,
                pieceName: piece.name,
                pieceVersion: piece.version,
                actionName,
                input: asRecord(input),
                ...(isNil(predefinedInput?.auth) ? {} : { connectionExternalId: predefinedInput.auth }),
                log,
            })
        },
    }
}

async function flowTool({ stepId, projectId, tool, log }: FlowToolParams): Promise<OpencodeMcpTool | null> {
    const page = await flowService(log).list({ projectIds: [projectId], externalIds: [tool.externalFlowId], cursorRequest: null, limit: 1 })
    const listed = page.data[0]
    if (isNil(listed) || !isToolFlow({ flow: listed })) {
        log.warn({ flow: { id: listed?.id }, opencodeStep: { id: stepId } }, '[opencodeMcpTools] An agent tool names a flow that cannot run as a tool')
        return null
    }
    const flow = await resolveRunnableFlow({ flow: listed, projectId, log })
    const { toolDescription, mcpInputs, returnsResponse } = extractMcpTriggerInput(flow)
    const key = opencodeMcpNames.toolKey({ toolName: tool.toolName })
    return {
        key,
        description: toolDescription.length > 0 ? toolDescription : `Runs the flow "${flow.version.displayName}".`,
        inputSchema: z.object(mcpToolInput.modelInputShape({ properties: mcpInputs })),
        run: async (args) => {
            const payload = asRecord(opencodeToolGuards.neutralize(args))
            log.info({ opencodeStep: { id: stepId }, tool: { name: key, phase: 'call', input: payload } }, '[opencodeMcpTools] Running an agent flow tool')
            return runFlowAsTool({ flow, properties: mcpInputs, payload, returnsResponse, log })
        },
    }
}

async function resolveOptions({ pieceName, pieceVersion, actionName, props, predefined, projectId, platformId, log }: ResolveOptionsParams): Promise<Record<string, ResolvedProperty>> {
    const authorValues = Object.fromEntries(Object.entries(predefined?.fields ?? {})
        .filter(([, field]) => field.mode === FieldControlMode.CHOOSE_YOURSELF)
        .map(([name, field]) => [name, field.value]))
    const resolvable = Object.entries(props).filter(([, prop]) => RESOLVABLE_TYPES.includes(prop.type)
        && refreshersOf({ prop }).every((refresher) => refresher === opencodeToolGuards.AUTH_FIELD ? !isNil(predefined?.auth) : refresher in authorValues))
    const results = await Promise.all(resolvable.map(async ([name]) => {
        const { data } = await tryCatch(() => mcpUtils.executePropertyResolution({
            pieceName,
            pieceVersion,
            actionOrTriggerName: actionName,
            propertyName: name,
            input: authorValues,
            projectId,
            platformId,
            log,
            ...(isNil(predefined?.auth) ? {} : { auth: predefined.auth }),
        }))
        return [name, data] as const
    }))
    return Object.fromEntries(results.flatMap(([name, data]): [string, ResolvedProperty][] => {
        if (data?.status === 'options' && data.options.length > 0 && data.options.length <= MAX_RESOLVED_OPTIONS) {
            return [[name, { kind: 'options', options: data.options }]]
        }
        if (data?.status === 'dynamic') {
            return [[name, { kind: 'dynamic', props: data.props }]]
        }
        return []
    }))
}

function propertyShape({ props, resolved }: { props: PiecePropertyMap, resolved: Record<string, ResolvedProperty> }): Record<string, z.ZodType> {
    return Object.fromEntries(Object.entries(props).flatMap(([name, prop]) => {
        const schema = schemaOf({ prop, resolved: resolved[name] })
        if (isNil(schema)) {
            return []
        }
        const description = [prop.displayName, prop.description].filter((part) => !isNil(part) && part.length > 0).join(': ')
        const described = description.length > 0 ? schema.describe(description) : schema
        return [[name, prop.required ? described : described.optional()]]
    }))
}

function schemaOf({ prop, resolved }: { prop: PiecePropertyMap[string], resolved: ResolvedProperty | undefined }): z.ZodType | null {
    switch (prop.type) {
        case PropertyType.SHORT_TEXT:
        case PropertyType.LONG_TEXT:
        case PropertyType.RICH_TEXT:
        case PropertyType.DATE_TIME:
        case PropertyType.COLOR:
            return z.string()
        case PropertyType.FILE:
            return z.string().describe('A public URL of the file, or its content as base64')
        case PropertyType.NUMBER:
            return z.number()
        case PropertyType.CHECKBOX:
            return z.boolean()
        case PropertyType.STATIC_DROPDOWN:
            return optionsSchema({ options: prop.options.options })
        case PropertyType.STATIC_MULTI_SELECT_DROPDOWN:
            return z.array(optionsSchema({ options: prop.options.options }))
        case PropertyType.DROPDOWN:
            return resolved?.kind === 'options' ? optionsSchema({ options: resolved.options }) : z.string().describe(UNRESOLVED_OPTION)
        case PropertyType.MULTI_SELECT_DROPDOWN:
            return z.array(resolved?.kind === 'options' ? optionsSchema({ options: resolved.options }) : z.string().describe(UNRESOLVED_OPTION))
        case PropertyType.ARRAY:
            return isNil(prop.properties) ? z.array(z.unknown()) : z.array(z.object(propertyShape({ props: prop.properties, resolved: {} })))
        case PropertyType.DYNAMIC:
            return resolved?.kind === 'dynamic' ? z.object(propertyShape({ props: resolved.props, resolved: {} })) : z.record(z.string(), z.unknown())
        case PropertyType.OBJECT:
        case PropertyType.DATE_RANGE:
            return z.record(z.string(), z.unknown())
        case PropertyType.JSON:
            return z.unknown()
        default:
            return null
    }
}

function optionsSchema({ options }: { options: { label: string, value: unknown }[] }): z.ZodType {
    const values = options.map((option) => option.value)
    const labelled = options.filter((option) => String(option.value) !== option.label)
    const note = labelled.length === 0 ? undefined : `Options: ${labelled.map((option) => `${option.label} = ${JSON.stringify(option.value)}`).join('; ')}`
    const schema = values.every((value): value is string => typeof value === 'string') && values.length > 0
        ? z.enum(values)
        : z.unknown()
    return isNil(note) ? schema : schema.describe(note)
}

function isToolFlow({ flow }: { flow: PopulatedFlow }): boolean {
    return flow.version.trigger.type === FlowTriggerType.PIECE && flow.version.trigger.settings.pieceName === MCP_TRIGGER_PIECE_NAME
}

function refreshersOf({ prop }: { prop: PiecePropertyMap[string] }): string[] {
    return 'refreshers' in prop && Array.isArray(prop.refreshers) ? prop.refreshers : []
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}
}

function refused({ text }: { text: string }): McpToolResult {
    return { content: [{ type: 'text', text }], isError: true }
}

const RESOLVABLE_TYPES: PropertyType[] = [PropertyType.DROPDOWN, PropertyType.MULTI_SELECT_DROPDOWN, PropertyType.DYNAMIC]

const MAX_RESOLVED_OPTIONS = 200

const UNRESOLVED_OPTION = 'The value (ID) of the option, not its label'

export type OpencodeMcpTool = {
    key: string
    description: string
    inputSchema: z.ZodObject
    run: (args: Record<string, unknown>) => Promise<McpToolResult>
}

type ResolvedProperty =
    | { kind: 'options', options: { label: string, value: unknown }[] }
    | { kind: 'dynamic', props: PiecePropertyMap }

type BuildParams = {
    stepId: string
    projectId: string
    platformId: string
    tools: AgentTool[]
    withSchemas: boolean
}

type PieceToolParams = {
    stepId: string
    projectId: string
    platformId: string
    tool: AgentPieceTool
    withSchemas: boolean
    log: FastifyBaseLogger
}

type FlowToolParams = {
    stepId: string
    projectId: string
    tool: AgentFlowTool
    log: FastifyBaseLogger
}

type ResolveOptionsParams = {
    pieceName: string
    pieceVersion: string
    actionName: string
    props: PiecePropertyMap
    predefined: PredefinedInputsStructure | undefined
    projectId: string
    platformId: string
    log: FastifyBaseLogger
}
