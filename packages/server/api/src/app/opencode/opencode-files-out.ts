import path from 'node:path'
import { isNil } from '@activepieces/core-utils'
import { FileCompression, FileType } from '@activepieces/shared'
import { OpencodeClient, Part } from '@opencode-ai/sdk/v2/client'
import { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { repoFactory } from '../core/db/repo-factory'
import { fileService } from '../file/file.service'
import { filesService } from '../file/files-service'
import { system } from '../helper/system/system'
import { AppSystemProp } from '../helper/system/system-props'
import { opencodeErrors, OpencodeRequestError } from './opencode-errors'
import { OpencodeReplyMessage } from './opencode-reply'
import { OpencodeStepEntity, OpencodeStepFiles, OpencodeStepRow } from './opencode-step.entity'

const stepRepo = repoFactory(OpencodeStepEntity)

export const opencodeFilesOut = (log: FastifyBaseLogger) => ({
    async ensure({ step, client, replies }: EnsureParams): Promise<OpencodeStepFiles> {
        if (!isNil(step.files)) {
            return step.files
        }
        const collected = await collect({ step, client, replies, log })
        await stepRepo().update({ id: step.id }, { files: collected })
        log.info({ opencodeStep: { id: step.id }, filesCount: collected.files.length, skippedCount: collected.skippedFiles.length }, '[opencodeFilesOut] Saved the files the agent wrote')
        return collected
    },
})

async function collect({ step, client, replies, log }: CollectParams): Promise<OpencodeStepFiles> {
    if (isNil(step.directory) || isNil(step.sessionId)) {
        return { files: [], skippedFiles: [] }
    }
    const folder = opencodeOutputFolder.of({ stepId: step.id })
    const changed = await changedInFolder({ step, sessionId: step.sessionId, directory: step.directory, folder, client })
    const written = writtenByTools({ replies, directory: step.directory })
    const paths = [...new Set([...changed, ...written.inside])]
    const outside = written.outside.map((filePath) => ({ name: filePath, reason: OUTSIDE }))
    const overflow = paths.slice(MAX_FILES).map((filePath) => ({ name: nameOf({ filePath, folder }), reason: `more than ${MAX_FILES} files` }))
    const maxBytes = system.getNumberOrThrow(AppSystemProp.MAX_FILE_SIZE_MB) * BYTES_PER_MB
    const results: SaveResult[] = []
    for (const filePath of paths.slice(0, MAX_FILES)) {
        results.push(await saveOne({ step, directory: step.directory, filePath, name: nameOf({ filePath, folder }), maxBytes, client, log }))
    }
    return {
        files: results.flatMap((result) => result.kind === 'saved' ? [result.file] : []),
        skippedFiles: [...results.flatMap((result) => result.kind === 'skipped' ? [result.skipped] : []), ...overflow, ...outside],
    }
}

async function changedInFolder({ step, sessionId, directory, folder, client }: ChangedParams): Promise<string[]> {
    const diff = await client.session.diff({ sessionID: sessionId, directory, messageID: step.messageId })
    if (isNil(diff.data)) {
        throw new OpencodeRequestError({ status: diff.response?.status, message: opencodeErrors.describe({ error: diff.error }) })
    }
    return diff.data.flatMap((entry) => !isNil(entry.file) && entry.status !== 'deleted' && entry.file.startsWith(`${folder}/`) ? [entry.file] : [])
}

function writtenByTools({ replies, directory }: { replies: OpencodeReplyMessage[], directory: string }): { inside: string[], outside: string[] } {
    const absolute = replies.flatMap(({ parts }) => parts.flatMap((part) => writtenPaths({ part }))).map((filePath) => path.resolve(directory, filePath))
    const relative = absolute.map((filePath) => ({ filePath, relative: path.relative(directory, filePath) }))
    return {
        inside: relative.filter(isInsideProject).map(({ relative: candidate }) => candidate),
        outside: [...new Set(relative.filter((entry) => !isInsideProject(entry)).map(({ filePath }) => filePath))],
    }
}

function isInsideProject({ relative }: { relative: string }): boolean {
    return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function writtenPaths({ part }: { part: Part }): string[] {
    if (part.type !== 'tool' || part.state.status !== 'completed') {
        return []
    }
    if (WRITING_TOOLS.includes(part.tool)) {
        const input = WrittenInput.safeParse(part.state.input)
        return input.success ? [input.data.filePath] : []
    }
    if (part.tool === PATCH_TOOL) {
        const metadata = PatchMetadata.safeParse(part.state.metadata)
        return metadata.success ? metadata.data.files.filter((file) => file.type !== 'delete').map((file) => file.movePath ?? file.filePath) : []
    }
    return []
}

async function saveOne({ step, directory, filePath, name, maxBytes, client, log }: SaveOneParams): Promise<SaveResult> {
    const read = await client.operator.projectFile.raw({ directory, path: filePath, maxBytes: String(maxBytes) })
    if (isNil(read.data)) {
        const status = read.response?.status
        if (isNil(status)) {
            throw new OpencodeRequestError({ status, message: opencodeErrors.describe({ error: read.error }) })
        }
        const reason = SKIP_REASONS[status]
        return { kind: 'skipped', skipped: { name, reason: isNil(reason) ? `could not be read: ${opencodeErrors.describe({ error: read.error })}` : reason({ maxBytes }) } }
    }
    const data = Buffer.from(read.data.content, 'base64')
    const saved = await fileService(log).save({
        projectId: step.projectId,
        platformId: step.platformId,
        type: FileType.FLOW_STEP_FILE,
        fileName: path.basename(filePath),
        data,
        size: data.length,
        compression: FileCompression.NONE,
        metadata: { mimetype: read.data.mime },
    })
    const url = await filesService.constructReadUrl({ fileId: saved.id, fileType: FileType.FLOW_STEP_FILE, platformId: step.platformId })
    return { kind: 'saved', file: { name, url, size: data.length } }
}

function nameOf({ filePath, folder }: { filePath: string, folder: string }): string {
    return filePath.startsWith(`${folder}/`) ? filePath.slice(folder.length + 1) : filePath
}

function of({ stepId }: { stepId: string }): string {
    return `${OUTPUT_ROOT}/${stepId}`
}

const OUTPUT_ROOT = 'out'

const MAX_FILES = 50

const BYTES_PER_MB = 1024 * 1024

const OUTSIDE = 'outside the project folder'

const WRITING_TOOLS = ['write', 'edit']

const PATCH_TOOL = 'apply_patch'

const SKIP_REASONS: Record<number, (params: { maxBytes: number }) => string> = {
    400: () => OUTSIDE,
    404: () => 'no longer exists',
    413: ({ maxBytes }) => `larger than ${maxBytes / BYTES_PER_MB} MB`,
}

const WrittenInput = z.object({ filePath: z.string() })

const PatchMetadata = z.object({
    files: z.array(z.object({ filePath: z.string(), type: z.string(), movePath: z.string().optional() })),
})

export const opencodeOutputFolder = {
    of,
}

type SaveResult =
    | { kind: 'saved', file: OpencodeStepFiles['files'][number] }
    | { kind: 'skipped', skipped: OpencodeStepFiles['skippedFiles'][number] }

type EnsureParams = {
    step: OpencodeStepRow
    client: OpencodeClient
    replies: OpencodeReplyMessage[]
}

type CollectParams = EnsureParams & {
    log: FastifyBaseLogger
}

type ChangedParams = {
    step: OpencodeStepRow
    sessionId: string
    directory: string
    folder: string
    client: OpencodeClient
}

type SaveOneParams = {
    step: OpencodeStepRow
    directory: string
    filePath: string
    name: string
    maxBytes: number
    client: OpencodeClient
    log: FastifyBaseLogger
}
