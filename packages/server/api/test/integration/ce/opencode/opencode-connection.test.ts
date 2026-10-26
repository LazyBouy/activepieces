import { DefaultProjectRole } from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { opencodeProvisioning } from '../../../../src/app/opencode/opencode-provisioning'
import { db } from '../../../helpers/db'
import { OpencodeStub, startOpencodeStub } from '../../../helpers/opencode-stub'
import { createMemberContext, createTestContext } from '../../../helpers/test-context'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let stub: OpencodeStub

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

describe('OpenCode connection', () => {
    it('creates the connection on first read from the environment, switched on because OpenCode answered', async () => {
        const ctx = await createTestContext(app!)

        const response = await ctx.get('/v1/opencode/connection')

        expect(response.statusCode).toBe(StatusCodes.OK)
        const body = response.json()
        expect(body).toMatchObject({
            serverUrl: stub.url,
            username: 'opencode',
            hasPassword: false,
            adminPanelUrl: stub.url,
            projectsFolder: null,
            enabled: true,
            askCapMinutes: 1440,
            allowlist: ['iphi-flow'],
            lastHealth: { healthy: true, version: 'stub-1.0.0' },
            emailNotices: false,
        })
        expect(typeof body.callbackUrl).toBe('string')
        expect(body).not.toHaveProperty('password')
    })

    it('starts switched off when OpenCode does not answer', async () => {
        process.env.AP_OPENCODE_URL = 'http://127.0.0.1:9'
        const ctx = await createTestContext(app!)

        const response = await ctx.get('/v1/opencode/connection')

        process.env.AP_OPENCODE_URL = stub.url
        expect(response.json()).toMatchObject({ enabled: false, lastHealth: { healthy: false } })
    })

    it('refuses platform members', async () => {
        const ctx = await createTestContext(app!)
        const member = await createMemberContext(app!, ctx, { projectRole: DefaultProjectRole.EDITOR })

        expect((await member.get('/v1/opencode/connection')).statusCode).toBe(StatusCodes.FORBIDDEN)
        expect((await member.post('/v1/opencode/connection', { enabled: false })).statusCode).toBe(StatusCodes.FORBIDDEN)
        expect((await member.post('/v1/opencode/connection/test')).statusCode).toBe(StatusCodes.FORBIDDEN)
        expect((await member.get('/v1/opencode/connection/catalog')).statusCode).toBe(StatusCodes.FORBIDDEN)
    })

    it('stores the password encrypted, never returns it, sends it as basic auth and clears it with null', async () => {
        const ctx = await createTestContext(app!)

        const updated = await ctx.post('/v1/opencode/connection', { password: 'top-secret', askCapMinutes: 60, allowlist: ['iphi-flow', 'work/ab12c'] })

        expect(updated.statusCode).toBe(StatusCodes.OK)
        expect(updated.json()).toMatchObject({ hasPassword: true, askCapMinutes: 60, allowlist: ['iphi-flow', 'work/ab12c'] })
        expect(updated.json()).not.toHaveProperty('password')
        const row = await db.findOneBy('opencode_connection', { platformId: ctx.platform.id })
        expect(JSON.stringify(row)).not.toContain('top-secret')

        const tested = await ctx.post('/v1/opencode/connection/test')

        expect(tested.json()).toMatchObject({ healthy: true, version: 'stub-1.0.0' })
        const healthCalls = stub.callsTo({ method: 'GET', path: '/global/health' })
        expect(healthCalls[healthCalls.length - 1].headers.authorization).toBe(`Basic ${Buffer.from('opencode:top-secret').toString('base64')}`)

        const cleared = await ctx.post('/v1/opencode/connection', { password: null })

        expect(cleared.json()).toMatchObject({ hasPassword: false })
    })

    it('rejects an allowlist entry that is not a namespace or namespace/project', async () => {
        const ctx = await createTestContext(app!)

        const response = await ctx.post('/v1/opencode/connection', { allowlist: ['bad entry'] })

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })

    it('lists namespaces with their projects for the allowlist editor', async () => {
        const ctx = await createTestContext(app!)
        stub.state.projects.push({ key: '/root/opencode-home/opencode/site', id: 'zz001', name: 'site', namespace: 'opencode', git: true })

        const response = await ctx.get('/v1/opencode/connection/catalog')

        expect(response.statusCode).toBe(StatusCodes.OK)
        expect(response.json().namespaces).toContainEqual({
            id: 'opencode',
            name: 'OpenCode',
            folder: '/root/opencode-home/opencode',
            projects: [{ id: 'zz001', name: 'site', folder: '/root/opencode-home/opencode/site' }],
        })
    })
})

