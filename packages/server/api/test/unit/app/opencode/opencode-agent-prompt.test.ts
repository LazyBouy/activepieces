import { AgentOutputFieldType, AgentTaskStatus, ContentBlockType, ExecutionToolStatus, ToolCallStatus, ToolCallType } from '@activepieces/shared'
import { Part, ToolState } from '@opencode-ai/sdk/v2/client'
import { OPENCODE_RUN_AGENT, opencodeAgentPrompt, OpencodeAgentRequest } from '../../../../src/app/opencode/opencode-agent-prompt'
import { OpencodeReplyMessage } from '../../../../src/app/opencode/opencode-reply'
import { OpencodeStepRow } from '../../../../src/app/opencode/opencode-step.entity'

describe('opencodeAgentPrompt.build', () => {
    it('sends the instruction as visible text and asks for no output format when the step has no structured output', () => {
        expect(opencodeAgentPrompt.build({ request: REQUEST })).toEqual({ parts: [{ type: 'text', text: 'Tidy the repo' }] })
    })

    it('turns each output field into a required, provider-safe JSON schema property', () => {
        const built = opencodeAgentPrompt.build({
            request: {
                ...REQUEST,
                structuredOutput: [
                    { displayName: 'Files changed', type: AgentOutputFieldType.NUMBER },
                    { displayName: 'done?', description: 'Whether it finished', type: AgentOutputFieldType.BOOLEAN },
                    { displayName: 'note', type: AgentOutputFieldType.TEXT },
                ],
            },
        })

        expect(built.format).toEqual({
            type: 'json_schema',
            schema: {
                type: 'object',
                properties: {
                    Files_changed: { type: 'number', description: 'Files changed' },
                    done_: { type: 'boolean', description: 'Whether it finished' },
                    note: { type: 'string', description: 'note' },
                },
                required: ['Files_changed', 'done_', 'note'],
                additionalProperties: false,
            },
        })
    })
})

describe('opencodeAgentPrompt.answer', () => {
    it('fails with the OpenCode error', () => {
        const answer = opencodeAgentPrompt.answer({ ...ANSWER, reply: { structured: undefined, error: 'Context overflow' } })

        expect(answer).toEqual({ failure: 'OpenCode stopped with an error: Context overflow.' })
    })

    it('shows failed tool calls with their error, skips synthetic text, and gives no admin panel link before the session exists', () => {
        const answer = opencodeAgentPrompt.answer({
            ...ANSWER,
            step: { ...STEP, sessionId: null, directory: null },
            replies: [reply({ parts: [
                textPart({ text: 'hidden', synthetic: true }),
                textPart({ text: '  ' }),
                toolPart({ callID: 'call_9', tool: 'edit', state: { status: 'error', input: { filePath: 'a.ts' }, error: 'File not found', time: { start: 10, end: 20 } } }),
            ] })],
        })

        expect(answer.output).toMatchObject({
            status: AgentTaskStatus.COMPLETED,
            steps: [{
                type: ContentBlockType.TOOL_CALL,
                toolCallType: ToolCallType.UNKNOWN,
                toolName: 'edit',
                toolCallId: 'call_9',
                output: { status: ExecutionToolStatus.FAILED, output: null, resolvedInput: {}, errorMessage: 'File not found' },
                status: ToolCallStatus.COMPLETED,
                endTime: new Date(20).toISOString(),
            }],
            opencode: { sessionId: '', adminPanelUrl: null },
        })
    })
})

describe('opencodeAgentPrompt.progress', () => {
    it('marks the run in progress and dates a tool call that has not started from its message', () => {
        const progress = opencodeAgentPrompt.progress({
            request: REQUEST,
            stepId: STEP.id,
            replies: [reply({ created: 7_000, parts: [toolPart({ callID: 'call_1', tool: 'bash', state: { status: 'pending', input: {}, raw: '' } })] })],
        })

        expect(progress).toEqual({
            prompt: 'Tidy the repo',
            status: AgentTaskStatus.IN_PROGRESS,
            steps: [{
                type: ContentBlockType.TOOL_CALL,
                toolCallType: ToolCallType.UNKNOWN,
                toolName: 'bash',
                displayName: 'bash',
                toolCallId: 'call_1',
                input: {},
                status: ToolCallStatus.IN_PROGRESS,
                startTime: new Date(7_000).toISOString(),
            }],
        })
    })
})

function reply({ parts, created = 1_000 }: { parts: Part[], created?: number }): OpencodeReplyMessage {
    return {
        info: {
            id: 'msg_reply',
            sessionID: 'ses_1',
            role: 'assistant',
            time: { created },
            parentID: 'msg_user',
            modelID: 'm',
            providerID: 'p',
            mode: 'flow',
            agent: 'flow',
            path: { cwd: '/w', root: '/w' },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts,
    }
}

function textPart({ text, synthetic }: { text: string, synthetic?: boolean }): Part {
    return { id: 'prt_text', sessionID: 'ses_1', messageID: 'msg_reply', type: 'text', text, ...(synthetic === undefined ? {} : { synthetic }) }
}

function toolPart({ callID, tool, state }: { callID: string, tool: string, state: ToolState }): Part {
    return { id: `prt_${callID}`, sessionID: 'ses_1', messageID: 'msg_reply', type: 'tool', callID, tool, state }
}

const REQUEST: OpencodeAgentRequest = {
    action: OPENCODE_RUN_AGENT,
    instruction: 'Tidy the repo',
}

const STEP: OpencodeStepRow = {
    id: 'step_1',
    created: '2026-10-26T00:00:00.000Z',
    updated: '2026-10-26T00:00:00.000Z',
    platformId: 'platform_1',
    projectId: 'project_1',
    flowId: 'flow_1',
    flowRunId: 'run_1',
    flowVersionId: 'version_1',
    stepName: 'step_1',
    waitpointId: 'waitpoint_1',
    requestId: 'request_1',
    webserverId: null,
    action: OPENCODE_RUN_AGENT,
    request: null,
    sessionMode: 'NEW_PER_STEP',
    namespace: 'iphi-flow',
    opencodeProjectId: 'p0001',
    directory: '/root/opencode-home/iphi-flow/project_1',
    agent: 'flow',
    model: null,
    runSessionId: null,
    sessionId: 'ses_1',
    messageId: 'msg_user',
    status: 'DISPATCHED',
    failure: null,
    dispatchedAt: null,
    completedAt: null,
}

const ANSWER = {
    request: REQUEST,
    step: STEP,
    replies: [],
    reply: { structured: undefined },
    summary: { model: null, usage: { input: 0, output: 0, reasoning: 0, cost: 0 } },
    adminPanelUrl: 'http://127.0.0.1:4444/',
}
