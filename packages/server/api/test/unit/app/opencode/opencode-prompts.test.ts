import { AiStepAction } from '@activepieces/core-utils'
import { AiRouterMatchMode } from '@activepieces/shared'
import { opencodeIds } from '../../../../src/app/opencode/opencode-ids'
import { opencodePrompts } from '../../../../src/app/opencode/opencode-prompts'

describe('opencodePrompts.build', () => {
    it('builds the upstream Summarize prompt as visible text with no output format', () => {
        const built = opencodePrompts.build({ request: { action: AiStepAction.SUMMARIZE_TEXT, prompt: 'Two lines.', text: 'A long story' }, files: [] })

        expect(built).toEqual({ parts: [{ type: 'text', text: 'Two lines. Summarize the following text : A long story' }] })
    })

    it('sends a plain Ask AI prompt unchanged and ignores conversation entries without text', () => {
        const built = opencodePrompts.build({
            request: { action: AiStepAction.ASK_AI, prompt: 'Next?', conversation: [{ role: 'system', content: [] }] },
            files: [],
        })

        expect(built).toEqual({ parts: [{ type: 'text', text: 'Next?' }] })
    })

    it('reads text parts from structured conversation content', () => {
        const built = opencodePrompts.build({
            request: { action: AiStepAction.ASK_AI, prompt: 'And now?', conversation: [{ role: 'user', content: [{ type: 'text', text: 'First' }, { type: 'image', image: 'x' }] }] },
            files: [],
        })

        expect(built.parts).toEqual([{ type: 'text', text: 'Earlier in this conversation:\nUser: First\n\nAnd now?' }])
    })

    it('passes an advanced Extract schema through and attaches images, PDFs and text files but not other binaries', () => {
        const schema = { type: 'object', properties: { total: { type: 'number' } } }
        const built = opencodePrompts.build({
            request: { action: AiStepAction.EXTRACT_STRUCTURED_DATA, prompt: 'Find the total', schema: { mode: 'advanced', fields: schema } },
            files: [
                { mime: 'image/png', base64: 'aW1n', filename: 'receipt.png' },
                { mime: 'application/pdf', base64: 'cGRm' },
                { mime: 'text/csv', base64: 'YSxi' },
                { mime: 'application/zip', base64: 'emlw' },
            ],
        })

        expect(built.format).toEqual({ type: 'json_schema', schema })
        expect(built.parts).toEqual([
            { type: 'text', text: 'Find the total' },
            { type: 'file', mime: 'image/png', url: 'data:image/png;base64,aW1n', filename: 'receipt.png' },
            { type: 'file', mime: 'application/pdf', url: 'data:application/pdf;base64,cGRm' },
            { type: 'file', mime: 'text/csv', url: 'data:text/csv;base64,YSxi' },
        ])
    })

    it('refuses actions that never run on OpenCode', () => {
        expect(() => opencodePrompts.build({ request: { action: AiStepAction.GENERATE_IMAGE }, files: [] })).toThrow('GENERATE_IMAGE does not run on OpenCode')
    })
})

describe('opencodePrompts.mapReply', () => {
    it('returns the OpenCode error as the step failure', () => {
        const answer = opencodePrompts.mapReply({ request: { action: AiStepAction.ASK_AI }, reply: { text: '', structured: undefined, error: 'Rate limited' } })

        expect(answer).toEqual({ failure: 'OpenCode stopped with an error: Rate limited.' })
    })

    it('fails Classify when the structured answer has no category', () => {
        const answer = opencodePrompts.mapReply({ request: { action: AiStepAction.CLASSIFY_TEXT, categories: ['a'] }, reply: { text: 'a', structured: { label: 'a' } } })

        expect(answer).toEqual({ failure: 'The model did not return the requested structured output.' })
    })

    it('keeps an advanced Extract answer as it is', () => {
        const answer = opencodePrompts.mapReply({
            request: { action: AiStepAction.EXTRACT_STRUCTURED_DATA, schema: { mode: 'advanced', fields: { type: 'object' } } },
            reply: { text: '', structured: { total: 12 } },
        })

        expect(answer).toEqual({ output: { answer: { total: 12 } } })
    })
})

describe('opencodePrompts router answers', () => {
    const options = { Billing: 'Payments', Technical: 'Bugs', Sales: 'New customers' }

    it('matches every route at 0.5 or above, clamps the probabilities and skips routes the model left out', () => {
        const answer = opencodePrompts.mapReply({
            request: { action: AiStepAction.ROUTE, options, matchMode: AiRouterMatchMode.ALL_MATCHES },
            reply: { text: '', structured: { probabilities: { r0: 0.5, r1: -0.3, r9: 0.9 } } },
        })

        expect(answer).toEqual({ output: { matched: ['Billing'], probabilities: { Billing: 0.5, Technical: 0 } } })
    })

    it('fails an all-matches answer that rates no known route', () => {
        const answer = opencodePrompts.mapReply({
            request: { action: AiStepAction.ROUTE, options, matchMode: AiRouterMatchMode.ALL_MATCHES },
            reply: { text: '', structured: { probabilities: { r9: 0.9 } } },
        })

        expect(answer).toEqual({ failure: 'The routing model did not answer the routing question' })
    })

    it('fails a best-match answer that carries no structured output', () => {
        const answer = opencodePrompts.mapReply({
            request: { action: AiStepAction.ROUTE, options, matchMode: AiRouterMatchMode.BEST_MATCH },
            reply: { text: 'Billing', structured: undefined },
        })

        expect(answer).toEqual({ failure: 'The model did not return the requested structured output.' })
    })

    it('asks an all-matches router for one probability per route, several of which can apply', () => {
        const built = opencodePrompts.build({ request: { action: AiStepAction.ROUTE, question: 'Who?', state: 'Hi', options: { A: 'a' }, matchMode: AiRouterMatchMode.ALL_MATCHES }, files: [] })

        expect(built).toEqual({
            parts: [{ type: 'text', text: 'Who?\n\nRoutes:\nr0: A — a\n\nGive each route the probability (0 to 1) that it applies to the input. More than one route can apply.\n\nInput:\nHi' }],
            format: {
                type: 'json_schema',
                schema: {
                    type: 'object',
                    properties: {
                        probabilities: {
                            type: 'object',
                            properties: { r0: { type: 'number', description: 'Probability from 0 to 1 for A' } },
                            required: ['r0'],
                            additionalProperties: false,
                        },
                    },
                    required: ['probabilities'],
                    additionalProperties: false,
                },
            },
        })
    })
})

describe('opencodeIds.message', () => {
    it('makes OpenCode message ids that sort in creation order', () => {
        const first = opencodeIds.message({ now: 1_700_000_000_000 })
        const second = opencodeIds.message({ now: 1_700_000_000_000 })
        const later = opencodeIds.message({ now: 1_700_000_000_001 })

        expect(first).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
        expect(first.slice(0, 16) < second.slice(0, 16)).toBe(true)
        expect(second.slice(0, 16) < later.slice(0, 16)).toBe(true)
    })

    it('encodes the time the way OpenCode reads it back', () => {
        const now = 1_792_966_094_397
        const id = opencodeIds.message({ now })
        const encoded = BigInt(`0x${id.slice(4, 16)}`)

        expect(Number(encoded / BigInt(0x1000)) % 2 ** 36).toBe(now % 2 ** 36)
    })
})
