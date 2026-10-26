import { randomBytes } from 'node:crypto'

function message({ now = Date.now() }: { now?: number } = {}): string {
    return ascending({ prefix: MESSAGE_PREFIX, now })
}

function ascending({ prefix, now }: { prefix: string, now: number }): string {
    const counter = nextCounter({ now })
    const encoded = BigInt(now) * BigInt(COUNTER_SPACE) + BigInt(counter)
    const timeBytes = Buffer.alloc(TIME_BYTES)
    for (let index = 0; index < TIME_BYTES; index++) {
        timeBytes[index] = Number((encoded >> BigInt(8 * (TIME_BYTES - 1 - index))) & BigInt(0xff))
    }
    return `${prefix}_${timeBytes.toString('hex')}${randomBase62({ length: RANDOM_LENGTH })}`
}

function nextCounter({ now }: { now: number }): number {
    if (now !== state.lastTimestamp) {
        state.lastTimestamp = now
        state.counter = 0
    }
    state.counter++
    return state.counter
}

function randomBase62({ length }: { length: number }): string {
    const bytes = randomBytes(length)
    return Array.from(bytes, (byte) => BASE62[byte % BASE62.length]).join('')
}

const state = { lastTimestamp: 0, counter: 0 }

const MESSAGE_PREFIX = 'msg'

const COUNTER_SPACE = 0x1000

const TIME_BYTES = 6

const RANDOM_LENGTH = 14

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export const opencodeIds = {
    message,
}