describe('OpenCode provisioning', () => {
    it('creates the namespace, a git project in its folder and the flow agent once, then reuses them', async () => {
        const ctx = await createTestContext(app!)
        await ctx.get('/v1/opencode/connection')
        const provisioning = opencodeProvisioning(app!.log)
        const directory = `/root/opencode-home/iphi-flow/${ctx.project.id}`

        const first = await provisioning.ensureProject({ platformId: ctx.platform.id, projectId: ctx.project.id, projectName: ctx.project.displayName })
        provisioning.invalidate({ platformId: ctx.platform.id, projectId: ctx.project.id })
        const second = await provisioning.ensureProject({ platformId: ctx.platform.id, projectId: ctx.project.id, projectName: ctx.project.displayName })

        expect(first).toEqual({ namespace: 'iphi-flow', directory, opencodeProjectId: expect.any(String), agent: 'flow' })
        expect(second).toEqual(first)
        expect(stub.state.namespaces.filter((namespace) => namespace.id === 'iphi-flow')).toHaveLength(1)
        expect(stub.state.projects.filter((project) => project.key === directory)).toEqual([expect.objectContaining({ namespace: 'iphi-flow', git: true })])
        expect(stub.state.agents.filter((agent) => agent.directory === directory)).toEqual([{ directory, name: 'flow', mode: 'primary', scope: 'project' }])
        expect(stub.state.permissions[`${directory}#flow`]).toContainEqual({ permission: 'bash', pattern: '*', action: 'ask' })
        expect(stub.state.permissions[`${directory}#flow`]).toContainEqual({ permission: 'question', pattern: '*', action: 'deny' })
        expect(stub.state.prompts[`${directory}#flow`]).toMatchObject({
            profile: 'profile.opencode',
            override: { slots: { role: ['agent:activepieces-step'] }, layers: { 'activepieces-step': { type: 'role' } } },
        })
        expect(stub.state.records[directory].description).toContain(ctx.project.displayName)
        const link = await db.findOneBy('opencode_project_link', { projectId: ctx.project.id })
        expect(link).toMatchObject({ platformId: ctx.platform.id, namespace: 'iphi-flow', directory, opencodeProjectId: first.opencodeProjectId })
    })

    it('leaves an existing flow agent as it is', async () => {
        const ctx = await createTestContext(app!)
        await ctx.get('/v1/opencode/connection')
        const directory = `/root/opencode-home/iphi-flow/${ctx.project.id}`
        stub.state.agents.push({ directory, name: 'flow', mode: 'subagent', scope: 'project' })

        await opencodeProvisioning(app!.log).ensureProject({ platformId: ctx.platform.id, projectId: ctx.project.id, projectName: ctx.project.displayName })

        expect(stub.state.agents.filter((agent) => agent.directory === directory)).toEqual([{ directory, name: 'flow', mode: 'subagent', scope: 'project' }])
        expect(stub.state.permissions[`${directory}#flow`]).toBeUndefined()
    })

    it('puts projects in the configured projects folder', async () => {
        const ctx = await createTestContext(app!)
        await ctx.post('/v1/opencode/connection', { projectsFolder: '/root/projects/flows' })

        const project = await opencodeProvisioning(app!.log).ensureProject({ platformId: ctx.platform.id, projectId: ctx.project.id, projectName: ctx.project.displayName })

        expect(project.directory).toBe(`/root/projects/flows/${ctx.project.id}`)
    })

    it('reports a clear error when OpenCode refuses', async () => {
        const ctx = await createTestContext(app!)
        await ctx.get('/v1/opencode/connection')
        const directory = `/root/opencode-home/iphi-flow/${ctx.project.id}`
        stub.state.projects.push({ key: '/root/opencode-home/iphi-flow', id: 'outer', name: 'iphi-flow', namespace: 'iphi-flow', git: true })

        await expect(opencodeProvisioning(app!.log).ensureProject({ platformId: ctx.platform.id, projectId: ctx.project.id, projectName: ctx.project.displayName }))
            .rejects.toThrow(`Could not prepare the OpenCode project for this step: ${directory} is inside the OpenCode project /root/opencode-home/iphi-flow`)
        stub.state.projects = stub.state.projects.filter((project) => project.id !== 'outer')
    })
})
