import { ActivepiecesError, isNil, tryCatch } from '@activepieces/core-utils'
import { AnswerOpencodeAskRequest, OPENCODE_ASK_NOTE_MAX_LENGTH, OpencodeAsk, OpencodeAskKind, OpencodeAskStatus, OpencodePermissionDecision } from '@activepieces/shared'
import { FastifyBaseLogger, FastifyReply } from 'fastify'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import Mustache from 'mustache'
import { z } from 'zod'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { flowService } from '../flows/flow/flow.service'
import { resumePageHooks } from '../waitpoints/resume-page-hooks'
import { opencodeAskLink } from './opencode-ask-link'
import { opencodeAsks, opencodeAskVia } from './opencode-asks'

export const opencodeAskLinkController: FastifyPluginAsyncZod = async (app) => {
    app.get('/', AskLinkRequest, async (request, reply) => {
        const ask = await askOf({ token: request.query.token, log: request.log })
        await replyWithPage({ reply, page: { ...await pageOf({ ask, log: request.log }), token: request.query.token }, platformId: ask?.platformId ?? null, log: request.log })
    })

    app.post('/', AskLinkRequest, async (request, reply) => {
        const ask = await askOf({ token: request.query.token, log: request.log })
        const answer = isNil(ask) ? null : answerOf({ ask: ask.view, action: request.query.action, body: request.body })
        if (isNil(ask) || isNil(answer)) {
            await replyWithPage({ reply, page: { ...await pageOf({ ask, log: request.log }), token: request.query.token }, platformId: ask?.platformId ?? null, log: request.log, status: StatusCodes.BAD_REQUEST })
            return
        }
        const { error } = await tryCatch(() => opencodeAsks(request.log).answer({ askId: ask.view.id, projectId: ask.projectId, request: answer, via: opencodeAskVia.LINK }))
        const message = isNil(error) ? RECORDED_MESSAGE : errorMessageOf({ error })
        if (!(request.headers.accept ?? '').includes('text/html')) {
            await reply.status(isNil(error) ? StatusCodes.OK : StatusCodes.CONFLICT).send({ message })
            return
        }
        await replyWithPage({ reply, page: { title: isNil(error) ? RECORDED_TITLE : CLOSED_TITLE, message, success: isNil(error) }, platformId: ask.platformId, log: request.log })
    })
}

async function askOf({ token, log }: { token: string, log: FastifyBaseLogger }): Promise<LinkedAsk | null> {
    const payload = await opencodeAskLink.verify({ token })
    if (isNil(payload)) {
        return null
    }
    const linked = await opencodeAsks(log).linked({ askId: payload.askId, platformId: payload.platformId })
    return isNil(linked) ? null : { ...linked, platformId: payload.platformId }
}

async function pageOf({ ask, log }: { ask: LinkedAsk | null, log: FastifyBaseLogger }): Promise<Page> {
    if (isNil(ask)) {
        return { title: INVALID_TITLE, message: INVALID_MESSAGE }
    }
    const { view } = ask
    if (view.status !== OpencodeAskStatus.OPEN) {
        return { title: CLOSED_TITLE, message: CLOSED_MESSAGE }
    }
    const flow = await flowService(log).getOnePopulated({ id: view.flowId, projectId: ask.projectId })
    const flowName = flow?.version.displayName ?? view.flowId
    if (view.kind === OpencodeAskKind.QUESTION) {
        return {
            title: QUESTION_TITLE,
            message: `The step ${view.stepName} of ${flowName} is paused until someone answers.`,
            deadline: new Date(view.deadline).toUTCString(),
            questions: (view.questions ?? []).map((question, index) => ({
                index,
                header: question.header,
                question: question.question,
                inputType: question.multiple === true ? 'checkbox' : 'radio',
                options: question.options.map((option) => ({ label: option.label, description: option.description })),
                custom: question.custom !== false,
            })),
        }
    }
    return {
        title: PERMISSION_TITLE,
        message: `The step ${view.stepName} of ${flowName} is paused until someone answers.`,
        deadline: new Date(view.deadline).toUTCString(),
        permission: {
            tool: view.permission?.permission ?? '',
            patterns: (view.permission?.patterns ?? []).join('\n'),
            maxNoteLength: OPENCODE_ASK_NOTE_MAX_LENGTH,
        },
    }
}

function answerOf({ ask, action, body }: { ask: OpencodeAsk, action: string | undefined, body: unknown }): AnswerOpencodeAskRequest | null {
    const form = FormBody.safeParse(body).data ?? {}
    if (ask.kind === OpencodeAskKind.PERMISSION) {
        const decision = Object.values(OpencodePermissionDecision).find((candidate) => candidate === action)
        if (isNil(decision)) {
            return null
        }
        const note = typeof form['note'] === 'string' ? form['note'].slice(0, OPENCODE_ASK_NOTE_MAX_LENGTH) : undefined
        return { type: 'permission', decision, ...(isNil(note) || note.length === 0 ? {} : { note }) }
    }
    if (action === DISMISS_ACTION) {
        return { type: 'dismiss' }
    }
    if (action !== ANSWER_ACTION) {
        return null
    }
    const answers = (ask.questions ?? []).map((_question, index) => {
        const chosen = form[`q${index}`]
        const picked = Array.isArray(chosen) ? chosen : isNil(chosen) ? [] : [chosen]
        const typed = form[`q${index}_text`]
        const custom = typeof typed === 'string' && typed.trim().length > 0 ? [typed.trim()] : []
        return [...picked, ...custom]
    })
    return { type: 'question', answers }
}

