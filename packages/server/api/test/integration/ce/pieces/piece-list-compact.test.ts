import { TriggerStrategy, TriggerTestStrategy } from '@activepieces/core-piece-types'
import { apId } from '@activepieces/core-utils'
import { ActionBase, PieceAuth, Property } from '@activepieces/pieces-framework'
import { PackageType, PieceType, PrincipalType } from '@activepieces/shared'
import { FastifyBaseLogger, FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { databaseConnection } from '../../../../src/app/database/database-connection'
import { pieceCache } from '../../../../src/app/pieces/metadata/piece-cache'
import { generateMockToken } from '../../../helpers/auth'
import { db } from '../../../helpers/db'
import { createMockPieceMetadata } from '../../../helpers/mocks'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../helpers/test-setup'

let app: FastifyInstance | null = null
let mockLog: FastifyBaseLogger

beforeAll(async () => {
    app = await setupTestEnvironment()
    mockLog = app!.log!
})

afterAll(async () => {
    await teardownTestEnvironment()
})

beforeEach(async () => {
    await databaseConnection().getRepository('piece_metadata').createQueryBuilder().delete().execute()
})

describe('GET /v1/pieces with compactSuggestions', () => {
    it('keeps the full suggestions by default', async () => {
        await savePiece()

        const entry = await listEntry({ query: 'suggestionType=ACTION' })

        const [action] = entry.suggestedActions
        expect(action.outputSchema).toEqual(OUTPUT_SCHEMA)
        expect(action.aiMetadata).toEqual(AI_METADATA)
        expect(action.props.channel).toHaveProperty('auth')
    })

    it('drops the output schema, the AI metadata and each property\'s auth copy, and keeps what the piece panel uses', async () => {
        await savePiece()

        const entry = await listEntry({ query: 'suggestionType=ACTION&compactSuggestions=true' })

        const [action] = entry.suggestedActions
        expect(action).not.toHaveProperty('outputSchema')
        expect(action).not.toHaveProperty('aiMetadata')
        expect(action.props.channel).not.toHaveProperty('auth')
        expect(action).toMatchObject({ name: 'send', displayName: 'Send', description: 'Send a message', requireAuth: true, classification: 'WRITE' })
        expect(action.props.channel).toMatchObject({ displayName: 'Channel', required: true, type: 'DROPDOWN' })
        expect(action.props.text).toMatchObject({ displayName: 'Text', required: false, defaultValue: 'hello', type: 'SHORT_TEXT' })
        expect(entry.auth).toMatchObject({ displayName: 'API key' })
    })

    it('drops the sample data of suggested triggers too', async () => {
        await savePiece()

        const entry = await listEntry({ query: 'suggestionType=TRIGGER&compactSuggestions=true' })

        const [trigger] = entry.suggestedTriggers
        expect(trigger.name).toBe('new_message')
        expect(trigger).not.toHaveProperty('sampleData')
        expect(trigger).not.toHaveProperty('outputSchema')
    })
})

async function savePiece(): Promise<void> {
    const auth = PieceAuth.SecretText({ displayName: 'API key', required: true })
    const action: ActionBase = {
        name: 'send',
        displayName: 'Send',
        description: 'Send a message',
        requireAuth: true,
        classification: 'WRITE',
        outputSchema: OUTPUT_SCHEMA,
        aiMetadata: AI_METADATA,
        props: {
            channel: Property.Dropdown({ displayName: 'Channel', required: true, refreshers: [], auth, options: async () => ({ options: [] }) }),
            text: Property.ShortText({ displayName: 'Text', required: false, defaultValue: 'hello' }),
        },
    }
    const mockPiece = createMockPieceMetadata({
        name: 'compact-list-piece',
        pieceType: PieceType.OFFICIAL,
        packageType: PackageType.REGISTRY,
        auth,
        actions: { send: action },
        triggers: {
            new_message: {
                name: 'new_message',
                displayName: 'New Message',
                description: 'When a message arrives',
                requireAuth: true,
                props: {},
                type: TriggerStrategy.WEBHOOK,
                sampleData: { text: 'a long sample' },
                testStrategy: TriggerTestStrategy.TEST_FUNCTION,
                outputSchema: OUTPUT_SCHEMA,
            },
        },
    })
    await db.save('piece_metadata', mockPiece)
    await pieceCache(mockLog).setup()
}

async function listEntry({ query }: { query: string }) {
    const testToken = await generateMockToken({ type: PrincipalType.UNKNOWN, id: apId() })
    const response = await app?.inject({
        method: 'GET',
        url: `/api/v1/pieces?${query}`,
        headers: { authorization: `Bearer ${testToken}` },
    })
    expect(response?.statusCode).toBe(StatusCodes.OK)
    const entry = response?.json().find((piece: { name: string }) => piece.name === 'compact-list-piece')
    expect(entry).toBeDefined()
    return entry
}

const OUTPUT_SCHEMA = { fields: [{ key: 'id', label: 'Message ID' }] }

const AI_METADATA = { description: 'Sends one message', idempotent: false }

