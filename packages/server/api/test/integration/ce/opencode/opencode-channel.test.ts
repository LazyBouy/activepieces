import { AIProviderName, AiStepAction, apId } from '@activepieces/core-utils'
import { FlowRunStatus } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeChannels } from '../../../../src/app/opencode/opencode-channels'
import { opencodeCompletion } from '../../../../src/app/opencode/opencode-completion'
import { opencodeMcpNames } from '../../../../src/app/opencode/opencode-mcp-names'
import { db } from '../../../helpers/db'
import { opencodeStepFixtures, OpencodeStepSpec, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, seedNamespace, idleEvent, waitFor } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

beforeAll(async () => {
    stub = await startOpencodeStub()
    process.env.AP_OPENCODE_URL = stub.url
    app = await setupTestEnvironment()
})

afterAll(async () => {
    delete process.env.AP_OPENCODE_URL
    await teardownTestEnvironment()
    await stub.close()
})

describe('Agent channel with a finish rule', () => {
    it('gives each participant a run-scoped session, ping lines and inbox rule, kicks off, ends on finish_channel and cleans up', async () => {
        const setup = await channelFlow({ steps: [channelStep({ name: 'step_1' })] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        const response = await pieceStep({ setup, waitpointId, request: finishRule({ startWith: WRITER, doneBy: CRITIC, kickoff: 'Write a haiku about autumn and get it approved' }) })

        expect(response.json()).toEqual({ requestId: expect.any(String) })
        const step = await stepRow({ waitpointId })
        expect(step).toMatchObject({ status: 'DISPATCHED', action: 'OPENCODE_AGENT_CHANNEL', namespace: 'crew' })
        const channel = await channelOfStep({ stepId: step.id })
        expect(channel).toMatchObject({ status: 'OPEN', mode: 'FINISH_RULE', namespace: 'crew', stepName: 'step_1', flowRunId: setup.run.id })
        expect(channel.correlationId).toBe(`iphiflow_ch_${channel.id}`)
        const [writer, critic] = channel.participants
        expect(writer).toMatchObject({ key: WRITER, directory: WRITER_FOLDER, agent: 'writer', starts: true })
        expect(critic).toMatchObject({ key: CRITIC, directory: CRITIC_FOLDER, agent: 'critic', starts: false })

        const writerSession = sessionOf({ id: writer.sessionId })
        const criticSession = sessionOf({ id: critic.sessionId })
        expect(writerSession).toMatchObject({ directory: WRITER_FOLDER, agent: 'writer', metadata: { source: 'iphi-flow', flowRunId: setup.run.id, stepName: 'step_1', channel: channel.correlationId } })
        expect(writerSession.permission).toEqual([opencodeMcpNames.denyAllLine(), ...closedPingLines(), { permission: 'ping', pattern: 'SEND(project/c0002/agent/critic)', action: 'allow' }])
        expect(criticSession.permission).toEqual([
            opencodeMcpNames.denyAllLine(),
            opencodeMcpNames.allowStepLine({ stepId: step.id }),
            ...closedPingLines(),
            { permission: 'ping', pattern: 'SEND(project/c0001/agent/writer)', action: 'allow' },
        ])
        expect([writerSession.correlationId, criticSession.correlationId]).toEqual([channel.correlationId, channel.correlationId])
        expect(stub.state.inboxRules['c0001']).toEqual([
            {
                id: `iphiflow-ch-${channel.id}-0`,
                name: 'iphi-flow channel step_1: to writer',
                enabled: true,
                match: { fromSession: [critic.sessionId], recipient: { type: 'agent', id: 'writer' } },
                action: { kind: 'forward', to: [{ type: 'session', id: writer.sessionId }] },
            },
            expect.objectContaining({ preset: 'replies' }),
        ])
        expect(stub.state.inboxRules['c0002']?.[0]).toMatchObject({
            id: `iphiflow-ch-${channel.id}-1`,
            match: { fromSession: [writer.sessionId], recipient: { type: 'agent', id: 'critic' } },
            action: { to: [{ type: 'session', id: critic.sessionId }] },
        })
        expect(writerSession.prompts).toHaveLength(1)
        expect(writerSession.prompts[0]).toMatchObject({ messageID: writer.messageId, agent: 'writer' })
        expect(writerSession.prompts[0]['noReply']).toBeUndefined()
        expect(textOf({ prompt: writerSession.prompts[0] })).toContain(`Correlation id: ${channel.correlationId}.`)
        expect(textOf({ prompt: writerSession.prompts[0] })).toContain('- critic in project c0002: target {"type":"project.agent","id":"c0002/critic"}')
        expect(textOf({ prompt: writerSession.prompts[0] })).toContain('critic in project c0002 ends the channel when the work is finished.')
        expect(textOf({ prompt: writerSession.prompts[0] })).toMatch(/Task:\nWrite a haiku about autumn and get it approved$/)
        expect(criticSession.prompts[0]).toMatchObject({ noReply: true, agent: 'critic' })
        expect(textOf({ prompt: criticSession.prompts[0] })).toMatch(/Task \(writer in project c0001 starts it; act on the messages that reach you\):\nWrite a haiku about autumn and get it approved$/)
        expect(textOf({ prompt: criticSession.prompts[0] })).toContain(`When the work is finished, call the tool iphiflow_${step.id}_finish_channel with the result. That ends the channel.`)
        expect(stub.state.mcpServers.filter((server) => server.name === `iphiflow_${step.id}`).map((server) => server.directory)).toEqual([CRITIC_FOLDER])

        stub.ping({ project: 'c0001', agent: 'writer', to: { type: 'project-agent', project: 'c0002', id: 'critic' }, text: 'Leaves drift and fall', correlationID: channel.correlationId })
        stub.ping({ project: 'c0002', agent: 'critic', to: { type: 'session', id: writer.sessionId ?? '' }, text: 'Approved', correlationID: channel.correlationId })
        stub.ping({ project: 'c0002', agent: 'critic', to: { type: 'agent', id: 'critic' }, text: 'not this channel', correlationID: 'iphiflow_ch_other' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: writer.sessionId }) })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'DISPATCHED' })

        const token = tokenOf({ stepId: step.id })
        const finished = await rpc({ token, body: { method: 'tools/call', params: { name: 'finish_channel', arguments: { result: '{"verdict":"approved"}' } } } })
        expect(callText({ message: finished })).toBe('The channel is finished and its result went to the flow. Stop here.')
        stub.answer({ sessionId: writer.sessionId, text: 'Here is the haiku' })
        stub.answer({ sessionId: critic.sessionId, text: 'Approved and finished' })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: critic.sessionId }) })

        expect(await resumedBody({ waitpointId })).toEqual({
            output: {
                correlationId: channel.correlationId,
                messages: [
                    { from: 'c0001.writer', to: 'c0002.critic', text: 'Leaves drift and fall', at: expect.any(String) },
                    { from: 'c0002.critic', to: 'c0001.writer', text: 'Approved', at: expect.any(String) },
                ],
                results: { 'c0001.writer': 'Here is the haiku', 'c0002.critic': 'Approved and finished' },
                finishedBy: 'done',
                result: { verdict: 'approved' },
            },
        })
        expect(await stepRow({ waitpointId })).toMatchObject({ status: 'COMPLETED' })
        expect(await channelOfStep({ stepId: step.id })).toMatchObject({ status: 'CLOSED', finishedBy: 'done', closedAt: expect.anything() })
        expect(writerSession.aborted).toBe(1)
        expect(criticSession.aborted).toBe(1)
        expect(writerSession.permission).toEqual([opencodeMcpNames.denyAllLine(), ...closedPingLines()])
        expect(criticSession.permission).toEqual([opencodeMcpNames.denyAllLine(), opencodeMcpNames.allowStepLine({ stepId: step.id }), ...closedPingLines()])
        expect([writerSession.correlationId, criticSession.correlationId]).toEqual([null, null])
        expect(stub.state.inboxRules['c0001']).toEqual([expect.objectContaining({ preset: 'replies' })])
        expect(stub.state.inboxRules['c0002']).toEqual([expect.objectContaining({ preset: 'replies' })])
        expect(stub.state.disconnected).toContain(`iphiflow_${step.id}`)
        const late = await rpc({ token, body: { method: 'tools/call', params: { name: 'finish_channel', arguments: { result: 'again' } } } })
        expect(late).toEqual({ message: 'This token does not belong to a running step.' })

        const views = await setup.ctx.get('/v1/opencode/channels', { projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })
        expect(views.statusCode).toBe(StatusCodes.OK)
        expect(views.json()).toEqual([expect.objectContaining({
            correlationId: channel.correlationId,
            status: 'CLOSED',
            finishedBy: 'done',
            participants: [
                expect.objectContaining({ key: WRITER, projectName: 'c0001', adminPanelUrl: `${stub.url}/${Buffer.from(WRITER_FOLDER).toString('base64url')}/session/${writer.sessionId}` }),
                expect.objectContaining({ key: CRITIC, projectName: 'c0002' }),
            ],
            messages: [
                expect.objectContaining({ from: 'c0001.writer', to: 'c0002.critic', text: 'Leaves drift and fall' }),
                expect.objectContaining({ from: 'c0002.critic', to: 'c0001.writer', text: 'Approved' }),
            ],
        })])
    })

    it('ends at Max messages, and at the timeout with no result', async () => {
        const setup = await channelFlow({ steps: [channelStep({ name: 'step_1' }), channelStep({ name: 'step_2' })] })
        const capped = await waitpointFor({ setup, stepName: 'step_1' })
        const slow = await waitpointFor({ setup, stepName: 'step_2' })
        await pieceStep({ setup, waitpointId: capped, request: finishRule({ maxMessages: 2 }) })
        await pieceStep({ setup, waitpointId: slow, request: finishRule({ timeoutMinutes: 1 }) })
        const cappedChannel = await channelOfStep({ stepId: (await stepRow({ waitpointId: capped })).id })
        const slowStep = await stepRow({ waitpointId: slow })
        const slowChannel = await channelOfStep({ stepId: slowStep.id })

        expect(sessionOf({ id: cappedChannel.participants[0].sessionId }).prompts[0]['noReply']).toBeUndefined()
        expect(sessionOf({ id: cappedChannel.participants[1].sessionId }).prompts[0]['noReply']).toBeUndefined()
        stub.ping({ project: 'c0001', agent: 'writer', to: { type: 'project-agent', project: 'c0002', id: 'critic' }, text: 'One', correlationID: cappedChannel.correlationId })
        stub.ping({ project: 'c0002', agent: 'critic', to: { type: 'project-agent', project: 'c0001', id: 'writer' }, text: 'Two', correlationID: cappedChannel.correlationId })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: cappedChannel.participants[1].sessionId }) })
        expect(await resumedBody({ waitpointId: capped })).toMatchObject({ output: { finishedBy: 'max messages', result: null, messages: [{ text: 'One' }, { text: 'Two' }] } })

        expect(await opencodeCompletion(app!.log).complete({ stepId: slowStep.id })).toEqual({ finished: false, nextStepId: null })
        await db.update('opencode_channel', slowChannel.id, { created: new Date(Date.now() - 2 * 60 * 1000).toISOString() })
        await opencodeCompletion(app!.log).complete({ stepId: slowStep.id })
        expect(await resumedBody({ waitpointId: slow })).toMatchObject({ output: { finishedBy: 'timeout', result: null, messages: [] } })
        expect(await channelOfStep({ stepId: slowStep.id })).toMatchObject({ status: 'CLOSED', finishedBy: 'timeout' })
    })

    it('refuses mixed namespaces, a repeated agent, a Done when that is not a participant, and fewer than two agents', async () => {
        const setup = await channelFlow({ steps: [channelStep({ name: 'step_1' }), channelStep({ name: 'step_2' }), channelStep({ name: 'step_3' })] })
        const mixed = await waitpointFor({ setup, stepName: 'step_1' })
        const twice = await waitpointFor({ setup, stepName: 'step_2' })
        const stranger = await waitpointFor({ setup, stepName: 'step_3' })

        await pieceStep({ setup, waitpointId: mixed, request: finishRule({ participants: [participant({ key: WRITER }), { namespace: 'iphi-flow', project: 'p0001', agent: 'flow' }] }) })
        await pieceStep({ setup, waitpointId: twice, request: finishRule({ participants: [participant({ key: WRITER }), participant({ key: WRITER })] }) })
        await pieceStep({ setup, waitpointId: stranger, request: finishRule({ doneBy: 'crew/c0009/nobody' }) })
        const tooFew = await pieceStep({ setup, request: { ...finishRule({}), participants: [participant({ key: WRITER })] } })

        expect(await resumedBody({ waitpointId: mixed })).toEqual({ failure: 'Agent channels can only connect agents in one OpenCode namespace for now.' })
        expect(await resumedBody({ waitpointId: twice })).toEqual({ failure: 'crew/c0001/writer is in the channel twice. Pick each agent once.' })
        expect(await resumedBody({ waitpointId: stranger })).toEqual({ failure: '"Done when" names crew/c0009/nobody, which is not a participant.' })
        expect(tooFew.statusCode).toBe(StatusCodes.BAD_REQUEST)
        expect(await db.findBy('opencode_channel', { flowRunId: setup.run.id })).toEqual([])
    })

    it('refuses a participant project outside the allowlist', async () => {
        const setup = await channelFlow({ steps: [channelStep({ name: 'step_1' })] })
        seedNamespace({ id: 'secret', projects: ['s0001', 's0002'] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })

        await pieceStep({ setup, waitpointId, request: finishRule({ participants: [{ namespace: 'secret', project: 's0001', agent: 'a' }, { namespace: 'secret', project: 's0002', agent: 'b' }] }) })

        expect(await resumedBody({ waitpointId })).toEqual({ failure: 'secret/s0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.' })
        expect(stub.state.sessions.some((session) => session.directory.startsWith('/root/opencode-home/secret/'))).toBe(false)
    })

    it('shows a participant\'s asks on the channel step and answers them in that participant\'s project', async () => {
        const setup = await channelFlow({ steps: [channelStep({ name: 'step_1' })] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await pieceStep({ setup, waitpointId, request: finishRule({}) })
        const step = await stepRow({ waitpointId })
        const critic = (await channelOfStep({ stepId: step.id })).participants[1]
        const permissionId = `per_${apId()}`
        const questionId = `que_${apId()}`

        await opencodeBridge(app!.log).handleEvent({
            platformId: setup.ctx.platform.id,
            event: { directory: CRITIC_FOLDER, payload: { type: 'permission.asked', properties: { id: permissionId, sessionID: critic.sessionId, permission: 'bash', patterns: ['ls'], metadata: {}, always: ['ls *'] } } },
        })
        await opencodeBridge(app!.log).handleEvent({
            platformId: setup.ctx.platform.id,
            event: { directory: CRITIC_FOLDER, payload: { type: 'question.asked', properties: { id: questionId, sessionID: critic.sessionId, questions: [{ question: 'Which form?', header: 'Form', options: [{ label: 'Haiku', description: 'Three lines' }, { label: 'Sonnet', description: 'Fourteen lines' }] }] } } },
        })

        const asks = await setup.ctx.get('/v1/opencode/asks', { projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })
        expect(asks.json()).toEqual([
            expect.objectContaining({ kind: 'QUESTION', stepName: 'step_1', agent: 'critic', status: 'OPEN' }),
            expect.objectContaining({
                kind: 'PERMISSION',
                stepName: 'step_1',
                agent: 'critic',
                status: 'OPEN',
                adminPanelUrl: `${stub.url}/${Buffer.from(CRITIC_FOLDER).toString('base64url')}/session/${critic.sessionId}`,
            }),
        ])
        const permission = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: permissionId }))
        const question = AskRow.parse(await db.findOneBy('opencode_ask', { requestId: questionId }))
        expect(permission).toMatchObject({ opencodeStepId: step.id, directory: CRITIC_FOLDER })

        const allowed = await setup.ctx.post(`/v1/opencode/asks/${permission.id}/answer`, { type: 'permission', decision: 'allow-session' })
        const replied = await setup.ctx.post(`/v1/opencode/asks/${question.id}/answer`, { type: 'question', answers: [['Haiku']] })

        expect(allowed.statusCode).toBe(StatusCodes.OK)
        expect(replied.statusCode).toBe(StatusCodes.OK)
        expect(stub.state.decisions.map((decision) => decision.requestId)).toContain(permissionId)
        expect(stub.callsTo({ method: 'POST', path: `/question/${questionId}/reply` })[0]?.query).toMatchObject({ directory: CRITIC_FOLDER })
    })
})

