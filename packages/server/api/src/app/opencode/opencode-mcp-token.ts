import { AGENT_STEP_TIMEOUT_MS } from '@activepieces/core-piece-types'
import { isNil, tryCatch } from '@activepieces/core-utils'
import { z } from 'zod'
import { JwtAudience, jwtUtils } from '../helper/jwt-utils'

async function sign({ stepId, projectId, platformId }: OpencodeMcpTokenPayload): Promise<string> {
    return jwtUtils.sign({
        payload: { stepId, projectId, platformId },
        key: await jwtUtils.getJwtSecret(),
        expiresInSeconds: TOKEN_LIFETIME_SECONDS,
        audience: JwtAudience.OPENCODE_MCP,
    })
}

async function verify({ token }: { token: string }): Promise<OpencodeMcpTokenPayload | null> {
    const { data: decoded } = await tryCatch(async () => jwtUtils.decodeAndVerify<unknown>({
        jwt: token,
        key: await jwtUtils.getJwtSecret(),
        audience: JwtAudience.OPENCODE_MCP,
    }))
    if (isNil(decoded)) {
        return null
    }
    const parsed = OpencodeMcpTokenPayload.safeParse(decoded)
    return parsed.success ? parsed.data : null
}

const TOKEN_LIFETIME_SECONDS = AGENT_STEP_TIMEOUT_MS / 1000 + 60 * 60

const OpencodeMcpTokenPayload = z.object({
    stepId: z.string(),
    projectId: z.string(),
    platformId: z.string(),
})
type OpencodeMcpTokenPayload = z.infer<typeof OpencodeMcpTokenPayload>

export const opencodeMcpToken = {
    sign,
    verify,
}
