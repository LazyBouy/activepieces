import { isNil, tryCatch } from '@activepieces/core-utils'
import { OPENCODE_MAX_ASK_CAP_MINUTES } from '@activepieces/shared'
import { z } from 'zod'
import { domainHelper } from '../helper/domain-helper'
import { JwtAudience, jwtUtils } from '../helper/jwt-utils'

async function urlOf({ askId, platformId }: AskLinkPayload): Promise<string> {
    const token = await jwtUtils.sign({
        payload: { askId, platformId },
        key: await jwtUtils.getJwtSecret(),
        expiresInSeconds: TOKEN_LIFETIME_SECONDS,
        audience: JwtAudience.OPENCODE_ASK,
    })
    return domainHelper.getPublicApiUrl({ path: `/v1/opencode/ask-links?token=${encodeURIComponent(token)}` })
}

async function verify({ token }: { token: string }): Promise<AskLinkPayload | null> {
    const { data: decoded } = await tryCatch(async () => jwtUtils.decodeAndVerify<unknown>({
        jwt: token,
        key: await jwtUtils.getJwtSecret(),
        audience: JwtAudience.OPENCODE_ASK,
    }))
    if (isNil(decoded)) {
        return null
    }
    const parsed = AskLinkPayload.safeParse(decoded)
    return parsed.success ? parsed.data : null
}

const TOKEN_LIFETIME_SECONDS = (OPENCODE_MAX_ASK_CAP_MINUTES + 24 * 60) * 60

const AskLinkPayload = z.object({
    askId: z.string(),
    platformId: z.string(),
})
type AskLinkPayload = z.infer<typeof AskLinkPayload>

export const opencodeAskLink = {
    urlOf,
    verify,
}
