import {
    FlowActionType,
    flowOperations,
    FlowOperationType,
    FlowStatus,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
    LATEST_FLOW_SCHEMA_VERSION,
    PackageType,
    PieceType,
    PopulatedFlow,
    StepLocationRelativeToParent,
    UncategorizedFolderId,
} from '@activepieces/shared'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { db } from '../../../../helpers/db'
import { describeWithAuth } from '../../../../helpers/describe-with-auth'
import {
    createMockFlow,
    createMockFlowVersion,
    createMockFolder,
    createMockPieceMetadata,
    createMockProject,
} from '../../../../helpers/mocks'
import { createTestContext } from '../../../../helpers/test-context'
import { setupTestEnvironment, teardownTestEnvironment } from '../../../../helpers/test-setup'

let app: FastifyInstance | null = null

beforeAll(async () => {
    app = await setupTestEnvironment()
})

afterAll(async () => {
    await teardownTestEnvironment()
})

describe('Flow Operations API', () => {
    describeWithAuth('GET /v1/flows/:id', () => app!, (setup) => {
        it('should get a flow by id', async () => {
            const ctx = await setup()

            const mockFlow = createMockFlow({ projectId: ctx.project.id })
            await db.save('flow', mockFlow)

            const mockFlowVersion = createMockFlowVersion({ flowId: mockFlow.id })
            await db.save('flow_version', mockFlowVersion)

            const response = await ctx.get(`/v1/flows/${mockFlow.id}`)

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.id).toBe(mockFlow.id)
            expect(body.projectId).toBe(ctx.project.id)
            expect(body.version).toBeDefined()
            expect(body.version.id).toBe(mockFlowVersion.id)
        })

        it('should return 404 for non-existent flow', async () => {
            const ctx = await setup()

            const response = await ctx.get('/v1/flows/nonExistentId12345678')

            expect(response?.statusCode).toBe(StatusCodes.NOT_FOUND)
        })
    })

    describe('GET /v1/flows/:id (Cross-project)', () => {
        it('should deny access for flow in another project', async () => {
            const ctx1 = await createTestContext(app!)
            const ctx2 = await createTestContext(app!)

            const mockFlow = createMockFlow({ projectId: ctx1.project.id })
            await db.save('flow', mockFlow)

            const mockFlowVersion = createMockFlowVersion({ flowId: mockFlow.id })
            await db.save('flow_version', mockFlowVersion)

            const response = await ctx2.get(`/v1/flows/${mockFlow.id}`)

            expect(response?.statusCode).toBe(StatusCodes.FORBIDDEN)
        })
    })

    describeWithAuth('GET /v1/flows/count', () => app!, (setup) => {
        it('should count flows in project', async () => {
            const ctx = await setup()

            const mockFlow1 = createMockFlow({ projectId: ctx.project.id })
            const mockFlow2 = createMockFlow({ projectId: ctx.project.id })
            await db.save('flow', [mockFlow1, mockFlow2])

            const mockFlowVersion1 = createMockFlowVersion({ flowId: mockFlow1.id })
            const mockFlowVersion2 = createMockFlowVersion({ flowId: mockFlow2.id })
            await db.save('flow_version', [mockFlowVersion1, mockFlowVersion2])

            const response = await ctx.get('/v1/flows/count', {
                projectId: ctx.project.id,
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body).toBe(2)
        })
    })

    describeWithAuth('DELETE /v1/flows/:id', () => app!, (setup) => {
        it('should delete a flow', async () => {
            const ctx = await setup()

            const mockFlow = createMockFlow({ projectId: ctx.project.id, status: FlowStatus.DISABLED })
            await db.save('flow', mockFlow)

            const mockFlowVersion = createMockFlowVersion({ flowId: mockFlow.id })
            await db.save('flow_version', mockFlowVersion)

            const response = await ctx.delete(`/v1/flows/${mockFlow.id}`)

            expect(response?.statusCode).toBe(StatusCodes.NO_CONTENT)

            // Verify the flow no longer appears in list
            const listResponse = await ctx.get('/v1/flows', { projectId: ctx.project.id })
            const flows = listResponse?.json().data ?? []
            const flowIds = flows.map((f: Record<string, string>) => f.id)
            expect(flowIds).not.toContain(mockFlow.id)
        })

        it('should return 404 when deleting non-existent flow', async () => {
            const ctx = await setup()

            const response = await ctx.delete('/v1/flows/nonExistentId12345678')

            expect(response?.statusCode).toBe(StatusCodes.NOT_FOUND)
        })
    })

    describe('DELETE /v1/flows/:id (Cross-project)', () => {
        it('should deny deleting flow from another project', async () => {
            const ctx1 = await createTestContext(app!)
            const ctx2 = await createTestContext(app!)

            const mockFlow = createMockFlow({ projectId: ctx1.project.id, status: FlowStatus.DISABLED })
            await db.save('flow', mockFlow)

            const mockFlowVersion = createMockFlowVersion({ flowId: mockFlow.id })
            await db.save('flow_version', mockFlowVersion)

            const response = await ctx2.delete(`/v1/flows/${mockFlow.id}`)

            expect(response?.statusCode).toBe(StatusCodes.FORBIDDEN)
        })
    })

    describeWithAuth('POST /v1/flows/:id CHANGE_NAME', () => app!, (setup) => {
        it('should rename a flow', async () => {
            const ctx = await setup()

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'Original Name',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })

            expect(createResponse?.statusCode).toBe(StatusCodes.CREATED)
            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.CHANGE_NAME,
                request: { displayName: 'New Name' },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.displayName).toBe('New Name')
        })
    })

    describe('POST /v1/flows/:id CHANGE_FOLDER', () => {
        it('should move flow to folder', async () => {
            const ctx = await createTestContext(app!)

            const mockFolder = createMockFolder({ projectId: ctx.project.id })
            await db.save('folder', mockFolder)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })

            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.CHANGE_FOLDER,
                request: { folderId: mockFolder.id },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.folderId).toBe(mockFolder.id)
        })

        it('should move flow to null (unfolder)', async () => {
            const ctx = await createTestContext(app!)

            const mockFolder = createMockFolder({ projectId: ctx.project.id })
            await db.save('folder', mockFolder)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
                folderId: mockFolder.id,
            }, { query: { projectId: ctx.project.id } })

            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.CHANGE_FOLDER,
                request: { folderId: null },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.folderId).toBeNull()
        })

        it('should move flow to null when the Uncategorized sentinel is sent', async () => {
            const ctx = await createTestContext(app!)

            const mockFolder = createMockFolder({ projectId: ctx.project.id })
            await db.save('folder', mockFolder)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
                folderId: mockFolder.id,
            }, { query: { projectId: ctx.project.id } })

            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.CHANGE_FOLDER,
                request: { folderId: UncategorizedFolderId },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            expect(response?.json().folderId).toBeNull()
        })

        it('should reject moving flow to a folder from another project', async () => {
            const ctx = await createTestContext(app!)

            const otherProject = createMockProject({ platformId: ctx.platform.id, ownerId: ctx.user.id })
            await db.save('project', otherProject)
            const foreignFolder = createMockFolder({ projectId: otherProject.id })
            await db.save('folder', foreignFolder)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })

            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.CHANGE_FOLDER,
                request: { folderId: foreignFolder.id },
            })

            expect(response?.statusCode).toBe(StatusCodes.NOT_FOUND)
            const flowAfter = await ctx.get(`/v1/flows/${flow.id}`)
            expect(flowAfter?.json().folderId).toBeNull()
        })
    })

    describe('POST /v1/flows create with folderId', () => {
        it('should reject creating a flow in a folder from another project', async () => {
            const ctx = await createTestContext(app!)

            const otherProject = createMockProject({ platformId: ctx.platform.id, ownerId: ctx.user.id })
            await db.save('project', otherProject)
            const foreignFolder = createMockFolder({ projectId: otherProject.id })
            await db.save('folder', foreignFolder)

            const response = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
                folderId: foreignFolder.id,
            }, { query: { projectId: ctx.project.id } })

            expect(response?.statusCode).toBe(StatusCodes.NOT_FOUND)
        })

        it('should create a flow in a folder from the same project', async () => {
            const ctx = await createTestContext(app!)

            const mockFolder = createMockFolder({ projectId: ctx.project.id })
            await db.save('folder', mockFolder)

            const response = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
                folderId: mockFolder.id,
            }, { query: { projectId: ctx.project.id } })

            expect(response?.statusCode).toBe(StatusCodes.CREATED)
            expect(response?.json().folderId).toBe(mockFolder.id)
        })
    })

    describe('POST /v1/flows/:id UPDATE_TRIGGER', () => {
        it('should update trigger to piece trigger', async () => {
            const ctx = await createTestContext(app!)

            const mockPiece = createMockPieceMetadata({
                name: '@activepieces/piece-schedule',
                version: '0.2.0',
                pieceType: PieceType.OFFICIAL,
                packageType: PackageType.REGISTRY,
            })
            await db.save('piece_metadata', mockPiece)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })

            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_TRIGGER,
                request: {
                    type: FlowTriggerType.PIECE,
                    settings: {
                        pieceName: '@activepieces/piece-schedule',
                        pieceVersion: '0.2.0',
                        input: {},
                        triggerName: 'every_hour',
                        propertySettings: {},
                    },
                    valid: false,
                    name: 'trigger',
                    displayName: 'Schedule',
                },
            })
            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.type).toBe(FlowTriggerType.PIECE)
            expect(body.version.trigger.settings.pieceName).toBe('@activepieces/piece-schedule')
        })
    })

    describeWithAuth('POST /v1/flows/:id ADD_ACTION', () => app!, (setup) => {
        it('should add code action after trigger', async () => {
            const ctx = await setup()

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })

            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Code Step',
                        name: 'step_1',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return true; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction).toBeDefined()
            expect(body.version.trigger.nextAction.type).toBe(FlowActionType.CODE)
            expect(body.version.trigger.nextAction.displayName).toBe('Code Step')
        })
    })

    describe('POST /v1/flows/:id UPDATE_ACTION', () => {
        it('should update action settings', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Code Step',
                        name: 'step_1',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return true; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_ACTION,
                request: {
                    type: FlowActionType.CODE,
                    displayName: 'Updated Code Step',
                    name: 'step_1',
                    settings: {
                        input: { key: 'value' },
                        sourceCode: {
                            code: 'export const code = async () => { return false; }',
                            packageJson: '{}',
                        },
                    },
                    valid: true,
                    skip: false,
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction.displayName).toBe('Updated Code Step')
        })

        it('should preserve settings.input for CODE action', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Code Step',
                        name: 'step_1',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return true; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            const inputData = { key: 'value', nested: { a: 1 } }
            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_ACTION,
                request: {
                    type: FlowActionType.CODE,
                    displayName: 'Code Step',
                    name: 'step_1',
                    settings: {
                        input: inputData,
                        sourceCode: {
                            code: 'export const code = async () => { return true; }',
                            packageJson: '{}',
                        },
                    },
                    valid: true,
                    skip: false,
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction.settings.input).toEqual(inputData)
        })

        it('should preserve settings.input for PIECE action', async () => {
            const ctx = await createTestContext(app!)

            const mockPiece = createMockPieceMetadata({
                name: '@activepieces/piece-test',
                version: '0.1.0',
                pieceType: PieceType.OFFICIAL,
                packageType: PackageType.REGISTRY,
            })
            await db.save('piece_metadata', mockPiece)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.PIECE,
                        displayName: 'Piece Step',
                        name: 'step_1',
                        settings: {
                            pieceName: '@activepieces/piece-test',
                            pieceVersion: '0.1.0',
                            actionName: 'test_action',
                            input: {},
                            propertySettings: {},
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            const inputData = { field1: 'hello', field2: '{{ trigger.body }}' }
            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_ACTION,
                request: {
                    type: FlowActionType.PIECE,
                    displayName: 'Piece Step',
                    name: 'step_1',
                    settings: {
                        pieceName: '@activepieces/piece-test',
                        pieceVersion: '0.1.0',
                        actionName: 'test_action',
                        input: inputData,
                        propertySettings: {},
                    },
                    valid: true,
                    skip: false,
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction.settings.input).toEqual(inputData)
        })
    })

    describe('POST /v1/flows/:id DELETE_ACTION', () => {
        it('should delete action by name', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Code Step',
                        name: 'step_1',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return true; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.DELETE_ACTION,
                request: { names: ['step_1'] },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction).toBeUndefined()
        })
    })

    describe('POST /v1/flows/:id DUPLICATE_ACTION', () => {
        it('should duplicate an action', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Code Step',
                        name: 'step_1',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return true; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.DUPLICATE_ACTION,
                request: { stepName: 'step_1' },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction).toBeDefined()
            expect(body.version.trigger.nextAction.nextAction).toBeDefined()
        })
    })

    describe('POST /v1/flows/:id MOVE_ACTION', () => {
        it('should move action to different position', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'trigger',
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Step 1',
                        name: 'step_1',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return 1; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: 'step_1',
                    stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
                    action: {
                        type: FlowActionType.CODE,
                        displayName: 'Step 2',
                        name: 'step_2',
                        settings: {
                            input: {},
                            sourceCode: {
                                code: 'export const code = async () => { return 2; }',
                                packageJson: '{}',
                            },
                        },
                        valid: true,
                        skip: false,
                    },
                },
            })

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.MOVE_ACTION,
                request: {
                    name: 'step_2',
                    newParentStep: 'trigger',
                    stepLocationRelativeToNewParent: StepLocationRelativeToParent.AFTER,
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.trigger.nextAction.displayName).toBe('Step 2')
        })
    })

    describe('POST /v1/flows/:id IMPORT_FLOW', () => {
        it('should import flow definition', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.IMPORT_FLOW,
                request: {
                    displayName: 'Imported Flow',
                    trigger: {
                        type: FlowTriggerType.EMPTY,
                        name: 'trigger',
                        settings: {},
                        valid: false,
                        displayName: 'Select Trigger',
                    },
                    schemaVersion: null,
                    notes: null,
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.version.displayName).toBe('Imported Flow')
            expect(body.version.state).toBe(FlowVersionState.DRAFT)
        })

        it('rejects an imported flow whose nested step name is a path traversal', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.IMPORT_FLOW,
                request: {
                    displayName: 'Malicious Flow',
                    trigger: {
                        type: FlowTriggerType.EMPTY,
                        name: 'trigger',
                        displayName: 'Select Trigger',
                        settings: {},
                        valid: false,
                        nextAction: {
                            type: FlowActionType.CODE,
                            displayName: 'Code Step',
                            name: '../../common/node_modules/bufferutil',
                            settings: {
                                input: {},
                                sourceCode: {
                                    code: 'export const code = async () => { return true; }',
                                    packageJson: '{}',
                                },
                            },
                            valid: true,
                            skip: false,
                        },
                    },
                    schemaVersion: null,
                    notes: null,
                },
            })

            // ErrorCode.VALIDATION maps to 409 in the API error handler (the convention for
            // rejected-invalid-input across the codebase); the point is the import is rejected
            // and the traversal name is never persisted.
            expect(response?.statusCode).toBe(StatusCodes.CONFLICT)

            // The traversal step must never reach the flow version.
            const afterImport = await ctx.get(`/v1/flows/${flow.id}`)
            const persisted: PopulatedFlow = afterImport?.json()
            expect(persisted.version.trigger.nextAction).toBeUndefined()
        })

        it('imports an old template whose piece version the upgrade register moves forward', async () => {
            const ctx = await createTestContext(app!)

            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.IMPORT_FLOW,
                request: {
                    displayName: 'Event handler',
                    trigger: {
                        type: FlowTriggerType.PIECE,
                        name: 'trigger',
                        displayName: 'Catch Webhook',
                        valid: true,
                        lastUpdatedDate: new Date().toISOString(),
                        settings: {
                            pieceName: '@activepieces/piece-webhook',
                            pieceVersion: '0.1.33',
                            triggerName: 'catch_webhook',
                            input: { authType: 'none', authFields: {} },
                            propertySettings: {},
                        },
                    },
                    schemaVersion: '20',
                    notes: [],
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body: PopulatedFlow = response?.json()
            expect(body.version.schemaVersion).toBe(LATEST_FLOW_SCHEMA_VERSION)
            expect(body.version.trigger.type).toBe(FlowTriggerType.PIECE)
            expect(body.version.trigger.settings.pieceVersion).not.toBe('0.1.33')
        })
    })

    describe('POST /v1/flows/:id draft creation rollback', () => {
        it('should not leave an orphaned empty draft when importing into the new draft fails', async () => {
            const ctx = await createTestContext(app!)

            const mockFlow = createMockFlow({
                projectId: ctx.project.id,
                status: FlowStatus.DISABLED,
            })
            await db.save('flow', mockFlow)

            const lockedVersion = createMockFlowVersion({
                flowId: mockFlow.id,
                state: FlowVersionState.LOCKED,
                valid: true,
            })
            await db.save('flow_version', lockedVersion)

            const applySpy = vi.spyOn(flowOperations, 'apply').mockImplementationOnce(() => {
                throw new RangeError('Maximum call stack size exceeded')
            })

            try {
                const response = await ctx.post(`/v1/flows/${mockFlow.id}`, {
                    type: FlowOperationType.CHANGE_NAME,
                    request: { displayName: 'New Name' },
                })

                expect(response?.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)

                const orphanedDraft = await db.findOneBy('flow_version', {
                    flowId: mockFlow.id,
                    state: FlowVersionState.DRAFT,
                })
                expect(orphanedDraft).toBeNull()

                const remainingVersion = await db.findOneByOrFail<FlowVersion>('flow_version', {
                    flowId: mockFlow.id,
                })
                expect(remainingVersion.id).toBe(lockedVersion.id)
                expect(remainingVersion.state).toBe(FlowVersionState.LOCKED)
            }
            finally {
                applySpy.mockRestore()
            }
        })

        it('should delete the newly created draft when the user operation fails after a successful import', async () => {
            const ctx = await createTestContext(app!)

            const mockFlow = createMockFlow({
                projectId: ctx.project.id,
                status: FlowStatus.DISABLED,
            })
            await db.save('flow', mockFlow)

            const lockedVersion = createMockFlowVersion({
                flowId: mockFlow.id,
                state: FlowVersionState.LOCKED,
                valid: true,
            })
            await db.save('flow_version', lockedVersion)

            const originalApply = flowOperations.apply
            const applySpy = vi.spyOn(flowOperations, 'apply').mockImplementation((flowVersion, operation) => {
                if (operation.type === FlowOperationType.CHANGE_NAME && operation.request.displayName === 'Renamed by user') {
                    throw new Error('user operation failed')
                }
                return originalApply(flowVersion, operation)
            })

            try {
                const response = await ctx.post(`/v1/flows/${mockFlow.id}`, {
                    type: FlowOperationType.CHANGE_NAME,
                    request: { displayName: 'Renamed by user' },
                })

                expect(response?.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)

                const leftoverDraft = await db.findOneBy('flow_version', {
                    flowId: mockFlow.id,
                    state: FlowVersionState.DRAFT,
                })
                expect(leftoverDraft).toBeNull()

                const remainingVersion = await db.findOneByOrFail<FlowVersion>('flow_version', {
                    flowId: mockFlow.id,
                })
                expect(remainingVersion.id).toBe(lockedVersion.id)
                expect(remainingVersion.state).toBe(FlowVersionState.LOCKED)
            }
            finally {
                applySpy.mockRestore()
            }
        })
    })

    describe('POST /v1/flows/:id UPDATE_STEP_POSITIONS', () => {
        const codeAction = (name: string): Record<string, unknown> => ({
            type: FlowActionType.CODE,
            displayName: name,
            name,
            settings: {
                input: {},
                sourceCode: {
                    code: 'export const code = async () => { return true; }',
                    packageJson: '{}',
                },
            },
            valid: true,
            skip: false,
        })

        const createFlowWithSteps = async (ctx: Awaited<ReturnType<typeof createTestContext>>, names: string[]): Promise<PopulatedFlow> => {
            const createResponse = await ctx.post('/v1/flows', {
                displayName: 'test flow',
                projectId: ctx.project.id,
            }, { query: { projectId: ctx.project.id } })
            const flow: PopulatedFlow = createResponse?.json()
            for (const [index, name] of names.entries()) {
                await ctx.post(`/v1/flows/${flow.id}`, {
                    type: FlowOperationType.ADD_ACTION,
                    request: {
                        parentStep: index === 0 ? 'trigger' : names[index - 1],
                        stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
                        action: codeAction(name),
                    },
                })
            }
            return flow
        }

        it('persists the positions and prunes the key of a deleted step', async () => {
            const ctx = await createTestContext(app!)
            const flow = await createFlowWithSteps(ctx, ['step_1', 'step_2'])
            const positions = {
                trigger: { x: 176, y: 240 },
                step_1: { x: 400, y: 256 },
                step_2: { x: 640, y: 240 },
            }

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_STEP_POSITIONS,
                request: { positions },
            })
            const persisted = await ctx.get(`/v1/flows/${flow.id}`)
            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.DELETE_ACTION,
                request: { names: ['step_1'] },
            })
            const afterDelete = await ctx.get(`/v1/flows/${flow.id}`)

            expect(response?.statusCode).toBe(StatusCodes.OK)
            expect(response?.json().version.stepPositions).toEqual(positions)
            expect(persisted?.json().version.stepPositions).toEqual(positions)
            expect(afterDelete?.json().version.stepPositions).toEqual({
                trigger: { x: 176, y: 240 },
                step_2: { x: 640, y: 240 },
            })
        })

        it('ignores positions of names that are not steps of the flow', async () => {
            const ctx = await createTestContext(app!)
            const flow = await createFlowWithSteps(ctx, ['step_1'])

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_STEP_POSITIONS,
                request: { positions: { step_1: { x: 400, y: 240 }, step_9: { x: 0, y: 0 } } },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            expect(response?.json().version.stepPositions).toEqual({ step_1: { x: 400, y: 240 } })
        })

        it('updates a locked version in place, and a later edit forks a draft that carries the positions', async () => {
            const ctx = await createTestContext(app!)
            const mockFlow = createMockFlow({ projectId: ctx.project.id, status: FlowStatus.DISABLED })
            await db.save('flow', mockFlow)
            const lockedVersion = createMockFlowVersion({ flowId: mockFlow.id, state: FlowVersionState.LOCKED, valid: true })
            await db.save('flow_version', lockedVersion)

            const response = await ctx.post(`/v1/flows/${mockFlow.id}`, {
                type: FlowOperationType.UPDATE_STEP_POSITIONS,
                request: { positions: { trigger: { x: 32, y: 48 } } },
            })
            const versionsAfterMove = await ctx.get(`/v1/flows/${mockFlow.id}/versions`)
            const renamed = await ctx.post(`/v1/flows/${mockFlow.id}`, {
                type: FlowOperationType.CHANGE_NAME,
                request: { displayName: 'Renamed' },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            expect(response?.json().version.id).toBe(lockedVersion.id)
            expect(response?.json().version.state).toBe(FlowVersionState.LOCKED)
            expect(response?.json().version.stepPositions).toEqual({ trigger: { x: 32, y: 48 } })
            expect(versionsAfterMove?.json().data).toHaveLength(1)
            expect(renamed?.json().version.id).not.toBe(lockedVersion.id)
            expect(renamed?.json().version.state).toBe(FlowVersionState.DRAFT)
            expect(renamed?.json().version.stepPositions).toEqual({ trigger: { x: 32, y: 48 } })
        })

        it('does not bump the flow last-modified time', async () => {
            const ctx = await createTestContext(app!)
            const flow = await createFlowWithSteps(ctx, ['step_1'])
            const before = await ctx.get(`/v1/flows/${flow.id}`)

            await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_STEP_POSITIONS,
                request: { positions: { step_1: { x: 416, y: 240 } } },
            })
            const after = await ctx.get(`/v1/flows/${flow.id}`)

            expect(after?.json().updated).toBe(before?.json().updated)
            expect(after?.json().version.stepPositions).toEqual({ step_1: { x: 416, y: 240 } })
        })

        it('IMPORT_FLOW stores the imported positions', async () => {
            const ctx = await createTestContext(app!)
            const flow = await createFlowWithSteps(ctx, [])

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.IMPORT_FLOW,
                request: {
                    displayName: 'Imported Flow',
                    trigger: {
                        type: FlowTriggerType.EMPTY,
                        name: 'trigger',
                        settings: {},
                        valid: false,
                        displayName: 'Select Trigger',
                        nextAction: codeAction('step_1'),
                    },
                    schemaVersion: null,
                    notes: null,
                    stepPositions: { trigger: { x: 176, y: 240 }, step_1: { x: 432, y: 272 } },
                },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            expect(response?.json().version.stepPositions).toEqual({ trigger: { x: 176, y: 240 }, step_1: { x: 432, y: 272 } })
        })

        it('USE_AS_DRAFT copies the positions of the chosen version', async () => {
            const ctx = await createTestContext(app!)
            const mockFlow = createMockFlow({ projectId: ctx.project.id, status: FlowStatus.DISABLED })
            await db.save('flow', mockFlow)
            const lockedVersion = createMockFlowVersion({
                flowId: mockFlow.id,
                state: FlowVersionState.LOCKED,
                created: '2026-01-01T00:00:00.000Z',
                stepPositions: { trigger: { x: 16, y: 16 } },
            })
            const draftVersion = createMockFlowVersion({
                flowId: mockFlow.id,
                state: FlowVersionState.DRAFT,
                created: '2026-01-02T00:00:00.000Z',
            })
            await db.save('flow_version', [lockedVersion, draftVersion])

            const response = await ctx.post(`/v1/flows/${mockFlow.id}`, {
                type: FlowOperationType.USE_AS_DRAFT,
                request: { versionId: lockedVersion.id },
            })

            expect(response?.statusCode).toBe(StatusCodes.OK)
            expect(response?.json().version.id).toBe(draftVersion.id)
            expect(response?.json().version.stepPositions).toEqual({ trigger: { x: 16, y: 16 } })
        })

        it('rejects coordinates that are not numbers', async () => {
            const ctx = await createTestContext(app!)
            const flow = await createFlowWithSteps(ctx, ['step_1'])

            const response = await ctx.post(`/v1/flows/${flow.id}`, {
                type: FlowOperationType.UPDATE_STEP_POSITIONS,
                request: { positions: { step_1: { x: 'left', y: 0 } } },
            })

            expect(response?.statusCode).toBe(StatusCodes.BAD_REQUEST)
        })
    })

    describe('GET /v1/flows/:flowId/versions', () => {
        it('should list flow versions', async () => {
            const ctx = await createTestContext(app!)

            const mockFlow = createMockFlow({ projectId: ctx.project.id })
            await db.save('flow', mockFlow)

            const mockFlowVersion = createMockFlowVersion({
                flowId: mockFlow.id,
                state: FlowVersionState.DRAFT,
            })
            await db.save('flow_version', mockFlowVersion)

            const response = await ctx.get(`/v1/flows/${mockFlow.id}/versions`)

            expect(response?.statusCode).toBe(StatusCodes.OK)
            const body = response?.json()
            expect(body.data).toHaveLength(1)
            expect(body.data[0].id).toBe(mockFlowVersion.id)
        })
    })
})