describe('Agent channel with Wait for None', () => {
    it('opens at once, lets later AI steps join by correlation id or by step, and closes when the run ends', async () => {
        const setup = await channelFlow({
            steps: [
                channelStep({ name: 'step_1' }),
                { name: 'step_2', pieceName: PIECE, actionName: 'run_agent' },
                { name: 'step_3', opencode: { namespace: 'crew', project: 'c0001', channel: 'step_1' } },
            ],
        })

        const opened = await pieceStep({ setup, stepName: 'step_1', request: { action: 'OPENCODE_AGENT_CHANNEL', participants: [participant({ key: WRITER }), participant({ key: CRITIC })], waitFor: 'OPEN' } })

        const output = OpenOutput.parse(opened.json()).output
        const channel = ChannelRow.parse(await db.findOneBy('opencode_channel', { correlationId: output.correlationId }))
        expect(channel).toMatchObject({ mode: 'OPEN', status: 'OPEN', stepName: 'step_1', opencodeStepId: null, finish: null })
        expect(output.participants).toEqual([
            { key: 'c0001.writer', namespace: 'crew', project: 'c0001', agent: 'writer', sessionId: channel.participants[0].sessionId, adminPanelUrl: `${stub.url}/${Buffer.from(WRITER_FOLDER).toString('base64url')}/session/${channel.participants[0].sessionId}` },
            expect.objectContaining({ key: 'c0002.critic', sessionId: channel.participants[1].sessionId }),
        ])
        expect(channel.participants.map((entry) => sessionOf({ id: entry.sessionId }).prompts.map((prompt) => prompt['noReply']))).toEqual([[true], [true]])
        expect(await db.findBy('opencode_step', { flowRunId: setup.run.id })).toEqual([])

        const joining = await waitpointFor({ setup, stepName: 'step_2' })
        await pieceStep({ setup, waitpointId: joining, request: { action: 'OPENCODE_RUN_AGENT', namespace: 'crew', project: 'c0001', agent: 'triage', prompt: 'Ask the critic about the draft', session: { kind: 'NEW' }, channel: output.correlationId } })
        const joiner = await stepRow({ waitpointId: joining })
        const joinerSession = sessionOf({ id: joiner.sessionId })
        const writerSession = channel.participants[0].sessionId
        const criticSession = channel.participants[1].sessionId
        expect(joinerSession.permission).toEqual([
            opencodeMcpNames.denyAllLine(),
            ...closedPingLines(),
            { permission: 'ping', pattern: `SEND(session/${writerSession})`, action: 'allow' },
            { permission: 'ping', pattern: 'SEND(project/c0002/agent/critic)', action: 'allow' },
        ])
        expect(sessionOf({ id: writerSession }).permission).toEqual([
            opencodeMcpNames.denyAllLine(),
            ...closedPingLines(),
            { permission: 'ping', pattern: 'SEND(project/c0002/agent/critic)', action: 'allow' },
            { permission: 'ping', pattern: `SEND(session/${joiner.sessionId})`, action: 'allow' },
        ])
        expect(sessionOf({ id: criticSession }).permission).toEqual([
            opencodeMcpNames.denyAllLine(),
            ...closedPingLines(),
            { permission: 'ping', pattern: 'SEND(project/c0001/agent/writer)', action: 'allow' },
            { permission: 'ping', pattern: 'SEND(project/c0001/agent/triage)', action: 'allow' },
        ])
        expect(joinerSession.correlationId).toBe(`iphiflow_jn_${channel.id}_${joiner.id}`)
        expect(sessionOf({ id: writerSession }).correlationId).toBe(channel.correlationId)
        expect(joinerSession.prompts.map((prompt) => prompt['noReply'])).toEqual([true, undefined])
        expect(textOf({ prompt: joinerSession.prompts[0] })).toContain(`putting iphiflow_jn_${channel.id}_${joiner.id} in correlationID`)
        expect(textOf({ prompt: joinerSession.prompts[0] })).toContain(`- writer in this project: target {"type":"session","id":"${channel.participants[0].sessionId}"}`)
        expect(textOf({ prompt: joinerSession.prompts[1] })).toContain('Ask the critic about the draft')
        expect(stub.state.inboxRules['c0002']?.[0]).toMatchObject({
            id: `iphiflow-jn-${channel.id}-${joiner.id}-1`,
            match: { fromSession: [joiner.sessionId], recipient: { type: 'agent', id: 'critic' } },
            action: { to: [{ type: 'session', id: criticSession }] },
        })
        expect(stub.state.inboxRules['c0001']?.[0]).toEqual({
            id: `iphiflow-jn-${channel.id}-${joiner.id}-r`,
            name: 'iphi-flow channel step_1: step step_2: answers',
            enabled: true,
            match: { fromSession: [criticSession], recipient: { type: 'agent', id: 'triage' } },
            action: { kind: 'forward', to: [{ type: 'session', id: joiner.sessionId }] },
        })

        const byStep = await waitpointFor({ setup, stepName: 'step_3' })
        await execute({ setup, waitpointId: byStep, body: { action: AiStepAction.ASK_AI, prompt: 'Summarise what the critic said' } })
        const stepJoiner = await stepRow({ waitpointId: byStep })
        expect(sessionOf({ id: stepJoiner.sessionId }).prompts[0]).toMatchObject({ noReply: true })
        const joined = ChannelRow.parse(await db.findOneBy('opencode_channel', { id: channel.id }))
        expect(joined.joins.map((entry) => entry.stepId)).toEqual([joiner.id, stepJoiner.id])

        stub.ping({ project: 'c0001', agent: 'triage', to: { type: 'project-agent', project: 'c0002', id: 'critic' }, text: 'Is the draft ready?', correlationID: `iphiflow_jn_${channel.id}_${joiner.id}` })
        const views = await setup.ctx.get('/v1/opencode/channels', { projectId: setup.ctx.project.id, flowRunId: setup.run.id, stepName: 'step_1' })
        expect(views.json()).toEqual([expect.objectContaining({ status: 'OPEN', messages: [expect.objectContaining({ from: 'c0001.triage', to: 'c0002.critic', text: 'Is the draft ready?' })] })])

        await db.update('flow_run', setup.run.id, { status: FlowRunStatus.SUCCEEDED })
        expect(await opencodeChannels(app!.log).closeEnded()).toBe(1)

        expect(ChannelRow.parse(await db.findOneBy('opencode_channel', { id: channel.id }))).toMatchObject({ status: 'CLOSED', finishedBy: 'run ended' })
        expect(stub.state.inboxRules['c0002']).toEqual([expect.objectContaining({ preset: 'replies' })])
        expect(stub.state.inboxRules['c0001']).toEqual([expect.objectContaining({ preset: 'replies' })])
        expect(sessionOf({ id: channel.participants[0].sessionId }).aborted).toBe(1)
        expect(joinerSession.aborted).toBe(0)
        expect(joinerSession.permission).toEqual([opencodeMcpNames.denyAllLine(), ...closedPingLines()])
        expect(sessionOf({ id: stepJoiner.sessionId }).permission).toEqual([opencodeMcpNames.denyAllLine(), ...closedPingLines()])
        expect([joinerSession.correlationId, sessionOf({ id: stepJoiner.sessionId }).correlationId, sessionOf({ id: writerSession }).correlationId]).toEqual([null, null, null])
    })

    it('answers to a joining step that runs as a participant\'s agent in its project are told apart by the correlation id', async () => {
        const setup = await channelFlow({ steps: [channelStep({ name: 'step_1' }), { name: 'step_2', pieceName: PIECE, actionName: 'run_agent' }] })
        const opened = await pieceStep({ setup, stepName: 'step_1', request: { action: 'OPENCODE_AGENT_CHANNEL', participants: [participant({ key: WRITER }), participant({ key: CRITIC })], waitFor: 'OPEN' } })
        const correlationId = OpenOutput.parse(opened.json()).output.correlationId
        const channel = ChannelRow.parse(await db.findOneBy('opencode_channel', { correlationId }))
        const joining = await waitpointFor({ setup, stepName: 'step_2' })

        await pieceStep({ setup, waitpointId: joining, request: { action: 'OPENCODE_RUN_AGENT', namespace: 'crew', project: 'c0001', agent: 'writer', prompt: 'Check in with the critic', session: { kind: 'NEW' }, channel: correlationId } })

        const joiner = await stepRow({ waitpointId: joining })
        expect(stub.state.inboxRules['c0001']?.map((rule) => RuleView.parse(rule).id)).toEqual([
            `iphiflow-jn-${channel.id}-${joiner.id}-r`,
            `iphiflow-ch-${channel.id}-0`,
            'replies',
        ])
        expect(stub.state.inboxRules['c0001']?.[0]).toMatchObject({
            match: { fromSession: [channel.participants[1].sessionId], recipient: { type: 'agent', id: 'writer' }, correlationPrefix: `iphiflow_jn_${channel.id}_${joiner.id}` },
            action: { to: [{ type: 'session', id: joiner.sessionId }] },
        })
    })

    it('fails a step that names a channel that is not open, or one in another namespace', async () => {
        const setup = await channelFlow({
            steps: [
                channelStep({ name: 'step_1' }),
                { name: 'step_2', pieceName: PIECE, actionName: 'run_agent' },
                { name: 'step_3', pieceName: PIECE, actionName: 'run_agent' },
            ],
        })
        const opened = await pieceStep({ setup, stepName: 'step_1', request: { action: 'OPENCODE_AGENT_CHANNEL', participants: [participant({ key: WRITER }), participant({ key: CRITIC })], waitFor: 'OPEN' } })
        const correlationId = OpenOutput.parse(opened.json()).output.correlationId
        const missing = await waitpointFor({ setup, stepName: 'step_2' })
        const elsewhere = await waitpointFor({ setup, stepName: 'step_3' })

        await pieceStep({ setup, waitpointId: missing, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'x', session: { kind: 'NEW' }, channel: 'iphiflow_ch_missing' } })
        await pieceStep({ setup, waitpointId: elsewhere, request: { action: 'OPENCODE_RUN_AGENT', prompt: 'x', session: { kind: 'NEW' }, channel: correlationId } })

        expect(await resumedBody({ waitpointId: missing })).toEqual({ failure: 'The agent channel iphiflow_ch_missing is not open in this run.' })
        expect(await resumedBody({ waitpointId: elsewhere })).toEqual({ failure: 'Agent channels can only connect agents in one OpenCode namespace for now.' })
    })
})

