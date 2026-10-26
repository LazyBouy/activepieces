import { AgentTool, AgentToolType, FieldControlMode, McpAuthType, McpProtocol } from '@activepieces/shared'
import { opencodeMcpNames } from '../../../../src/app/opencode/opencode-mcp-names'
import { opencodeToolGuards } from '../../../../src/app/opencode/opencode-tool-guards'

describe('opencodeMcpNames', () => {
    it('keeps a short tool name and shortens a long one with a stable hash so the OpenCode tool id stays within 64 characters', () => {
        const long = 'send_a_very_long_message_to_the_whole_engineering_channel'
        const key = opencodeMcpNames.toolKey({ toolName: long })

        expect(opencodeMcpNames.toolKey({ toolName: 'slack_send' })).toBe('slack_send')
        expect(key).toHaveLength(33)
        expect(key).toBe(opencodeMcpNames.toolKey({ toolName: long }))
        expect(`${opencodeMcpNames.serverName({ stepId: STEP_ID })}_${key}`.length).toBeLessThanOrEqual(64)
    })

    it('finds the configured tool behind an OpenCode tool call, and nothing for another step\'s or a built-in tool', () => {
        expect(opencodeMcpNames.toolOfCall({ stepId: STEP_ID, callName: `iphiflow_${STEP_ID}_slack_send`, tools: TOOLS })).toBe(TOOLS[0])
        expect(opencodeMcpNames.toolOfCall({ stepId: STEP_ID, callName: `iphiflow_${STEP_ID}_m0_search`, tools: TOOLS })).toBe(TOOLS[1])
        expect(opencodeMcpNames.toolOfCall({ stepId: STEP_ID, callName: 'iphiflow_otherStep0000000001_slack_send', tools: TOOLS })).toBeUndefined()
        expect(opencodeMcpNames.toolOfCall({ stepId: STEP_ID, callName: 'bash', tools: TOOLS })).toBeUndefined()
    })

    it('denies every step\'s tools and allows this step\'s', () => {
        expect(opencodeMcpNames.denyAllLine()).toEqual({ permission: 'iphiflow_*', pattern: '*', action: 'deny' })
        expect(opencodeMcpNames.allowStepLine({ stepId: STEP_ID })).toEqual({ permission: `iphiflow_${STEP_ID}_*`, pattern: '*', action: 'allow' })
        expect(opencodeMcpNames.isBridgeLine({ permission: 'iphiflow_abc_*' })).toBe(true)
        expect(opencodeMcpNames.isBridgeLine({ permission: 'bash' })).toBe(false)
    })
})

describe('opencodeToolGuards', () => {
    it('breaks every template opening, nested and in runs of braces, and leaves other values alone', () => {
        expect(opencodeToolGuards.neutralize({ a: '{{x}}', b: ['{{{y}}}', 2], c: { d: 'plain {' }, e: true })).toEqual({
            a: '{​{x}}',
            b: ['{​{​{y}}}', 2],
            c: { d: 'plain {' },
            e: true,
        })
    })

    it('drops pinned fields and auth from the model\'s answer, then applies the author\'s values', () => {
        const input = opencodeToolGuards.applyPins({
            modelInput: { channel: 'C1', signature: 'mine', debug: true, auth: 'other-connection' },
            predefined: {
                auth: 'author-connection',
                fields: {
                    signature: { mode: FieldControlMode.CHOOSE_YOURSELF, value: 'the author' },
                    debug: { mode: FieldControlMode.LEAVE_EMPTY, value: null },
                    channel: { mode: FieldControlMode.AGENT_DECIDE, value: null },
                },
            },
        })

        expect(input).toEqual({ channel: 'C1', signature: 'the author' })
    })

    it('refuses an absolute URL only on a custom API call', () => {
        expect(opencodeToolGuards.absoluteUrlRefusal({ actionName: 'custom_api_call', input: { url: ' HTTPS://evil.example/x' } })).not.toBeNull()
        expect(opencodeToolGuards.absoluteUrlRefusal({ actionName: 'custom_api_call', input: { url: 'ftp://evil.example' } })).not.toBeNull()
        expect(opencodeToolGuards.absoluteUrlRefusal({ actionName: 'custom_api_call', input: { url: '/v1/me' } })).toBeNull()
        expect(opencodeToolGuards.absoluteUrlRefusal({ actionName: 'send_message', input: { url: 'https://example.com' } })).toBeNull()
    })
})

const STEP_ID = 'stepAbcdefghijklmnop1'

const TOOLS: AgentTool[] = [
    { type: AgentToolType.PIECE, toolName: 'slack_send', pieceMetadata: { pieceName: '@activepieces/piece-slack', pieceVersion: '0.1.0', actionName: 'send_message' } },
    { type: AgentToolType.MCP, toolName: 'docs', serverUrl: 'https://mcp.example.com/mcp', protocol: McpProtocol.STREAMABLE_HTTP, auth: { type: McpAuthType.NONE } },
]