function errorMessageOf({ error }: { error: unknown }): string {
    const parsed = error instanceof ActivepiecesError ? ErrorParams.safeParse(error.error.params) : undefined
    return parsed?.data?.message ?? CLOSED_MESSAGE
}

async function replyWithPage({ reply, page, platformId, log, status = StatusCodes.OK }: ReplyWithPageParams): Promise<void> {
    const theme = await resumePageHooks.get(log).getTheme({ platformId })
    const html = Mustache.render(PAGE_HTML_TEMPLATE, {
        websiteName: theme.websiteName,
        fullLogoUrl: theme.logos.fullLogoUrl,
        primaryColor: theme.colors.primary.default,
        ...page,
    })
    await reply
        .status(status)
        .type('text/html')
        .header('Content-Security-Policy', PAGE_CSP)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'no-store')
        .send(html)
}

const DISMISS_ACTION = 'dismiss'

const ANSWER_ACTION = 'answer'

const PERMISSION_TITLE = 'An agent asks for permission'

const QUESTION_TITLE = 'An agent has a question'

const RECORDED_TITLE = 'Answer recorded'

const RECORDED_MESSAGE = 'Your answer was sent to the agent. You can close this page now.'

const CLOSED_TITLE = 'Already answered'

const CLOSED_MESSAGE = 'Someone already answered this request, or it is no longer waiting.'

const INVALID_TITLE = 'Link not valid'

const INVALID_MESSAGE = 'This approval link is not valid or has expired.'

const PAGE_CSP = 'default-src \'none\'; style-src \'unsafe-inline\'; form-action \'self\'; img-src \'self\' https: http: data:'

const PAGE_STYLE = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a; background: #fafafa; }
    .card { width: 520px; max-width: 100%; background: #fff; border: 1px solid #e5e5e5; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); padding: 28px 32px; }
    .logo { height: 24px; margin-bottom: 22px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    p { font-size: 14px; line-height: 1.55; color: #525252; margin: 0 0 16px; }
    .muted { font-size: 12px; color: #737373; }
    pre { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 12px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; margin: 0 0 16px; }
    label { font-size: 13px; color: #404040; }
    textarea, input[type=text] { width: 100%; padding: 8px 10px; border: 1px solid #e5e5e5; border-radius: 8px; font-family: inherit; font-size: 13px; margin: 6px 0 16px; }
    textarea { min-height: 64px; resize: vertical; }
    .question { margin-bottom: 16px; }
    .option { display: block; margin: 4px 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .btn { flex: 1 1 45%; height: 36px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; color: #fff; cursor: pointer; }
    .btn-plain { background: #fff; color: #0a0a0a; border: 1px solid #e5e5e5; }
    .btn-destructive { background: #ef4444; }
`

const PAGE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{websiteName}}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<div class="card">
{{#fullLogoUrl}}<img class="logo" src="{{fullLogoUrl}}" alt="{{websiteName}}">{{/fullLogoUrl}}
<h1>{{title}}</h1>
<p>{{message}}</p>
{{#permission}}
<p class="muted">Tool</p>
<pre>{{tool}}</pre>
<p class="muted">What it wants to do</p>
<pre>{{patterns}}</pre>
<form method="POST">
<label for="note">Reason (sent to the agent when you deny)</label>
<textarea id="note" name="note" maxlength="{{maxNoteLength}}"></textarea>
<div class="actions">
<button type="submit" class="btn" style="background:{{primaryColor}}" formaction="?token={{token}}&action=allow">Allow once</button>
<button type="submit" class="btn btn-plain" formaction="?token={{token}}&action=allow-session">Allow for this run</button>
<button type="submit" class="btn btn-plain" formaction="?token={{token}}&action=allow-agent">Allow for this agent</button>
<button type="submit" class="btn btn-destructive" formaction="?token={{token}}&action=deny">Deny</button>
</div>
</form>
{{/permission}}
{{#questions.length}}
<form method="POST">
{{#questions}}
<div class="question">
<p class="muted">{{header}}</p>
<p>{{question}}</p>
{{#options}}<label class="option"><input type="{{inputType}}" name="q{{index}}" value="{{label}}"> {{label}}{{#description}} — {{description}}{{/description}}</label>{{/options}}
{{#custom}}<input type="text" name="q{{index}}_text" placeholder="Or type your own answer">{{/custom}}
</div>
{{/questions}}
<div class="actions">
<button type="submit" class="btn" style="background:{{primaryColor}}" formaction="?token={{token}}&action=answer">Answer</button>
<button type="submit" class="btn btn-plain" formaction="?token={{token}}&action=dismiss">Dismiss</button>
</div>
</form>
{{/questions.length}}
{{#deadline}}<p class="muted">If nobody answers by {{deadline}}, the step fails.</p>{{/deadline}}
</div>
</body>
</html>`

const ErrorParams = z.object({ message: z.string() })

const FormBody = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

const AskLinkRequest = {
    config: {
        security: securityAccess.public(),
    },
    schema: {
        querystring: z.object({ token: z.string(), action: z.string().optional() }),
        hide: true,
    },
}

type LinkedAsk = {
    view: OpencodeAsk
    platformId: string
    projectId: string
}

type ReplyWithPageParams = {
    reply: FastifyReply
    page: Page
    platformId: string | null
    log: FastifyBaseLogger
    status?: number
}

type Page = {
    token?: string
    title: string
    message: string
    success?: boolean
    deadline?: string
    permission?: { tool: string, patterns: string, maxNoteLength: number }
    questions?: { index: number, header: string, question: string, inputType: string, options: { label: string, description: string }[], custom: boolean }[]
}