async function channelFlow({ steps }: { steps: OpencodeStepSpec[] }): Promise<RoutedSetup> {
    const setup = await routedFlow({ steps })
    seedNamespace({ id: 'crew', projects: ['c0001', 'c0002'] })
    await setup.ctx.post('/v1/opencode/connection', { allowlist: ['iphi-flow', 'crew'] })
    stub.state.inboxRules = {}
    return setup
}

function channelStep({ name }: { name: string }): OpencodeStepSpec {
    return { name, pieceName: PIECE, actionName: 'agent_channel' }
}

function finishRule({ participants, startWith, doneBy, kickoff = 'Write a haiku', maxMessages, timeoutMinutes }: FinishRuleParams): Record<string, unknown> {
    return {
        action: 'OPENCODE_AGENT_CHANNEL',
        participants: participants ?? [participant({ key: WRITER }), participant({ key: CRITIC })],
        waitFor: 'FINISH_RULE',
        kickoff,
        startWith: startWith ?? 'ALL',
        ...(doneBy === undefined ? {} : { doneBy }),
        ...(maxMessages === undefined ? {} : { maxMessages }),
        ...(timeoutMinutes === undefined ? {} : { timeoutMinutes }),
    }
}

function participant({ key }: { key: string }): { namespace: string, project: string, agent: string } {
    const [namespace, project, agent] = key.split('/')
    return { namespace, project, agent }
}

