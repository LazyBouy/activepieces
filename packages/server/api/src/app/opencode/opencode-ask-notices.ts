import { readFile } from 'node:fs/promises'
import { isNil, tryCatch } from '@activepieces/core-utils'
import { ApEdition, ApEnvironment, OpencodeAskEvent, OpencodeAskKind, PlatformRole, WebsocketClientEvent } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import Mustache from 'mustache'
import nodemailer, { Transporter } from 'nodemailer'
import { repoFactory } from '../core/db/repo-factory'
import { websocketService } from '../core/websockets.service'
import { flowService } from '../flows/flow/flow.service'
import { domainHelper } from '../helper/domain-helper'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { UserEntity } from '../user/user-entity'
import { resumePageHooks } from '../waitpoints/resume-page-hooks'
import { opencodeAskLink } from './opencode-ask-link'
import { OpencodeAskRow } from './opencode-ask.entity'

const userRepo = repoFactory(UserEntity)

export const opencodeAskNotices = (log: FastifyBaseLogger) => ({
    opened({ ask }: { ask: OpencodeAskRow }): void {
        websocketService.to(ask.projectId).emit(WebsocketClientEvent.OPENCODE_ASK, eventOf({ ask, state: 'opened' }))
    },

    closed({ ask }: { ask: OpencodeAskRow }): void {
        websocketService.to(ask.projectId).emit(WebsocketClientEvent.OPENCODE_ASK, eventOf({ ask, state: 'closed' }))
    },

    async email({ ask }: { ask: OpencodeAskRow }): Promise<void> {
        if (!emailConfigured()) {
            return
        }
        const flow = await flowService(log).getOnePopulated({ id: ask.flowId, projectId: ask.projectId })
        const recipients = await recipientsOf({ platformId: ask.platformId, ownerId: flow?.ownerId ?? null })
        if (recipients.length === 0) {
            return
        }
        const theme = await resumePageHooks.get(log).getTheme({ platformId: ask.platformId })
        const vars = {
            flowName: flow?.version.displayName ?? ask.flowId,
            stepName: ask.stepName,
            summary: summaryOf({ ask }),
            approvalUrl: await opencodeAskLink.urlOf({ askId: ask.id, platformId: ask.platformId }),
            runUrl: await domainHelper.getPublicUrl({ path: `/projects/${ask.projectId}/runs/${ask.flowRunId}` }),
            deadline: new Date(ask.deadline).toUTCString(),
            platformName: theme.websiteName,
            fullLogoUrl: theme.logos.fullLogoUrl,
            primaryColor: theme.colors.primary.default,
            primaryColorLight: theme.colors.primary.light,
            footerContent: system.getEdition() === ApEdition.CLOUD ? CLOUD_FOOTER : '',
        }
        const [template, footer] = await Promise.all([readFile(TEMPLATE_PATH, 'utf-8'), readFile(FOOTER_PATH, 'utf-8')])
        const html = Mustache.render(template, vars, { footer })
        const subject = `${vars.flowName}: an agent is waiting for an answer`
        if (system.get(AppSystemProp.ENVIRONMENT) === ApEnvironment.TESTING) {
            log.info({ opencodeAsk: { id: ask.id }, recipientsCount: recipients.length }, '[opencodeAskNotices] Ask email rendered (not sent in tests)')
            return
        }
        const sender = transport()
        const from = `${system.get(AppSystemProp.SMTP_SENDER_NAME) ?? theme.websiteName} <${system.getOrThrow(AppSystemProp.SMTP_SENDER_EMAIL)}>`
        const sent = await Promise.all(recipients.map((to) => tryCatch(() => sender.sendMail({ from, to, subject, html }))))
        const failed = sent.filter(({ error }) => !isNil(error))
        if (failed.length > 0) {
            log.warn({ opencodeAsk: { id: ask.id }, failedCount: failed.length, error: failed[0].error }, '[opencodeAskNotices] Could not send the ask email')
        }
    },
})

function emailConfigured(): boolean {
    return SMTP_PROPS.every((prop) => {
        const value = system.get(prop)
        return !isNil(value) && value.length > 0
    })
}

async function recipientsOf({ platformId, ownerId }: { platformId: string, ownerId: string | null }): Promise<string[]> {
    const rows = await userRepo().createQueryBuilder('user')
        .innerJoin(USER_IDENTITY_TABLE, 'identity', 'identity.id = "user"."identityId"')
        .select('identity.email', 'email')
        .where('"user"."platformId" = :platformId', { platformId })
        .andWhere('("user"."platformRole" = :admin OR "user"."id" = :ownerId)', { admin: PlatformRole.ADMIN, ownerId: ownerId ?? '' })
        .getRawMany<{ email: string }>()
    return [...new Set(rows.map((row) => row.email))]
}

function eventOf({ ask, state }: { ask: OpencodeAskRow, state: OpencodeAskEvent['state'] }): OpencodeAskEvent {
    return {
        askId: ask.id,
        flowId: ask.flowId,
        flowRunId: ask.flowRunId,
        flowVersionId: ask.flowVersionId,
        stepName: ask.stepName,
        kind: ask.kind,
        state,
        title: summaryOf({ ask }),
    }
}

function summaryOf({ ask }: { ask: OpencodeAskRow }): string {
    if (ask.kind === OpencodeAskKind.QUESTION) {
        return ask.questions?.[0]?.question ?? 'The agent has a question'
    }
    const patterns = ask.permission?.patterns.join(', ') ?? ''
    return patterns.length > 0 ? `${ask.permission?.permission}: ${patterns}` : ask.permission?.permission ?? 'Permission requested'
}

function transport(): Transporter {
    const port = Number.parseInt(system.getOrThrow(AppSystemProp.SMTP_PORT))
    return nodemailer.createTransport({
        host: system.getOrThrow(AppSystemProp.SMTP_HOST),
        port,
        secure: port === SMTPS_PORT,
        auth: {
            user: system.getOrThrow(AppSystemProp.SMTP_USERNAME),
            pass: system.getOrThrow(AppSystemProp.SMTP_PASSWORD),
        },
        tls: {
            rejectUnauthorized: system.getBoolean(AppSystemProp.SMTP_TLS_REJECT_UNAUTHORIZED) ?? true,
        },
    })
}

const SMTP_PROPS = [AppSystemProp.SMTP_HOST, AppSystemProp.SMTP_PORT, AppSystemProp.SMTP_USERNAME, AppSystemProp.SMTP_PASSWORD, AppSystemProp.SMTP_SENDER_EMAIL]

const SMTPS_PORT = 465

const USER_IDENTITY_TABLE = 'user_identity'

const TEMPLATE_PATH = 'packages/server/api/src/assets/emails/opencode-ask.html'

const FOOTER_PATH = 'packages/server/api/src/assets/emails/footer.html'

const CLOUD_FOOTER = 'Activepieces, Inc. 398 11th Street, 2nd floor, San Francisco, CA 94103'

export const opencodeAskEmail = {
    emailConfigured,
    summaryOf,
}
