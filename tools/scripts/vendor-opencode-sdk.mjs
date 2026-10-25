import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '../..')

const OUTPUT_DIR = join(REPO_ROOT, 'packages/vendor/opencode-sdk')

const TYPESCRIPT_COMPILER = join(REPO_ROOT, 'node_modules/typescript/bin/tsc')

const DEFAULT_SOURCE = resolve(REPO_ROOT, '../opencode')

const SOURCE_FILES = ['src/v2/client.ts', 'src/v2/gen', 'src/error-interceptor.ts']

const TSCONFIG = {
    compilerOptions: {
        target: 'es2022',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        lib: ['es2022', 'dom', 'dom.iterable'],
        types: [],
        strict: true,
        declaration: true,
        skipLibCheck: true,
        rootDir: 'src',
        outDir: 'dist',
    },
    include: ['src'],
}

function main() {
    const { source, commit } = readArgs(process.argv.slice(2))
    const sdkRoot = join(source, 'packages/sdk/js')
    const sdkManifest = JSON.parse(readFileSync(join(sdkRoot, 'package.json'), 'utf8'))
    const stage = mkdtempSync(join(tmpdir(), 'opencode-sdk-'))

    copySources({ sdkRoot, stage })
    writeFileSync(join(stage, 'package.json'), JSON.stringify({ type: 'commonjs' }))
    writeFileSync(join(stage, 'tsconfig.json'), JSON.stringify(TSCONFIG, null, 2))
    execFileSync(process.execPath, [TYPESCRIPT_COMPILER, '-p', join(stage, 'tsconfig.json')], { stdio: 'inherit' })
    rmSync(join(stage, 'src'), { recursive: true, force: true })
    rmSync(join(stage, 'tsconfig.json'), { force: true })
    cpSync(join(source, 'LICENSE'), join(stage, 'LICENSE'))
    const contentHash = hashDirectory(join(stage, 'dist'))
    writeFileSync(join(stage, 'package.json'), JSON.stringify(buildManifest({ version: sdkManifest.version, commit, contentHash }), null, 2))

    mkdirSync(OUTPUT_DIR, { recursive: true })
    removeOldTarballs()
    execFileSync(process.execPath, ['pm', 'pack', '--destination', OUTPUT_DIR], { cwd: stage, stdio: 'inherit' })
    rmSync(stage, { recursive: true, force: true })

    const tarballs = readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.tgz'))
    process.stdout.write(`vendored ${tarballs.join(', ')} from ${source} at ${commit}\n`)
}

function readArgs(args) {
    const values = { source: DEFAULT_SOURCE, commit: undefined }
    for (let index = 0; index < args.length; index += 2) {
        const flag = args[index]
        const value = args[index + 1]
        if (flag === '--source') {
            values.source = resolve(value)
        }
        else if (flag === '--commit') {
            values.commit = value
        }
        else {
            throw new Error(`Unknown argument ${flag}. Usage: vendor-opencode-sdk.mjs --commit <sha> [--source <opencode repo>]`)
        }
    }
    if (!values.commit || !/^[0-9a-f]{7,40}$/.test(values.commit)) {
        throw new Error('Pass --commit with the OpenCode commit the SDK is built from (git -C <opencode repo> rev-parse --short=10 HEAD).')
    }
    return values
}

function copySources({ sdkRoot, stage }) {
    for (const relativePath of SOURCE_FILES) {
        cpSync(join(sdkRoot, relativePath), join(stage, relativePath), { recursive: true })
    }
}

function hashDirectory(directory) {
    const hash = createHash('sha256')
    for (const file of listFiles(directory).sort()) {
        hash.update(relative(directory, file))
        hash.update(readFileSync(file))
    }
    return hash.digest('hex').slice(0, 8)
}

function listFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? listFiles(path) : [path]
    })
}

function buildManifest({ version, commit, contentHash }) {
    return {
        name: '@opencode-ai/sdk',
        version: `${version}-iphi-${commit}-${contentHash}`,
        description: `OpenCode SDK v2 client, built as CommonJS from the i-Phi fork at ${commit} for iphi-flow`,
        type: 'commonjs',
        license: 'MIT',
        exports: {
            './v2/client': {
                types: './dist/v2/client.d.ts',
                default: './dist/v2/client.js',
            },
            './package.json': './package.json',
        },
        typesVersions: {
            '*': {
                'v2/client': ['./dist/v2/client.d.ts'],
            },
        },
        files: ['dist', 'LICENSE'],
    }
}

function removeOldTarballs() {
    for (const name of readdirSync(OUTPUT_DIR)) {
        if (name.endsWith('.tgz')) {
            rmSync(join(OUTPUT_DIR, name))
        }
    }
}

main()