function closedPingLines(): { permission: string, pattern: string, action: string }[] {
    return ['SEND(*)', 'SEND(agent/*)', 'SEND(group/*)', 'SEND(inbox)', 'SEND(project/*)'].map((pattern) => ({ permission: 'ping', pattern, action: 'deny' }))
}

async function channelOfStep({ stepId }: { stepId: string }): Promise<ChannelRow> {
    await waitFor(async () => !(await db.findOneBy('opencode_channel', { opencodeStepId: stepId }) === null))
    return ChannelRow.parse(await db.findOneBy('opencode_channel', { opencodeStepId: stepId }))
}

function textOf({ prompt }: { prompt: Record<string, unknown> }): string {
    return PromptParts.parse(prompt).parts.map((part) => part.text).join('\n')
}

function tokenOf({ stepId }: { stepId: string }): string {
    const server = stub.state.mcpServers.find((candidate) => candidate.name === `iphiflow_${stepId}`)
    return ServerConfig.parse(server?.config).headers.Authorization.slice('Bearer '.length)
}

async function rpc({ token, body }: { token: string, body: { method: string, params: Record<string, unknown> } }): Promise<unknown> {
    const response = await app!.inject({
        method: 'POST',
        url: '/api/v1/opencode/mcp',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        payload: { jsonrpc: '2.0', id: apId(), ...body },
    })
    const dataLine = response.body.split('\n').find((line) => line.startsWith('data: '))
    return JSON.parse(dataLine ? dataLine.slice('data: '.length) : response.body)
}

