import http from 'node:http'
import { AddressInfo } from 'node:net'
import { z } from 'zod'

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
        decisions: [],
        questionReplies: [],
        pendingPermissions: [],
        pendingQuestions: [],
        goneRequests: [],
        refusedRequests: [],
        diffs: {},
        projectFiles: {},
        views: { toolPrompts: {}, capabilities: [], memoryLevels: [], hooks: [], mcpStatus: {}, defaultModel: 'openrouter/qwen/qwen3-235b-a22b-2507' },
        commands: [],
        groups: {},
        inboxMessages: [],
        nextInboxId: 1,
        inboxRules: {},
        requiredAuth: null,
    }
    const server = http.createServer((req, res) => {
        readBody({ req }).then((body) => {
            const url = new URL(req.url ?? '/', 'http://stub')
            state.calls.push({ method: req.method ?? '', path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body })
            if (state.requiredAuth !== null && req.headers.authorization !== state.requiredAuth) {
                res.writeHead(401, { 'www-authenticate': 'Basic realm="Secure Area"' })
                res.end()
                return
            }
            route({ state, method: req.method ?? '', url, body, res })
        }).catch(() => res.destroy())
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${portOf({ address: server.address() })}`,
        state,
        callsTo: ({ method, path }) => state.calls.filter((call) => call.method === method && call.path === path),
        answer: (params) => answer({ state, ...params }),
        createSession: async ({ directory, parentId }) => {
            const id = `ses_${String(state.nextSessionId++).padStart(4, '0')}`
            state.sessions.push({ id, directory, title: '', agent: undefined, metadata: {}, permission: [], parentId, messages: [], prompts: [], aborted: 0, created: Date.now() })
            return id
        },
        emit: (payload) => emit({ state, payload }),
        ping: (params) => ping({ state, ...params }),
        close: async () => {
            state.eventClients.forEach((client) => client.end())
            server.closeAllConnections()
            await new Promise<void>((resolve) => server.close(() => resolve()))
        },
    }
}

function answer({ state, sessionId, text = '', structured, error, finish = 'stop', parts, sources, completed = true }: AnswerParams & { state: OpencodeStubState }): void {
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
            ...(sources === undefined ? {} : { sources }),
        },
        parts: parts ?? [{ id: `${id}_p1`, sessionID: sessionId, messageID: id, type: 'text', text }],
    })
}

function ping({ state, project, agent, to, text, correlationID }: PingParams & { state: OpencodeStubState }): StubInboxMessage {
    const message: StubInboxMessage = {
        id: `msg_${String(state.nextInboxId++).padStart(4, '0')}`,
        project,
        folder: state.projects.find((candidate) => candidate.id === project)?.key ?? '',
        from: { kind: 'agent', project, agent },
        to,
        body: { type: 'text', text },
        priority: 'normal',
        steer: false,
        correlationID,
        hops: 1,
        status: 'delivered',
        inbox: project,
        createdAt: Date.now() + state.nextInboxId,
        trail: [],
    }
    state.inboxMessages.push(message)
    return message
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
            parentId: typeof json['parentID'] === 'string' ? json['parentID'] : undefined,
            messages: [],
            prompts: [],
            aborted: 0,
            created: Date.now(),
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
        send({ res, value: {
            id: session.id,
            title: session.title,
            directory: session.directory,
            ...(session.agent === undefined ? {} : { agent: session.agent }),
            ...(session.parentId === undefined ? {} : { parentID: session.parentId }),
        } })
        return true
    }
    if (method === 'POST' && rest === '/command') {
        session.prompts.push(json)
        session.messages.push({
            info: { id: json['messageID'], sessionID: session.id, role: 'user', agent: json['agent'] ?? session.agent, time: { created: Date.now() } },
            parts: [{ id: `${String(json['messageID'])}_p1`, type: 'text', text: `/${String(json['command'])} ${String(json['arguments'] ?? '')}` }, ...(Array.isArray(json['parts']) ? json['parts'] : [])],
        })
        send({ res, value: { info: { id: `${String(json['messageID'])}_r0`, role: 'assistant' }, parts: [] } })
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
    if (method === 'GET' && rest === '/diff') {
        send({ res, value: state.diffs[url.searchParams.get('messageID') ?? ''] ?? [] })
        return true
    }
    return false
}

function routeInbox({ state, method, url, json, res }: Omit<SessionRouteParams, 'directory'>): boolean {
    if (method === 'GET' && url.pathname === '/operator/project-records') {
        send({ res, value: state.projects.map((project) => ({ key: project.key, description: '', status: 'active', members: [], groups: state.groups[project.key] ?? [] })) })
        return true
    }
    const entered = url.pathname.match(/^\/operator\/project-inbox\/([^/]+)$/)
    if (method === 'POST' && entered !== null) {
        const project = state.projects.find((candidate) => candidate.id === entered[1])
        if (project === undefined) {
            send({ res, status: 404, value: { name: 'OperatorProjectInboxNotFoundError', data: { message: `No project ${entered[1]}` } } })
            return true
        }
        send({ res, value: enterInbox({ state, project, json }) })
        return true
    }
    const record = url.pathname.match(/^\/operator\/messages\/([^/]+)$/)
    if (method === 'GET' && record !== null) {
        const found = state.inboxMessages.find((message) => message.id === record[1])
        send({ res, status: found === undefined ? 404 : 200, value: found ?? { name: 'OperatorProjectInboxNotFoundError', data: { message: `No message ${record[1]}` } } })
        return true
    }
    const rules = url.pathname.match(/^\/operator\/project-inbox\/([^/]+)\/rules$/)
    if (rules !== null) {
        const project = rules[1]
        if (method === 'PUT') {
            state.inboxRules[project] = Array.isArray(json['rules']) ? json['rules'] : []
        }
        send({ res, value: { rules: state.inboxRules[project] ?? [REPLIES_PRESET], unmatched: 'dead-letter' } })
        return true
    }
    const conversation = url.pathname.match(/^\/operator\/conversation\/([^/]+)$/)
    if (method === 'GET' && conversation !== null) {
        const correlationID = decodeURIComponent(conversation[1])
        send({ res, value: { correlationID, messages: state.inboxMessages.filter((message) => message.correlationID === correlationID), sessions: [] } })
        return true
    }
    return false
}

function enterInbox({ state, project, json }: { state: OpencodeStubState, project: StubProject, json: Record<string, unknown> }): StubInboxMessage {
    const id = `msg_${String(state.nextInboxId++).padStart(4, '0')}`
    const now = Date.now()
    const text = String(json['text'] ?? '')
    const target = InboxTarget.safeParse(json['to'])
    const from = { kind: json['from'] === 'external' ? 'external' : 'user', project: project.id }
    const base: StubInboxMessage = {
        id,
        project: project.id,
        folder: project.key,
        from,
        to: target.success ? target.data : { type: 'inbox' },
        body: { type: 'text', text },
        priority: 'normal',
        steer: false,
        correlationID: typeof json['correlationID'] === 'string' ? json['correlationID'] : id,
        hops: 1,
        status: 'queued',
        inbox: project.id,
        createdAt: now,
        trail: [{ at: now, kind: 'entered the Project inbox', detail: `from ${from.kind}` }],
    }
    if (!target.success) {
        const dead = { ...base, status: 'dead letter', trail: [...base.trail, { at: now, kind: 'dead letter', detail: 'no rule matched, the project has no manager, and it names no recipient' }] }
        state.inboxMessages.push(dead)
        return dead
    }
    const agents = recipientsOf({ state, project, target: target.data })
    const routed = { ...base, status: 'routed', routedBy: 'as addressed', routedTo: agents.map(({ agent }) => agent), trail: [...base.trail, { at: now, kind: 'routed', detail: `as addressed: to ${agents.map(({ agent }) => agent).join(', ')}` }] }
    state.inboxMessages.push(routed)
    agents.forEach(({ agent, sessionId }) => deliverCopy({ state, project, original: routed, agent, sessionId }))
    return routed
}

function recipientsOf({ state, project, target }: { state: OpencodeStubState, project: StubProject, target: { type: string, id: string } }): { agent: string, sessionId: string | undefined }[] {
    if (target.type === 'session') {
        return [{ agent: state.sessions.find((session) => session.id === target.id)?.agent ?? 'flow', sessionId: target.id }]
    }
    if (target.type === 'group') {
        return (state.groups[project.key]?.find((group) => group.id === target.id)?.members ?? []).map((agent) => ({ agent, sessionId: undefined }))
    }
    return [{ agent: target.id, sessionId: undefined }]
}

function deliverCopy({ state, project, original, agent, sessionId }: DeliverCopyParams): void {
    const copyId = `msg_${String(state.nextInboxId++).padStart(4, '0')}`
    const session = state.sessions.find((candidate) => candidate.id === sessionId) ?? newSession({ state, directory: project.key, agent })
    state.inboxMessages.push({
        ...original,
        id: copyId,
        to: { type: 'agent', id: agent },
        via: original.id,
        status: 'delivered',
        agent,
        sessionID: session.id,
        deliveredAt: Date.now(),
        routedBy: undefined,
        routedTo: undefined,
        trail: [],
    })
    session.messages.push({
        info: { id: `${copyId}_u`, sessionID: session.id, role: 'user', agent, time: { created: Date.now() } },
        parts: [{
            id: `${copyId}_p1`,
            type: 'text',
            text: `Message from outside (project ${project.name}) · correlation ${original.correlationID} · id ${copyId}:\n${original.body.text}`,
            metadata: { message: { id: copyId, agent, folder: project.key, from: original.from, correlationID: original.correlationID, via: original.id, priority: 'normal' } },
        }],
    })
}

function newSession({ state, directory, agent }: { state: OpencodeStubState, directory: string, agent: string }): StubSession {
    const created: StubSession = { id: `ses_${String(state.nextSessionId++).padStart(4, '0')}`, directory, title: 'Inbox', agent, metadata: {}, permission: [], messages: [], prompts: [], aborted: 0, created: Date.now() }
    state.sessions.push(created)
    return created
}

function routeProjectFile({ state, url, res }: { state: OpencodeStubState, url: URL, res: http.ServerResponse }): void {
    const filePath = url.searchParams.get('path') ?? ''
    const maxBytes = Number(url.searchParams.get('maxBytes') ?? Infinity)
    if (filePath.startsWith('..') || filePath.startsWith('/')) {
        return send({ res, status: 400, value: { name: 'OperatorFileRefusedError', data: { message: `${filePath} is outside the project folder` } } })
    }
    const file = state.projectFiles[filePath]
    if (file === undefined) {
        return send({ res, status: 404, value: { name: 'OperatorFileNotFoundError', data: { message: `${filePath} is not a file here` } } })
    }
    if (file.failWith !== undefined) {
        return send({ res, status: file.failWith, value: { name: 'UnknownError', data: { message: 'EACCES: permission denied' } } })
    }
    const data = Buffer.from(file.content)
    if (data.length > maxBytes) {
        return send({ res, status: 413, value: { name: 'OperatorFileTooLargeError', data: { message: 'too large', size: data.length } } })
    }
    send({ res, value: { path: filePath, size: data.length, mime: file.mime, content: data.toString('base64') } })
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
    if (key === 'GET /operator/file/raw') {
        return routeProjectFile({ state, url, res })
    }
    if (routeInbox({ state, method, url, json, res })) {
        return
    }
    if (key === 'GET /command') {
        return send({ res, value: state.commands.map((command) => ({ template: '$ARGUMENTS', hints: [], ...command })) })
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
    const decide = url.pathname.match(/^\/operator\/permission\/([^/]+)\/decide$/)
    if (method === 'POST' && decide !== null) {
        if (state.goneRequests.includes(decide[1])) {
            return send({ res, status: 409, value: { name: 'OperatorPermissionGoneError', data: { message: 'That request is no longer waiting' } } })
        }
        if (state.refusedRequests.includes(decide[1])) {
            return send({ res, status: 400, value: { name: 'OperatorPermissionRefusedError', data: { message: 'Give the rule a pattern' } } })
        }
        state.decisions.push({ requestId: decide[1], body: json, query: Object.fromEntries(url.searchParams) })
        return send({ res, value: { rules: [], covered: [] } })
    }
    const question = url.pathname.match(/^\/question\/([^/]+)\/(reply|reject)$/)
    if (method === 'POST' && question !== null) {
        state.questionReplies.push({ requestId: question[1], kind: question[2], body: json })
        return send({ res, value: true })
    }
    if (key === 'GET /permission') {
        return send({ res, value: state.pendingPermissions })
    }
    if (key === 'GET /question') {
        return send({ res, value: state.pendingQuestions })
    }
    const sessionPermissions = url.pathname.match(/^\/operator\/session\/([^/]+)\/permissions$/)
    if (sessionPermissions !== null) {
        const session = state.sessions.find((candidate) => candidate.id === sessionPermissions[1])
        if (session === undefined) {
            return send({ res, status: 404, value: { name: 'OperatorSessionPermissionsNotFoundError', data: { message: 'no such session' } } })
        }
        if (method === 'PUT') {
            session.permission = Array.isArray(json['rules']) ? json['rules'] : []
            if (typeof json['correlationID'] === 'string') {
                session.correlationId = json['correlationID'] === '' ? null : json['correlationID']
            }
        }
        return send({ res, value: { sessionID: session.id, agent: session.agent ?? 'flow', parent: false, rows: [], editable: { start: 0, end: 0 }, written: session.permission, deleted: [], forms: {}, ...(session.correlationId === undefined || session.correlationId === null ? {} : { correlationID: session.correlationId }) } })
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
        return send({ res, value: state.agents.filter((agent) => agent.directory === directory).map(({ directory: _directory, scope, ...agent }) => ({
            permission: [],
            options: {},
            source: { kind: 'file', path: null, customized: false },
            level: { kind: scope.length > 0 ? scope : 'project' },
            settings: {},
            sessions: { total: 0 },
            modelSource: { model: state.views.defaultModel, source: 'default', how: 'namespace' },
            ...agent,
            disabled: agent.disabled ?? false,
        })) })
    }
    const toolPrompt = url.pathname.match(/^\/operator\/agent\/([^/]+)\/tool-prompt$/)
    if (method === 'GET' && toolPrompt !== null) {
        const name = decodeURIComponent(toolPrompt[1])
        if (!state.agents.some((agent) => agent.directory === directory && agent.name === name)) {
            return send({ res, status: 404, value: { name: 'OperatorAgentNotFoundError', data: { message: `No agent named ${name}` } } })
        }
        const view = state.views.toolPrompts[name] ?? { rows: [], sent: [], notSent: [] }
        return send({ res, value: { agent: name, model: state.views.defaultModel, runsAs: 'primary', sizes: {}, list: [], ...view } })
    }
    if (key === 'GET /operator/capability') {
        return send({ res, value: { scope: 'project', namespace: 'iphi-flow', inheritGlobal: true, items: state.views.capabilities } })
    }
    if (key === 'GET /operator/memory/levels') {
        const agent = url.searchParams.get('agent')
        return send({ res, value: {
            project: directory,
            namespace: { id: 'iphi-flow', name: 'iphi-flow' },
            instructions: false,
            ...(agent === null ? {} : { agent }),
            limits: { lines: 200, chars: 25000 },
            levels: state.views.memoryLevels.filter((level) => agent !== null || level['level'] !== 'agent'),
        } })
    }
    if (key === 'GET /operator/hook') {
        return send({ res, value: { hooks: state.views.hooks, paused: false, level: 'project', file: `${directory}/.opencode/opencode.jsonc`, folder: `${directory}/.opencode/hooks`, pluginsOff: false } })
    }
    if (key === 'GET /mcp') {
        return send({ res, value: state.views.mcpStatus })
    }
    if (key === 'GET /operator/model') {
        return send({ res, value: {
            model: { model: state.views.defaultModel, source: 'default', how: 'namespace' },
            small: { model: '', source: 'none' },
            global: {},
            chain: {},
        } })
    }
    if (key === 'GET /session') {
        return send({ res, value: state.sessions.filter((session) => session.directory === directory && session.parentId === undefined).map((session) => ({
            id: session.id,
            slug: session.id,
            projectID: 'stub',
            directory: session.directory,
            title: session.title,
            ...(session.agent === undefined ? {} : { agent: session.agent }),
            version: 'stub-1.0.0',
            metadata: session.metadata,
            cost: 0.01,
            time: { created: session.created, updated: session.created },
        })) })
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
    correlationId?: string | null
    parentId?: string
    messages: StubMessage[]
    prompts: Record<string, unknown>[]
    aborted: number
    created: number
}

type StubViews = {
    toolPrompts: Record<string, { rows: Record<string, unknown>[], sent: Record<string, unknown>[], notSent: Record<string, unknown>[] }>
    capabilities: Record<string, unknown>[]
    memoryLevels: Record<string, unknown>[]
    hooks: Record<string, unknown>[]
    mcpStatus: Record<string, unknown>
    defaultModel: string
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
    sources?: { url: string, title?: string }[]
    completed?: boolean
}

type StubCall = {
    method: string
    path: string
    query: Record<string, string>
    headers: http.IncomingHttpHeaders
    body: string
}

type StubInboxMessage = {
    id: string
    project: string
    folder: string
    from: { kind: string, project: string, agent?: string }
    to: { type: string, id?: string, project?: string }
    body: { type: string, text: string }
    priority: string
    steer: boolean
    correlationID: string
    hops: number
    status: string
    inbox: string
    createdAt: number
    trail: { at: number, kind: string, detail?: string }[]
    via?: string
    agent?: string
    sessionID?: string
    deliveredAt?: number
    routedBy?: string
    routedTo?: string[]
}

type DeliverCopyParams = {
    state: OpencodeStubState
    project: StubProject
    original: StubInboxMessage
    agent: string
    sessionId: string | undefined
}

type PingParams = {
    project: string
    agent: string
    to: { type: string, id: string, project?: string }
    text: string
    correlationID: string
}

const InboxTarget = z.object({ type: z.enum(['agent', 'session', 'group']), id: z.string() })

const REPLIES_PRESET = { id: 'replies', name: 'Replies go to their sender', enabled: true, preset: 'replies', match: { reply: true }, action: { kind: 'reply' } }

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
    decisions: { requestId: string, body: Record<string, unknown>, query: Record<string, string> }[]
    questionReplies: { requestId: string, kind: string, body: Record<string, unknown> }[]
    pendingPermissions: Record<string, unknown>[]
    pendingQuestions: Record<string, unknown>[]
    goneRequests: string[]
    refusedRequests: string[]
    diffs: Record<string, { file: string, status: string, additions: number, deletions: number }[]>
    projectFiles: Record<string, { content: string | Buffer, mime: string, failWith?: number }>
    views: StubViews
    commands: { name: string, source: string, description?: string }[]
    groups: Record<string, { id: string, name: string, members: string[] }[]>
    inboxMessages: StubInboxMessage[]
    nextInboxId: number
    inboxRules: Record<string, unknown[]>
    requiredAuth: string | null
}

export type OpencodeStub = {
    url: string
    state: OpencodeStubState
    callsTo: (params: { method: string, path: string }) => StubCall[]
    answer: (params: AnswerParams) => void
    createSession: (params: { directory: string, parentId?: string }) => Promise<string>
    emit: (payload: Record<string, unknown>) => void
    ping: (params: PingParams) => StubInboxMessage
    close: () => Promise<void>
}
