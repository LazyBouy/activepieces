function session({ adminPanelUrl, directory, sessionId }: SessionLinkParams): string {
    return `${baseOf({ adminPanelUrl })}/${Buffer.from(directory).toString('base64url')}/session/${sessionId}`
}

function agent({ adminPanelUrl, directory, name, tab }: AgentLinkParams): string {
    const query = new URLSearchParams({ dir: directory, ...(tab === undefined ? {} : { tab }) })
    return `${baseOf({ adminPanelUrl })}/operator/agents/${encodeURIComponent(name)}?${query.toString()}`
}

function memory({ adminPanelUrl, directory, name }: { adminPanelUrl: string, directory: string, name?: string }): string {
    const query = new URLSearchParams({ tab: 'memory', mproject: directory, ...(name === undefined ? {} : { magent: name }) })
    return `${baseOf({ adminPanelUrl })}/operator/memory?${query.toString()}`
}

function page({ adminPanelUrl, path }: { adminPanelUrl: string, path: string }): string {
    return `${baseOf({ adminPanelUrl })}${path}`
}

function baseOf({ adminPanelUrl }: { adminPanelUrl: string }): string {
    return adminPanelUrl.replace(/\/+$/, '')
}

export const opencodeLinks = {
    session,
    agent,
    memory,
    page,
}

type SessionLinkParams = {
    adminPanelUrl: string
    directory: string
    sessionId: string
}

type AgentLinkParams = {
    adminPanelUrl: string
    directory: string
    name: string
    tab?: string
}
