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
        sessions: [],
        providers: [],
        refusals: [],
        busy: [],
        nextSessionId: 1,
        eventClients: new Set(),
        mcpServers: [],
        mcpStatus: 'connected',
        disconnected: [],
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
        answer: (params) => answer({ state, ...params }),
        emit: (payload) => emit({ state, payload }),
        close: async () => {
            state.eventClients.forEach((client) => client.end())
            server.closeAllConnections()
            await new Promise<void>((resolve) => server.close(() => resolve()))
        },
    }
}

function answer({ state, sessionId, text = '', structured, error, finish = 'stop', parts, completed = true }: AnswerParams & { state: OpencodeStubState }): void {
    const session = state.sessions.find((candidate) => candidate.id === sessionId)
    if (session === undefined || sessionId === null) {
        throw new Error(`the stub has no session ${sessionId}`)
    }
    const prompt = [...session.messages].reverse().find((message) => message.info['role'] === 'user')
    if (prompt === undefined) {
        throw new Error(`session ${sessionId} has no prompt to answer`)
    }
    const replies = session.messages.filter((message) => message.info['parentID'] === prompt.info['id'])
    const id = `${String(prompt.info['id'])}_r${replies.length + 1}`
    session.messages.push({
        info: {
            id,
            sessionID: sessionId,
            role: 'assistant',
            parentID: prompt.info['id'],
            time: completed ? { created: Date.now(), completed: Date.now() } : { created: Date.now() },
            modelID: 'stub-model',
            providerID: 'stub',
            mode: 'flow',
            agent: session.agent ?? 'flow',
            path: { cwd: session.directory, root: session.directory },
            cost: 0.002,
            tokens: { input: 12, output: 5, reasoning: 1, cache: { read: 0, write: 0 } },
            finish,
            ...(structured === undefined ? {} : { structured }),
            ...(error === undefined ? {} : { error }),
        },
        parts: parts ?? [{ id: `${id}_p1`, sessionID: sessionId, messageID: id, type: 'text', text }],
    })
}

function emit({ state, payload }: { state: OpencodeStubState, payload: Record<string, unknown> }): void {
    const line = `data: ${JSON.stringify({ directory: '/stub', payload: { id: `evt_${Date.now()}`, ...payload } })}\n\n`
    state.eventClients.forEach((client) => client.write(line))
}

function routeSession({ state, method, url, json, directory, res }: SessionRouteParams): boolean {
    const key = `${method} ${url.pathname}`
    if (key === 'POST /session') {
        const refusal = state.refusals.shift()
        if (refusal !== undefined) {
            send({ res, status: refusal, value: { name: 'OperatorSessionGuardError', data: { message: `refused with ${refusal}` } } })
            return true
        }
        const created: StubSession = {
            id: `ses_${String(state.nextSessionId++).padStart(4, '0')}`,
            directory,
            title: typeof json['title'] === 'string' ? json['title'] : '',
            agent: typeof json['agent'] === 'string' ? json['agent'] : undefined,
            metadata: json['metadata'],
            permission: Array.isArray(json['permission']) ? json['permission'] : [],
            messages: [],
            prompts: [],
            aborted: 0,
        }
        state.sessions.push(created)
        send({ res, value: { id: created.id, title: created.title, directory, time: { created: Date.now(), updated: Date.now() } } })
        return true
    }
    if (key === 'GET /session/status') {
        send({ res, value: Object.fromEntries(state.busy.map((sessionId) => [sessionId, { type: 'busy' }])) })
        return true
    }
    if (key === 'GET /config/providers') {
        send({ res, value: {
            providers: state.providers.map((provider) => ({
                id: provider.id,
                name: provider.name,
                source: 'api',
                env: [],
                key: 'secret-key-never-shown',
                options: {},
                models: Object.fromEntries(provider.models.map((model) => [model.id, { id: model.id, name: model.name }])),
            })),
            default: {},
        } })
        return true
    }
    const match = url.pathname.match(/^\/session\/([^/]+)(\/.*)?$/)
    if (match === null) {
        return false
    }
    const session = state.sessions.find((candidate) => candidate.id === match[1])
    if (session === undefined) {
        send({ res, status: 404, value: { name: 'NotFoundError', data: { message: `Session not found: ${match[1]}` } } })
        return true
    }
    const rest = match[2] ?? ''
    if (method === 'GET' && rest === '') {
        send({ res, value: { id: session.id, title: session.title, directory: session.directory } })
        return true
    }
    if (method === 'DELETE' && rest === '') {
        state.sessions = state.sessions.filter((candidate) => candidate.id !== session.id)
        send({ res, value: true })
        return true
    }
    if (method === 'GET' && rest === '/message') {
        send({ res, value: session.messages })
        return true
    }
    const single = rest.match(/^\/message\/([^/]+)$/)
    if (method === 'GET' && single !== null) {
        const found = session.messages.find((message) => message.info['id'] === single[1])
        send({ res, status: found === undefined ? 404 : 200, value: found ?? { name: 'NotFoundError', data: { message: 'Message not found' } } })
        return true
    }
    if (method === 'POST' && rest === '/prompt_async') {
        session.prompts.push(json)
        session.messages.push({
            info: { id: json['messageID'], sessionID: session.id, role: 'user', agent: json['agent'], model: json['model'], format: json['format'], time: { created: Date.now() } },
            parts: Array.isArray(json['parts']) ? json['parts'] : [],
        })
        res.writeHead(204)
        res.end()
        return true
    }
    if (method === 'POST' && rest === '/abort') {
        session.aborted++
        send({ res, value: true })
        return true
    }
    return false
}

