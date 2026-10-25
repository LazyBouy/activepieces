import { z } from 'zod'

export const OpencodeSessionMode = z.enum(['NEW_PER_STEP', 'ONE_PER_RUN'])

export type OpencodeSessionMode = z.infer<typeof OpencodeSessionMode>

export const OpencodeStepSettings = z.object({
    sessionMode: OpencodeSessionMode.optional(),
    namespace: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
    agent: z.string().min(1).optional(),
    channel: z.string().min(1).optional(),
})

export type OpencodeStepSettings = z.infer<typeof OpencodeStepSettings>

export const OpencodeStepSettingsWithValidation = OpencodeStepSettings.refine(
    ({ namespace, project }) => (namespace === undefined) === (project === undefined),
    { message: 'Pick a project in this namespace', path: ['project'] },
)

export const OpencodeDefaults = z.object({
    sessionMode: OpencodeSessionMode.optional(),
})

export type OpencodeDefaults = z.infer<typeof OpencodeDefaults>
