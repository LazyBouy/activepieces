import { z } from 'zod'
import { formErrors } from '../../form-errors'

export const OPENCODE_DEFAULT_NAMESPACE = 'iphi-flow'

export const OPENCODE_DEFAULT_ASK_CAP_MINUTES = 1440

export const OPENCODE_MAX_ASK_CAP_MINUTES = 43200

export const OpencodeAllowlistEntry = z.string().regex(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)?$/)
export type OpencodeAllowlistEntry = z.infer<typeof OpencodeAllowlistEntry>

export const OpencodeHealth = z.object({
    healthy: z.boolean(),
    version: z.string().optional(),
    error: z.string().optional(),
    checkedAt: z.string(),
})
export type OpencodeHealth = z.infer<typeof OpencodeHealth>

export const OpencodeConnection = z.object({
    id: z.string(),
    serverUrl: z.string(),
    username: z.string(),
    hasPassword: z.boolean(),
    adminPanelUrl: z.string(),
    callbackUrl: z.string(),
    projectsFolder: z.string().nullable(),
    enabled: z.boolean(),
    askCapMinutes: z.number(),
    allowlist: z.array(OpencodeAllowlistEntry),
    lastHealth: OpencodeHealth.nullable(),
})
export type OpencodeConnection = z.infer<typeof OpencodeConnection>

export const UpdateOpencodeConnectionRequest = z.object({
    serverUrl: z.url().optional(),
    username: z.string().min(1, formErrors.required).optional(),
    password: z.string().nullable().optional(),
    adminPanelUrl: z.url().optional(),
    callbackUrl: z.url().optional(),
    projectsFolder: z.string().min(1, formErrors.required).nullable().optional(),
    enabled: z.boolean().optional(),
    askCapMinutes: z.number().int().min(1).max(OPENCODE_MAX_ASK_CAP_MINUTES).optional(),
    allowlist: z.array(OpencodeAllowlistEntry).optional(),
})
export type UpdateOpencodeConnectionRequest = z.infer<typeof UpdateOpencodeConnectionRequest>

export const OpencodeCatalogProject = z.object({
    id: z.string(),
    name: z.string(),
    folder: z.string(),
})
export type OpencodeCatalogProject = z.infer<typeof OpencodeCatalogProject>

export const OpencodeCatalogNamespace = z.object({
    id: z.string(),
    name: z.string(),
    folder: z.string(),
    projects: z.array(OpencodeCatalogProject),
})
export type OpencodeCatalogNamespace = z.infer<typeof OpencodeCatalogNamespace>

export const OpencodeCatalog = z.object({
    namespaces: z.array(OpencodeCatalogNamespace),
    error: z.string().optional(),
})
export type OpencodeCatalog = z.infer<typeof OpencodeCatalog>
