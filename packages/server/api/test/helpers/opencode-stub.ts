import http from 'node:http'
import { AddressInfo } from 'node:net'

export async function startOpencodeStub(): Promise<OpencodeStub> {
    const state: OpencodeStubState = {
        namespaces: [{ id: 'opencode', name: 'OpenCode', folder: '/root/opencode-home/opencode' }],
        projects: [],
        agents: [],
        permissions: {},
        prompts: {},
        records: {},
        calls: [],
        nextProjectId: 1,
    }
    const server = http.createServer((req, res) => {
        readBody({ req }).then((body) => {
            const url = new URL(req.url ?? '/', 'http://stub')
            state.calls.push({ method: req.method ?? '', path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body })
            route({ state, method: req.method ?? '', url, body, res })
        }).catch(() => res.destroy())
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${portOf({ address: server.address() })}`,
        state,
        callsTo: ({ method, path }) => state.calls.filter((call) => call.method === method && call.path === path),
        close: async () => {
            server.closeAllConnections()
            await new Promise<void>((resolve) => server.close(() => resolve()))
        },
    }
}

function route({ state, method, url, body, res }: RouteParams): void {
    const json = parseJson({ body })
    const directory = url.searchParams.get('directory') ?? ''
    const key = `${method} ${url.pathname}`
    if (key === 'GET /global/health') {
        return send({ res, value: { healthy: true, version: 'stub-1.0.0' } })
    }
    if (key === 'GET /operator/namespaces') {
        return send({ res, value: state.namespaces.map((namespace) => summaryOf({ state, namespace })) })
    }
    if (key === 'POST /operator/namespaces') {
        const id = String(json['name'] ?? '').toLowerCase()
        const created = { id, name: String(json['name']), folder: `/root/opencode-home/${id}` }
        state.namespaces.push(created)
        return send({ res, value: { ...created, purpose: json['purpose'] ?? '', createdAt: 1, updatedAt: 1 } })
    }
    if (key === 'GET /operator/project-settings') {
        return send({ res, value: state.projects })
    }
    if (key === 'GET /operator/project-settings/resolve') {
        const project = state.projects.find((candidate) => directory === candidate.key || directory.startsWith(`${candidate.key}/`))
        return send({ res, value: { directory, ...(project === undefined ? {} : { project: { key: project.key, git: true } }) } })
    }
    if (key === 'POST /operator/project-settings/register') {
        const folder = String(json['directory'])
        if (state.projects.some((project) => project.key === folder)) {
            return send({ res, status: 400, value: { name: 'OperatorProfileInvalidError', data: { message: `${folder} is already part of the project ${folder}` } } })
        }
        const project = { key: folder, id: `p${String(state.nextProjectId++).padStart(4, '0')}`, name: folder.split('/').pop() ?? folder, namespace: String(json['namespace']), git: json['git'] === true }
        state.projects.push(project)
        return send({ res, value: { project } })
    }
    if (key === 'GET /operator/folder') {
        return send({ res, status: 400, value: { name: 'OperatorFolderInvalidError', data: { message: `${url.searchParams.get('path')} does not exist` } } })
    }
    if (key === 'PUT /operator/project-records') {
        state.records[String(json['key'])] = { description: String(json['description'] ?? '') }
        return send({ res, value: { key: json['key'], description: json['description'], status: 'active', members: [], groups: [] } })
    }
    if (key === 'GET /operator/agent') {
        return send({ res, value: state.agents.filter((agent) => agent.directory === directory).map((agent) => ({ name: agent.name, mode: agent.mode })) })
    }
    if (key === 'POST /operator/agent') {
        const name = String(json['name'])
        if (state.agents.some((agent) => agent.directory === directory && agent.name === name)) {
            return send({ res, status: 409, value: { name: 'OperatorAgentConflictError', data: { message: `An agent named "${name}" already exists` } } })
        }
        state.agents.push({ directory, name, mode: String(json['mode']), scope: url.searchParams.get('scope') ?? '' })
        return send({ res, value: { path: `${directory}/.opencode/agents/${name}.md` } })
    }
    const permissions = url.pathname.match(/^\/operator\/agent\/([^/]+)\/permissions$/)
    if (method === 'PUT' && permissions !== null) {
        state.permissions[`${directory}#${permissions[1]}`] = json['rules']
        return send({ res, value: { path: `${directory}/.opencode/agents/${permissions[1]}.md` } })
    }
    const prompt = url.pathname.match(/^\/operator\/agent-prompt\/([^/]+)$/)
    if (method === 'GET' && prompt !== null) {
        return send({ res, value: { setting: {}, namespace: { id: 'iphi-flow', name: 'iphi-flow' }, profile: { id: 'profile.opencode', name: 'OpenCode', source: 'builtin' }, default: { id: 'profile.opencode', name: 'OpenCode' } } })
    }
    if (method === 'PUT' && prompt !== null) {
        state.prompts[`${directory}#${prompt[1]}`] = { profile: json['profile'], override: json['override'] }
        return send({ res, value: { profile: json['profile'], override: json['override'] } })
    }
    return send({ res, status: 404, value: { name: 'NotFound', data: { message: `${key} is not stubbed` } } })
}

function summaryOf({ state, namespace }: { state: OpencodeStubState, namespace: StubNamespace }): Record<string, unknown> {
    return {
        namespace: { id: namespace.id, name: namespace.name, purpose: '', folder: namespace.folder, createdAt: 1, updatedAt: 1 },
        target: namespace.folder,
        inPlace: true,
        global: false,
        configFile: `${namespace.folder}/.opencode/opencode.jsonc`,
        projects: state.projects.filter((project) => project.namespace === namespace.id).map((project) => project.key),
    }
}

function send({ res, status = 200, value }: { res: http.ServerResponse, status?: number, value: unknown }): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(value))
}

function parseJson({ body }: { body: string }): Record<string, unknown> {
    if (body.length === 0) {
        return {}
    }
    const value: unknown = JSON.parse(body)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}
}

function readBody({ req }: { req: http.IncomingMessage }): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function portOf({ address }: { address: string | AddressInfo | null }): number {
    if (address === null || typeof address === 'string') {
        throw new Error('the OpenCode stub has no TCP address')
    }
    return address.port
}

type RouteParams = {
    state: OpencodeStubState
    method: string
    url: URL
    body: string
    res: http.ServerResponse
}

type StubNamespace = {
    id: string
    name: string
    folder: string
}

type StubProject = {
    key: string
    id: string
    name: string
    namespace: string
    git: boolean
}

type StubAgent = {
    directory: string
    name: string
    mode: string
    scope: string
}

type StubCall = {
    method: string
    path: string
    query: Record<string, string>
    headers: http.IncomingHttpHeaders
    body: string
}

export type OpencodeStubState = {
    namespaces: StubNamespace[]
    projects: StubProject[]
    agents: StubAgent[]
    permissions: Record<string, unknown>
    prompts: Record<string, unknown>
    records: Record<string, { description: string }>
    calls: StubCall[]
    nextProjectId: number
}

export type OpencodeStub = {
    url: string
    state: OpencodeStubState
    callsTo: (params: { method: string, path: string }) => StubCall[]
    close: () => Promise<void>
}
