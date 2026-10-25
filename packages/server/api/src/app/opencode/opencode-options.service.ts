import { isNil, tryCatch } from '@activepieces/core-utils'
import { OPENCODE_DEFAULT_NAMESPACE, OpencodeAgentList, OpencodeCatalogNamespace, OpencodeProjectOptions } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { repoFactory } from '../core/db/repo-factory'
import { opencodeAllowlist } from './opencode-allowlist'
import { opencodeConnectionService } from './opencode-connection.service'
import { opencodeErrors } from './opencode-errors'
import { OpencodeProjectLinkEntity } from './opencode-project-link.entity'
import { FLOW_AGENT_NAME } from './opencode-provisioning'

const linkRepo = repoFactory(OpencodeProjectLinkEntity)

export const opencodeOptionsService = (log: FastifyBaseLogger) => ({
    async options({ platformId, projectId }: ProjectParams): Promise<OpencodeProjectOptions> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const link = await linkRepo().findOneBy({ projectId })
        const defaultLocation = {
            namespace: link?.namespace ?? OPENCODE_DEFAULT_NAMESPACE,
            project: link?.opencodeProjectId ?? null,
            agent: FLOW_AGENT_NAME,
        }
        if (!connection.enabled) {
            return { enabled: false, adminPanelUrl: connection.adminPanelUrl, namespaces: [], defaultLocation }
        }
        const catalog = await opencodeConnectionService(log).catalog({ platformId })
        const allowed = opencodeAllowlist.filterCatalog({ allowlist: connection.allowlist, catalog })
        return {
            enabled: true,
            adminPanelUrl: connection.adminPanelUrl,
            namespaces: allowed.namespaces,
            defaultLocation,
            ...(isNil(catalog.error) ? {} : { error: catalog.error }),
        }
    },

    async agents({ platformId, projectId, namespace, project }: ListAgentsParams): Promise<OpencodeAgentList> {
        const connection = await opencodeConnectionService(log).getOrCreate({ platformId })
        const target = await resolveTarget({ projectId, namespace, project })
        if (isNil(target)) {
            return { agents: [] }
        }
        if (!opencodeAllowlist.isProjectAllowed({ allowlist: connection.allowlist, namespace: target.namespace, projectId: target.project })) {
            return { agents: [], error: notAllowlisted({ namespace: target.namespace, project: target.project }) }
        }
        const catalog = await opencodeConnectionService(log).catalog({ platformId })
        const directory = folderOf({ namespaces: catalog.namespaces, namespace: target.namespace, project: target.project })
        if (isNil(directory)) {
            return { agents: [], error: catalog.error ?? `OpenCode has no project ${target.namespace}/${target.project}.` }
        }
        const client = await opencodeConnectionService(log).client({ platformId })
        const { data: result, error } = await tryCatch(() => client.operator.agent.list({ directory }, { throwOnError: true }))
        if (isNil(result)) {
            return { agents: [], error: opencodeErrors.describe({ error }) }
        }
        return {
            agents: result.data
                .filter((agent) => agent.mode !== 'subagent' && agent.hidden !== true && !agent.disabled)
                .map((agent) => ({ name: agent.name, mode: agent.mode, ...(isNil(agent.description) ? {} : { description: agent.description }) })),
        }
    },
})

async function resolveTarget({ projectId, namespace, project }: { projectId: string, namespace?: string, project?: string }): Promise<{ namespace: string, project: string } | null> {
    if (!isNil(namespace) && !isNil(project)) {
        return { namespace, project }
    }
    const link = await linkRepo().findOneBy({ projectId })
    if (isNil(link)) {
        return null
    }
    return { namespace: link.namespace, project: link.opencodeProjectId }
}

function folderOf({ namespaces, namespace, project }: { namespaces: OpencodeCatalogNamespace[], namespace: string, project: string }): string | undefined {
    return namespaces.find((candidate) => candidate.id === namespace)?.projects.find((candidate) => candidate.id === project)?.folder
}

function notAllowlisted({ namespace, project }: { namespace: string, project: string }): string {
    return `${namespace}/${project} is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.`
}

type ProjectParams = {
    platformId: string
    projectId: string
}

type ListAgentsParams = ProjectParams & {
    namespace?: string
    project?: string
}
