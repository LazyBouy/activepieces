import { AIProviderName, AiStepAction } from '@activepieces/core-utils'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { databaseConnection } from '../../../../src/app/database/database-connection'
import { system } from '../../../../src/app/helper/system/system'
import { AppSystemProp } from '../../../../src/app/helper/system/system-props'
import { opencodeBridge } from '../../../../src/app/opencode/opencode-bridge'
import { opencodeConnectionService } from '../../../../src/app/opencode/opencode-connection.service'
import { opencodeFilesOut } from '../../../../src/app/opencode/opencode-files-out'
import { OpencodeStepEntity } from '../../../../src/app/opencode/opencode-step.entity'
import { db } from '../../../helpers/db'
import { opencodeStepFixtures, RoutedSetup } from '../../../helpers/opencode-steps'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub
const { routedFlow, waitpointFor, engineToken, stepRow, resumedBody, sessionOf, idleEvent } = opencodeStepFixtures({ app: () => app!, stub: () => stub })

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

describe('Files an OpenCode agent writes', () => {
    it('saves the files changed in the step\'s output folder and those its tools wrote, byte for byte, and lists the ones it skipped', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1', actionName: 'run_agent' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await runAgent({ setup, body: { waitpointId, instruction: 'Write the report' } })
        const step = await stepRow({ waitpointId })
        const directory = sessionOf({ id: step.sessionId }).directory
        const folder = `out/${step.id}`
        const maxMb = system.getNumberOrThrow(AppSystemProp.MAX_FILE_SIZE_MB)
        stub.state.diffs[step.messageId] = [
            { file: `${folder}/report.md`, status: 'added', additions: 2, deletions: 0 },
            { file: `${folder}/data/rows.csv`, status: 'added', additions: 2, deletions: 0 },
            { file: `${folder}/huge.bin`, status: 'added', additions: 0, deletions: 0 },
            { file: `${folder}/locked.txt`, status: 'added', additions: 1, deletions: 0 },
            { file: `${folder}/draft.txt`, status: 'deleted', additions: 0, deletions: 1 },
            { file: 'elsewhere/changed.txt', status: 'modified', additions: 1, deletions: 1 },
        ]
        stub.state.projectFiles[`${folder}/report.md`] = { content: '  Report\n\n', mime: 'text/markdown' }
        stub.state.projectFiles[`${folder}/data/rows.csv`] = { content: 'a,b\n1,2\n', mime: 'text/csv' }
        stub.state.projectFiles[`${folder}/huge.bin`] = { content: Buffer.alloc(maxMb * 1024 * 1024 + 1), mime: 'application/octet-stream' }
        stub.state.projectFiles[`${folder}/locked.txt`] = { content: 'secret', mime: 'text/plain', failWith: 500 }
        stub.state.projectFiles['notes/todo.md'] = { content: '- ship it\n', mime: 'text/markdown' }
        stub.state.projectFiles['src/app.ts'] = { content: 'export const app = 1\n', mime: 'text/x-typescript' }

        stub.answer({ sessionId: step.sessionId, parts: [
            toolPart({ callID: 'call_1', tool: 'write', input: { filePath: `${directory}/${folder}/report.md`, content: '  Report\n\n' } }),
            toolPart({ callID: 'call_2', tool: 'write', input: { filePath: `${directory}/notes/todo.md`, content: '- ship it\n' } }),
            toolPart({ callID: 'call_3', tool: 'edit', input: { filePath: '/etc/hosts', oldString: 'a', newString: 'b' } }),
            toolPart({ callID: 'call_4', tool: 'apply_patch', input: { patchText: '*** Begin Patch' }, metadata: { files: [
                { filePath: `${directory}/src/app.ts`, type: 'update' },
                { filePath: `${directory}/old.txt`, type: 'delete' },
            ] } }),
            toolPart({ callID: 'call_5', tool: 'write', input: { filePath: `${directory}/notes/gone.md`, content: 'x' } }),
            { id: 'prt_text', type: 'text', text: 'Done' },
        ] })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        const opencode = AgentOpencode.parse(await resumedBody({ waitpointId })).opencode
        expect(opencode.files).toEqual([
            { name: 'report.md', url: expect.stringContaining('/v1/files/'), size: 10 },
            { name: 'data/rows.csv', url: expect.stringContaining('/v1/files/'), size: 8 },
            { name: 'notes/todo.md', url: expect.stringContaining('/v1/files/'), size: 10 },
            { name: 'src/app.ts', url: expect.stringContaining('/v1/files/'), size: 21 },
        ])
        expect(opencode.skippedFiles).toEqual([
            { name: 'huge.bin', reason: `larger than ${maxMb} MB` },
            { name: 'locked.txt', reason: 'could not be read: EACCES: permission denied' },
            { name: 'notes/gone.md', reason: 'no longer exists' },
            { name: '/etc/hosts', reason: 'outside the project folder' },
        ])
        const reportUrl = new URL(opencode.files[0].url)
        const download = await app!.inject({ method: 'GET', url: `${reportUrl.pathname}${reportUrl.search}` })
        expect(download.body).toBe('  Report\n\n')
        expect(download.headers['content-type']).toContain('text/markdown')
        expect(await stepRow({ waitpointId })).toMatchObject({ files: { files: opencode.files, skippedFiles: opencode.skippedFiles } })
        expect(stub.callsTo({ method: 'GET', path: '/operator/file/raw' }).map((call) => call.query)).toContainEqual({
            directory,
            path: `${folder}/report.md`,
            maxBytes: String(maxMb * 1024 * 1024),
        })
    })

    it('keeps a direct step\'s prompt as it is, saves the files its tools wrote on the step, and never saves them twice', async () => {
        const setup = await routedFlow({ steps: [{ name: 'step_1' }] })
        const waitpointId = await waitpointFor({ setup, stepName: 'step_1' })
        await execute({ setup, waitpointId, body: { action: AiStepAction.ASK_AI, prompt: 'Write a haiku to haiku.txt' } })
        const step = await stepRow({ waitpointId })
        const session = sessionOf({ id: step.sessionId })
        stub.state.projectFiles['haiku.txt'] = { content: 'old pond\nfrog jumps in\nsplash\n', mime: 'text/plain' }

        stub.answer({ sessionId: step.sessionId, parts: [
            toolPart({ callID: 'call_1', tool: 'write', input: { filePath: `${session.directory}/haiku.txt`, content: 'old pond\nfrog jumps in\nsplash\n' } }),
            { id: 'prt_text', type: 'text', text: 'Written' },
        ] })
        await opencodeBridge(app!.log).handleEvent({ platformId: setup.ctx.platform.id, event: idleEvent({ sessionId: step.sessionId }) })

        expect(session.prompts[0]).toMatchObject({ parts: [{ type: 'text', text: 'Write a haiku to haiku.txt' }] })
        expect(await resumedBody({ waitpointId })).toEqual({ output: { answer: 'Written' } })
        const settled = await databaseConnection().getRepository(OpencodeStepEntity).findOneByOrFail({ waitpointId })
        expect(settled.files).toEqual({ files: [{ name: 'haiku.txt', url: expect.stringContaining('/v1/files/'), size: 30 }], skippedFiles: [] })
        const reads = stub.callsTo({ method: 'GET', path: '/operator/file/raw' }).length

        const again = await opencodeFilesOut(app!.log).ensure({
            step: settled,
            client: await opencodeConnectionService(app!.log).client({ platformId: setup.ctx.platform.id }),
            replies: [],
        })

        expect(again).toEqual(settled.files)
        expect(stub.callsTo({ method: 'GET', path: '/operator/file/raw' })).toHaveLength(reads)
        expect(await db.findOneBy('file', { projectId: setup.ctx.project.id, fileName: 'haiku.txt' })).toMatchObject({ metadata: { mimetype: 'text/plain' } })
    })
})

function toolPart({ callID, tool, input, metadata = {} }: { callID: string, tool: string, input: Record<string, unknown>, metadata?: Record<string, unknown> }): Record<string, unknown> {
    return { id: `prt_${callID}`, type: 'tool', callID, tool, state: { status: 'completed', input, output: 'ok', title: tool, metadata, time: { start: 1_000, end: 2_000 } } }
}

async function runAgent({ setup, body }: { setup: RoutedSetup, body: Record<string, unknown> }) {
    return app!.inject({
        method: 'POST',
        url: '/api/v1/agents/runs',
        headers: { authorization: `Bearer ${await engineToken({ setup })}` },
        body: { flowRunId: setup.run.id, ...body },
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

const FileEntry = z.object({ name: z.string(), url: z.string(), size: z.number() })

const StepFiles = z.object({ files: z.array(FileEntry), skippedFiles: z.array(z.object({ name: z.string(), reason: z.string() })) })

const AgentOpencode = z.object({ opencode: StepFiles })
