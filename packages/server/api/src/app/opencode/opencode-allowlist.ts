import { OpencodeCatalog } from '@activepieces/shared'

function isProjectAllowed({ allowlist, namespace, projectId }: { allowlist: string[], namespace: string, projectId: string }): boolean {
    return allowlist.includes(namespace) || allowlist.includes(`${namespace}/${projectId}`)
}

function isNamespaceReachable({ allowlist, namespace }: { allowlist: string[], namespace: string }): boolean {
    return allowlist.some((entry) => entry === namespace || entry.startsWith(`${namespace}/`))
}

function filterCatalog({ allowlist, catalog }: { allowlist: string[], catalog: OpencodeCatalog }): OpencodeCatalog {
    const namespaces = catalog.namespaces
        .filter((namespace) => isNamespaceReachable({ allowlist, namespace: namespace.id }))
        .map((namespace) => ({
            ...namespace,
            projects: namespace.projects.filter((project) => isProjectAllowed({ allowlist, namespace: namespace.id, projectId: project.id })),
        }))
    return { ...catalog, namespaces }
}

export const opencodeAllowlist = {
    isProjectAllowed,
    isNamespaceReachable,
    filterCatalog,
}
