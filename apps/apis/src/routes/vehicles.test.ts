import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredSubjectDraft, DBLike } from '@artificer-toolkit/db'
import type {
  AuthoredDraftActivateRequestDto,
  AuthoredDraftSaveRequestDto
} from '@artificer-toolkit/schema/api/content'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'

type SchemaResult<TBody>
  = | { success: true, data: TBody }
    | { success: false, error: { issues: unknown } }

type RouteSchema<TBody> = {
  safeParse(value: unknown): SchemaResult<TBody>
}

type RequestArgs<TArgs extends readonly unknown[]> = (request: Request, userId: string) => TArgs
type RequestHandler<TArgs extends readonly unknown[], TResult> = (
  db: DBLike,
  ...args: TArgs
) => Promise<TResult>
type AuthoringHandler<TBody, TResult> = (
  db: DBLike,
  body: TBody,
  userId: string,
  request: Request
) => Promise<TResult>

const routeMocks = vi.hoisted(() => ({
  draftRepository: {
    findBySubject: vi.fn(),
    listByUser: vi.fn(),
    save: vi.fn(),
    delete: vi.fn()
  },
  executeVehicle: vi.fn(),
  findVehicleById: vi.fn(),
  getVehicleListQuery: vi.fn(),
  normalizeNodeRuntimeValues: vi.fn(),
  ownershipRow: undefined as { isMaster: boolean, ownerUserId: string | null } | undefined
}))

const dbMock = {
  selectFrom: () => ({
    select: () => ({
      where: () => ({
        executeTakeFirst: async () => routeMocks.ownershipRow
      })
    })
  })
} as unknown as DBLike

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredSubjectDraftRepository: () => routeMocks.draftRepository,
    createVehicleRepository: () => ({
      findById: routeMocks.findVehicleById
    }),
    getVehicleListQuery: routeMocks.getVehicleListQuery
  }
})

vi.mock('@artificer-toolkit/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/functions')>()
  return {
    ...actual,
    createVehicleSubjectAuthoringService: () => ({
      execute: routeMocks.executeVehicle
    }),
    handleAuthoringRequest: <TBody, TResult>(
      schema: RouteSchema<TBody>,
      handler: AuthoringHandler<TBody, TResult>
    ) => async (request: Request): Promise<Response> => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) {
        return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 })
      }

      try {
        return Response.json(await handler(dbMock, parsed.data, 'server-user', request))
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
      }
    },
    handleRequest: <TArgs extends readonly unknown[], TResult>(
      handler: RequestHandler<TArgs, TResult>,
      getArgs: RequestArgs<TArgs>
    ) => async (request: Request): Promise<Response> => {
      try {
        return Response.json(await handler(dbMock, ...getArgs(request, 'server-user')))
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
      }
    },
    normalizeNodeRuntimeValues: routeMocks.normalizeNodeRuntimeValues
  }
})

