import dns from 'node:dns/promises'
import { isIP } from 'node:net'
import { Readable } from 'node:stream'
import { safeHttp } from '@activepieces/server-utils'
import { isNil } from '@activepieces/shared'
import { createOpencodeClient, OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { AxiosInstance, AxiosResponse } from 'axios'

async function create({ baseUrl, username, password, directory }: CreateOpencodeClientParams): Promise<OpencodeClient> {
    const allowList = await addressesOf({ url: baseUrl })
    const transport = safeHttp.createAxios({ maxRedirects: 0 }, { extraAllowList: allowList })
    return createOpencodeClient({
        baseUrl,
        directory,
        fetch: buildFetch({ transport }),
        headers: isNil(password) || password.length === 0
            ? {}
            : { Authorization: basicAuthorization({ username: username ?? DEFAULT_USERNAME, password }) },
    })
}

async function addressesOf({ url }: { url: string }): Promise<string[]> {
    const hostname = new URL(url).hostname.replace(/^\[(.*)\]$/, '$1')
    if (isIP(hostname) !== 0) {
        return [hostname]
    }
    const resolved = await dns.lookup(hostname, { all: true })
    return resolved.map((entry) => entry.address)
}

function buildFetch({ transport }: { transport: AxiosInstance }): typeof fetch {
    return async (input, init) => {
        const request = new Request(input, init)
        const response = await transport.request<Readable>({
            url: request.url,
            method: request.method,
            headers: toRecord({ headers: request.headers }),
            data: request.body === null ? undefined : Buffer.from(await request.arrayBuffer()),
            responseType: 'stream',
            validateStatus: () => true,
            signal: request.signal,
        })
        return toResponse({ method: request.method, response })
    }
}

function toResponse({ method, response }: { method: string, response: AxiosResponse<Readable> }): Response {
    const init = { status: response.status, statusText: response.statusText, headers: toHeaders({ response }) }
    if (method === 'HEAD' || NULL_BODY_STATUSES.includes(response.status)) {
        response.data.destroy()
        return new Response(null, init)
    }
    return new Response(toWebStream({ stream: response.data }), init)
}

function toWebStream({ stream }: { stream: Readable }): ReadableStream<Uint8Array> {
    const chunks = stream[Symbol.asyncIterator]()
    return new ReadableStream<Uint8Array>({
        async pull(controller): Promise<void> {
            const { value, done } = await chunks.next()
            if (done === true) {
                controller.close()
                return
            }
            controller.enqueue(Buffer.isBuffer(value) ? value : Buffer.from(String(value)))
        },
        cancel(): void {
            stream.destroy()
        },
    })
}

function toRecord({ headers }: { headers: Headers }): Record<string, string> {
    const record: Record<string, string> = {}
    headers.forEach((value, name) => {
        record[name] = value
    })
    return record
}

function toHeaders({ response }: { response: AxiosResponse<Readable> }): Headers {
    const headers = new Headers()
    for (const [name, value] of Object.entries(response.headers)) {
        if (isNil(value)) {
            continue
        }
        for (const item of Array.isArray(value) ? value : [value]) {
            headers.append(name, String(item))
        }
    }
    return headers
}

function basicAuthorization({ username, password }: { username: string, password: string }): string {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

const DEFAULT_USERNAME = 'opencode'

const NULL_BODY_STATUSES = [101, 103, 204, 205, 304]

export const opencodeClient = {
    create,
}

export type CreateOpencodeClientParams = {
    baseUrl: string
    username?: string
    password?: string
    directory?: string
}
