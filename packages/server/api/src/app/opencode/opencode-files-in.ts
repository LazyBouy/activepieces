import { isUtf8 } from 'node:buffer'
import { isNil } from '@activepieces/core-utils'
import { AiStepFile, FileType } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import mime from 'mime-types'
import { fileService } from '../file/file.service'
import { OpencodeStepRow } from './opencode-step.entity'

async function read({ step, files, log }: ReadParams): Promise<OpencodeInputFile[]> {
    return Promise.all(files.map(async (file) => {
        const stored = await fileService(log).getDataOrThrow({ projectId: step.projectId, platformId: step.platformId, fileId: file.fileId, type: FileType.FLOW_STEP_FILE })
        const filename = file.filename ?? stored.fileName
        return {
            mime: file.mimeType ?? mimeTypeOf({ metadata: stored.metadata }) ?? mimeOfName({ filename }) ?? DEFAULT_MIME,
            data: stored.data,
            ...(isNil(filename) ? {} : { filename }),
        }
    }))
}

function partOf({ file }: { file: OpencodeInputFile }): OpencodeFilePart {
    const mime = isTextLike({ mime: file.mime }) && isUtf8(file.data) ? TEXT_MIME : file.mime
    return {
        type: 'file',
        mime,
        url: `data:${mime};base64,${file.data.toString('base64')}`,
        ...(isNil(file.filename) ? {} : { filename: file.filename }),
    }
}

function isTextLike({ mime }: { mime: string }): boolean {
    const base = mime.split(';')[0].trim().toLowerCase()
    return base.startsWith('text/') || TEXT_MIMES.includes(base) || base.endsWith('+json') || base.endsWith('+xml')
}

function mimeTypeOf({ metadata }: { metadata: Record<string, unknown> | null | undefined }): string | undefined {
    const value = metadata?.['mimeType'] ?? metadata?.['mimetype']
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

function mimeOfName({ filename }: { filename: string | undefined | null }): string | undefined {
    if (isNil(filename)) {
        return undefined
    }
    const found = mime.lookup(filename)
    return found === false ? undefined : found
}

const TEXT_MIME = 'text/plain'

const DEFAULT_MIME = 'application/octet-stream'

const TEXT_MIMES = [
    'application/json',
    'application/ld+json',
    'application/x-ndjson',
    'application/xml',
    'application/yaml',
    'application/x-yaml',
    'application/toml',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/sql',
    'application/csv',
    'application/x-sh',
    'application/x-httpd-php',
    'application/graphql',
]

export const opencodeFilesIn = {
    read,
    partOf,
}

export type OpencodeInputFile = {
    mime: string
    data: Buffer
    filename?: string
}

export type OpencodeFilePart = {
    type: 'file'
    mime: string
    url: string
    filename?: string
}

type ReadParams = {
    step: OpencodeStepRow
    files: AiStepFile[]
    log: FastifyBaseLogger
}
