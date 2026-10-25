import http from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { opencodeClient } from '../../../../src/app/opencode/opencode-client'

describe('opencodeClient', () => {
    const received: ReceivedRequest[] = []
    let server: http.Server
    let baseUrl: string

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            readBody({ req }).then((body) => {
                received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body })
                respond({ req, res, body })
            }).catch(() => res.destroy())
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        baseUrl = `http://127.0.0.1:${portOf({ address: server.address() })}`
    })

    afterAll(async () => {
        server.closeAllConnections()
        await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    it('reaches the server through the safe transport with basic auth', async () => {
        const client = await opencodeClient.create({ baseUrl, password: 'secret' })

        const result = await client.global.health()

        expect(result.data).toEqual({ healthy: true, version: 'stub' })
        expect(lastRequest({ received, url: '/global/health' }).headers.authorization).toBe(`Basic ${Buffer.from('opencode:secret').toString('base64')}`)
    })

    it('sends no authorization header when no password is set', async () => {
        const client = await opencodeClient.create({ baseUrl })

        await client.global.health()

        expect(lastRequest({ received, url: '/global/health' }).headers.authorization).toBeUndefined()
    })

    it('sends request bodies and the directory, and parses JSON replies', async () => {
        const client = await opencodeClient.create({ baseUrl, directory: '/work/project-a' })

        const result = await client.session.create({ title: 'flow · run 1 · step_1' })

        expect(result.data).toMatchObject({ id: 'ses_1', title: 'flow · run 1 · step_1' })
        expect(lastRequest({ received, url: '/session' }).headers['x-opencode-directory']).toBe(encodeURIComponent('/work/project-a'))
    })

    it('handles replies without a body', async () => {
        const client = await opencodeClient.create({ baseUrl })

        const result = await client.session.promptAsync({ sessionID: 'ses_1', parts: [{ type: 'text', text: 'hello' }] })

        expect(result.response.status).toBe(204)
        expect(result.error).toBeUndefined()
        expect(JSON.parse(lastRequest({ received, url: '/session/ses_1/prompt_async' }).body)).toMatchObject({ parts: [{ type: 'text', text: 'hello' }] })
    })

    it('streams server-sent events', async () => {
        const client = await opencodeClient.create({ baseUrl })
        const { stream } = await client.global.event()
        const types: string[] = []

        for await (const event of stream) {
            types.push(event.payload.type)
            if (types.length === 2) {
                break
            }
        }

        expect(types).toEqual(['server.connected', 'session.idle'])
    })

    it('never follows a redirect away from the OpenCode server', async () => {
        const client = await opencodeClient.create({ baseUrl })

        const result = await client.global.health({ headers: { 'x-test-redirect': '1' } })

        expect(result.response.status).toBe(302)
        expect(received.some((request) => request.url.startsWith('/elsewhere'))).toBe(false)
    })
})

function respond({ req, res, body }: { req: http.IncomingMessage, res: http.ServerResponse, body: string }): void {
    const path = (req.url ?? '').split('?')[0]
    if (req.headers['x-test-redirect'] === '1') {
        res.writeHead(302, { Location: 'http://10.0.0.1/elsewhere' })
        res.end()
        return
    }
    if (req.method === 'GET' && path === '/global/health') {
        sendJson({ res, value: { healthy: true, version: 'stub' } })
        return
    }
    if (req.method === 'POST' && path === '/session') {
        sendJson({ res, value: { id: 'ses_1', ...JSON.parse(body) } })
        return
    }
    if (req.method === 'POST' && path === '/session/ses_1/prompt_async') {
        res.writeHead(204)
        res.end()
        return
    }
    if (req.method === 'GET' && path === '/global/event') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
        res.write(`data: ${JSON.stringify({ directory: 'global', payload: { type: 'server.connected', properties: {} } })}\n\n`)
        res.write(`data: ${JSON.stringify({ directory: '/work/project-a', payload: { type: 'session.idle', properties: { sessionID: 'ses_1' } } })}\n\n`)
        res.end()
        return
    }
    res.writeHead(404)
    res.end()
}

function sendJson({ res, value }: { res: http.ServerResponse, value: unknown }): void {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(value))
}

function readBody({ req }: { req: http.IncomingMessage }): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function portOf({ address }: { address: string | AddressInfo | null }): number {
    if (address === null || typeof address === 'string') {
        throw new Error('the stub server has no TCP address')
    }
    return address.port
}

function lastRequest({ received, url }: { received: ReceivedRequest[], url: string }): ReceivedRequest {
    const matches = received.filter((request) => request.url.split('?')[0] === url)
    const match = matches[matches.length - 1]
    if (match === undefined) {
        throw new Error(`no request to ${url}`)
    }
    return match
}

type ReceivedRequest = {
    method: string
    url: string
    headers: http.IncomingHttpHeaders
    body: string
}