function callText({ message }: { message: unknown }): string {
    return CallResult.parse(message).result.content.map((part) => part.text).join('\n')
}

async function pieceStep({ setup, waitpointId, stepName, request }: { setup: RoutedSetup, waitpointId?: string, stepName?: string, request: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/opencode/steps',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: {
            flowId: setup.flow.id,
            flowRunId: setup.run.id,
            ...(waitpointId === undefined ? {} : { waitpointId }),
            ...(stepName === undefined ? {} : { stepName }),
            request,
        },
    })
}

async function execute({ setup, waitpointId, body }: { setup: RoutedSetup, waitpointId: string, body: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/ai/execute',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowId: setup.flow.id, flowRunId: setup.run.id, provider: AIProviderName.ACTIVEPIECES, modelId: 'smart', waitpointId, ...body },
    })
}

const PIECE = '@iphi-flow/piece-opencode'

const WRITER = 'crew/c0001/writer'

const CRITIC = 'crew/c0002/critic'

const WRITER_FOLDER = '/root/opencode-home/crew/c0001'

const CRITIC_FOLDER = '/root/opencode-home/crew/c0002'

const ChannelRow = z.object({
    id: z.string(),
    correlationId: z.string(),
    participants: z.array(z.object({ key: z.string(), directory: z.string(), agent: z.string(), sessionId: z.string().nullable(), messageId: z.string(), starts: z.boolean() })),
    joins: z.array(z.object({ stepId: z.string() })),
}).passthrough()

const AskRow = z.object({ id: z.string() }).passthrough()

const RuleView = z.object({ id: z.string() }).passthrough()

const OpenOutput = z.object({
    output: z.object({
        correlationId: z.string(),
        participants: z.array(z.record(z.string(), z.unknown())),
    }),
})

const PromptParts = z.object({ parts: z.array(z.object({ text: z.string() })) })

const ServerConfig = z.object({ headers: z.object({ Authorization: z.string() }) })

const CallResult = z.object({ result: z.object({ content: z.array(z.object({ text: z.string() })) }) })

type ChannelRow = z.infer<typeof ChannelRow>

type FinishRuleParams = {
    participants?: { namespace: string, project: string, agent: string }[]
    startWith?: string
    doneBy?: string
    kickoff?: string
    maxMessages?: number
    timeoutMinutes?: number
}