function route({ state, method, url, body, res }: RouteParams): void {
    const json = parseJson({ body })
    const directory = url.searchParams.get('directory') ?? ''
    const key = `${method} ${url.pathname}`
    if (key === 'GET /global/health') {
        return send({ res, value: { healthy: true, version: 'stub-1.0.0' } })
    }
    if (key === 'GET /global/event') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
        res.write(': connected\n\n')
        state.eventClients.add(res)
        res.on('close', () => state.eventClients.delete(res))
        return
    }
    if (routeSession({ state, method, url, json, directory, res })) {
        return
    }
    if (key === 'POST /mcp') {
        const name = String(json['name'])
        state.mcpServers.push({ name, directory, config: json['config'] })
        const status = state.mcpStatus === 'connected' ? { status: 'connected' } : { status: 'failed', error: state.mcpStatus }
        return send({ res, value: { [name]: status } })
    }
    const disconnect = url.pathname.match(/^\/mcp\/([^/]+)\/disconnect$/)
    if (method === 'POST' && disconnect !== null) {
        state.disconnected.push(decodeURIComponent(disconnect[1]))
        return send({ res, value: true })
    }
    const sessionPermissions = url.pathname.match(/^\/operator\/session\/([^/]+)\/permissions$/)
    if (sessionPermissions !== null) {
        const session = state.sessions.find((candidate) => candidate.id === sessionPermissions[1])
        if (session === undefined) {
            return send({ res, status: 404, value: { name: 'OperatorSessionPermissionsNotFoundError', data: { message: 'no such session' } } })
        }
        if (method === 'PUT') {
            session.permission = Array.isArray(json['rules']) ? json['rules'] : []
        }
        return send({ res, value: { sessionID: session.id, agent: session.agent ?? 'flow', parent: false, rows: [], editable: { start: 0, end: 0 }, written: session.permission, deleted: [], forms: {} } })
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
        return send({ res, value: state.agents.filter((agent) => agent.directory === directory).map(({ directory: _directory, scope: _scope, ...agent }) => agent) })
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
    description?: string
    hidden?: boolean
    disabled?: boolean
}

type StubSession = {
    id: string
    directory: string
    title: string
    agent: string | undefined
    metadata: unknown
    permission: unknown[]
    messages: StubMessage[]
    prompts: Record<string, unknown>[]
    aborted: number
}

type StubMessage = {
    info: Record<string, unknown>
    parts: unknown[]
}

type StubProvider = {
    id: string
    name: string
    models: { id: string, name: string }[]
}

type SessionRouteParams = {
    state: OpencodeStubState
    method: string
    url: URL
    json: Record<string, unknown>
    directory: string
    res: http.ServerResponse
}

type AnswerParams = {
    sessionId: string | null
    text?: string
    structured?: unknown
    error?: Record<string, unknown>
    finish?: string
    parts?: Record<string, unknown>[]
    completed?: boolean
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
    sessions: StubSession[]
    providers: StubProvider[]
    refusals: number[]
    busy: string[]
    nextSessionId: number
    eventClients: Set<http.ServerResponse>
    mcpServers: { name: string, directory: string, config: unknown }[]
    mcpStatus: string
    disconnected: string[]
}

export type OpencodeStub = {
    url: string
    state: OpencodeStubState
    callsTo: (params: { method: string, path: string }) => StubCall[]
    answer: (params: AnswerParams) => void
    emit: (payload: Record<string, unknown>) => void
    close: () => Promise<void>
}