describe('vehicle REST route handlers', () => {
  beforeEach(() => {
    routeMocks.draftRepository.findBySubject.mockReset()
    routeMocks.draftRepository.listByUser.mockReset()
    routeMocks.draftRepository.save.mockReset()
    routeMocks.draftRepository.delete.mockReset()
    routeMocks.executeVehicle.mockReset()
    routeMocks.findVehicleById.mockReset()
    routeMocks.getVehicleListQuery.mockReset()
    routeMocks.normalizeNodeRuntimeValues.mockReset()
    routeMocks.ownershipRow = undefined
  })

  it('merges owned vehicle drafts into list responses', async () => {
    routeMocks.getVehicleListQuery.mockResolvedValue({
      items: [
        {
          id: 'vehicle-active',
          label: 'Active Vehicle',
          description: 'Active',
          status: 'ACTIVE',
          userId: 'server-user',
          ownerUserId: 'server-user',
          isMaster: false,
          systemId: 'system-1',
          category: 'LAND'
        }
      ],
      meta: {}
    })
    routeMocks.draftRepository.listByUser.mockResolvedValue([
      createDraft({
        subjectId: 'vehicle-active',
        label: 'Draft Vehicle',
        payload: {
          id: 'vehicle-active',
          label: 'Draft Vehicle',
          category: 'AIR',
          description: 'Draft'
        }
      })
    ])

    const { getVehicleList } = await import('./vehicles.js')
    const response = await getVehicleList(new Request('https://api.test/content/vehicles'))
    const body = await response.json() as { items: { id: string, label: string, status: string, draft?: unknown }[] }

    expect(response.status).toBe(200)
    expect(body.items[0]).toMatchObject({
      id: 'vehicle-active',
      label: 'Draft Vehicle',
      status: 'DRAFT'
    })
    expect(body.items[0]?.draft).toBeDefined()
  }, 15000)

  it('saves vehicle drafts with server-normalized identity', async () => {
    routeMocks.draftRepository.save.mockResolvedValue(createDraft())

    const { saveVehicleDraft } = await import('./vehicles.js')
    const response = await saveVehicleDraft(jsonRequest('https://api.test/content/vehicles/draft', {
      subjectKind: 'SPELL',
      subjectId: 'vehicle-1',
      systemId: 'system-1',
      label: 'Draft Vehicle',
      payload: {
        id: 'client-id',
        label: 'Client Label',
        userId: 'client-user',
        systemId: 'client-system'
      }
    } satisfies AuthoredDraftSaveRequestDto))

    expect(response.status).toBe(200)
    expect(routeMocks.draftRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      subjectKind: 'VEHICLE',
      subjectId: 'vehicle-1',
      userId: 'server-user',
      payload: expect.objectContaining({
        id: 'vehicle-1',
        label: 'Draft Vehicle',
        userId: 'server-user',
        systemId: 'system-1'
      })
    }))
  })

  it.each([
    {
      label: 'master',
      ownershipRow: { isMaster: true, ownerUserId: null }
    },
    {
      label: 'foreign',
      ownershipRow: { isMaster: false, ownerUserId: 'other-user' }
    }
  ])('rejects saving drafts against $label vehicle records', async ({ ownershipRow }) => {
    routeMocks.ownershipRow = ownershipRow

    const { saveVehicleDraft } = await import('./vehicles.js')
    const response = await saveVehicleDraft(jsonRequest('https://api.test/content/vehicles/draft', {
      subjectKind: 'VEHICLE',
      subjectId: 'vehicle-1',
      systemId: 'system-1',
      label: 'Draft Vehicle',
      payload: createVehiclePayload()
    } satisfies AuthoredDraftSaveRequestDto))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toContain('VEHICLE "vehicle-1" cannot be edited by the current user.')
    expect(routeMocks.draftRepository.save).not.toHaveBeenCalled()
  })

  it('rejects draft activation id mismatches using the route id', async () => {
    const { activateVehicleDraft } = await import('./vehicles.js')
    const response = await activateVehicleDraft(jsonRequest('https://api.test/content/vehicles/route-vehicle/draft/activate', {
      subjectKind: 'VEHICLE',
      subjectId: 'body-vehicle'
    } satisfies AuthoredDraftActivateRequestDto))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toContain('route id "route-vehicle" does not match request body subjectId "body-vehicle"')
  })

  it('normalizes vehicle drafts before activation and discards successful drafts', async () => {
    routeMocks.draftRepository.findBySubject.mockResolvedValue(createDraft())
    routeMocks.normalizeNodeRuntimeValues.mockResolvedValue({
      values: createVehicleInput({ userId: 'server-user', status: 'DRAFT' }),
      clearedPaths: []
    })
    routeMocks.executeVehicle.mockResolvedValue({
      authored: createVehicleInput({ userId: 'server-user', status: 'ACTIVE' })
    })

    const { activateVehicleDraft } = await import('./vehicles.js')
    const response = await activateVehicleDraft(jsonRequest('https://api.test/content/vehicles/vehicle-1/draft/activate', {
      subjectKind: 'VEHICLE',
      subjectId: 'vehicle-1'
    } satisfies AuthoredDraftActivateRequestDto))

    expect(response.status).toBe(200)
    expect(routeMocks.normalizeNodeRuntimeValues).toHaveBeenCalledWith(dbMock, {
      mapId: 'vehicle',
      values: expect.objectContaining({ id: 'vehicle-1', userId: 'server-user' })
    })
    expect(routeMocks.draftRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'VEHICLE',
      subjectId: 'vehicle-1',
      userId: 'server-user'
    })
  })

  it('normalizes direct vehicle activation through the node runtime with server user id', async () => {
    routeMocks.normalizeNodeRuntimeValues.mockImplementation(async (_db: DBLike, request: { values: unknown }) => ({
      values: request.values,
      clearedPaths: []
    }))
    routeMocks.executeVehicle.mockResolvedValue({
      authored: createVehicleInput({ userId: 'server-user', status: 'ACTIVE' })
    })

    const { createVehicle } = await import('./vehicles.js')
    const response = await createVehicle(jsonRequest('https://api.test/content/vehicles', {
      ...createVehicleInput({ userId: 'client-user', status: 'DRAFT' }),
      userId: 'client-user'
    }))

    expect(response.status).toBe(200)
    expect(routeMocks.normalizeNodeRuntimeValues).toHaveBeenCalledWith(dbMock, {
      mapId: 'vehicle',
      values: expect.objectContaining({ id: 'vehicle-1', userId: 'server-user' })
    })
  })
})

function createDraft(overrides: Partial<AuthoredSubjectDraft> = {}): AuthoredSubjectDraft {
  return {
    id: 'draft-1',
    subjectKind: 'VEHICLE',
    subjectId: 'vehicle-1',
    userId: 'server-user',
    systemId: 'system-1',
    label: 'Draft Vehicle',
    status: 'DRAFT',
    payload: createVehiclePayload(),
    draftState: 'ACTIVE_WITH_DRAFT',
    baseActiveUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createVehicleInput(overrides: Partial<VehicleAuthoringInputDto> = {}): VehicleAuthoringInputDto {
  return {
    id: 'vehicle-1',
    label: 'Draft Vehicle',
    description: 'Draft',
    status: 'DRAFT',
    userId: 'server-user',
    systemId: 'system-1',
    category: 'LAND',
    ...overrides
  }
}

function createVehiclePayload() {
  return {
    id: 'vehicle-1',
    label: 'Draft Vehicle',
    description: 'Draft',
    status: 'DRAFT',
    userId: 'server-user',
    systemId: 'system-1',
    category: 'LAND'
  }
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
