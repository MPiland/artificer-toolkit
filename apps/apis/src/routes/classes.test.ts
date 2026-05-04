import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredSubjectDraft, DBLike } from '@artificer-toolkit/db'
import type {
  AuthoredDraftActivateRequestDto,
  AuthoredDraftSaveRequestDto
} from '@artificer-toolkit/schema/api/content'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'

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
  executeClass: vi.fn(),
  findClassById: vi.fn(),
  getClassListQuery: vi.fn(),
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
    createClassRepository: () => ({
      findById: routeMocks.findClassById
    }),
    getClassListQuery: routeMocks.getClassListQuery
  }
})

vi.mock('@artificer-toolkit/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/functions')>()
  return {
    ...actual,
    createClassSubjectAuthoringService: () => ({
      execute: routeMocks.executeClass
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

describe('class REST route handlers', () => {
  beforeEach(() => {
    routeMocks.draftRepository.findBySubject.mockReset()
    routeMocks.draftRepository.listByUser.mockReset()
    routeMocks.draftRepository.save.mockReset()
    routeMocks.draftRepository.delete.mockReset()
    routeMocks.executeClass.mockReset()
    routeMocks.findClassById.mockReset()
    routeMocks.getClassListQuery.mockReset()
    routeMocks.normalizeNodeRuntimeValues.mockReset()
    routeMocks.ownershipRow = undefined
  })

  it('merges owned class drafts into list responses', async () => {
    routeMocks.getClassListQuery.mockResolvedValue({
      items: [
        {
          id: 'class-active',
          label: 'Active Class',
          description: 'Active',
          status: 'ACTIVE',
          userId: 'server-user',
          ownerUserId: 'server-user',
          isMaster: false,
          systemId: 'system-1',
          category: 'BASE'
        }
      ],
      meta: {}
    })
    routeMocks.draftRepository.listByUser.mockResolvedValue([
      createDraft({
        subjectId: 'class-active',
        label: 'Draft Class',
        payload: {
          id: 'class-active',
          label: 'Draft Class',
          category: 'SUBCLASS',
          description: 'Draft'
        }
      })
    ])

    const { getClassList } = await import('./classes.js')
    const response = await getClassList(new Request('https://api.test/content/classes'))
    const body = await response.json() as { items: { id: string, label: string, status: string, draft?: unknown }[] }

    expect(response.status).toBe(200)
    expect(body.items[0]).toMatchObject({
      id: 'class-active',
      label: 'Draft Class',
      status: 'DRAFT'
    })
    expect(body.items[0]?.draft).toBeDefined()
  }, 15000)

  it('saves class drafts with server-normalized identity', async () => {
    routeMocks.draftRepository.save.mockResolvedValue(createDraft())

    const { saveClassDraft } = await import('./classes.js')
    const response = await saveClassDraft(jsonRequest('https://api.test/content/classes/draft', {
      subjectKind: 'SPELL',
      subjectId: 'class-1',
      systemId: 'system-1',
      label: 'Draft Class',
      payload: {
        id: 'client-id',
        label: 'Client Label',
        userId: 'client-user',
        systemId: 'client-system'
      }
    } satisfies AuthoredDraftSaveRequestDto))

    expect(response.status).toBe(200)
    expect(routeMocks.draftRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      subjectKind: 'CLASS',
      subjectId: 'class-1',
      userId: 'server-user',
      payload: expect.objectContaining({
        id: 'class-1',
        label: 'Draft Class',
        userId: 'server-user',
        systemId: 'system-1'
      })
    }))
  })

  it('rejects draft activation id mismatches using the route id', async () => {
    const { activateClassDraft } = await import('./classes.js')
    const response = await activateClassDraft(jsonRequest('https://api.test/content/classes/route-class/draft/activate', {
      subjectKind: 'CLASS',
      subjectId: 'body-class'
    } satisfies AuthoredDraftActivateRequestDto))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toContain('route id "route-class" does not match request body subjectId "body-class"')
  })

  it('normalizes class drafts before activation and discards successful drafts', async () => {
    routeMocks.draftRepository.findBySubject.mockResolvedValue(createDraft())
    routeMocks.normalizeNodeRuntimeValues.mockResolvedValue({
      values: createClassInput({ userId: 'server-user', status: 'DRAFT' }),
      clearedPaths: []
    })
    routeMocks.executeClass.mockResolvedValue({
      authored: createClassInput({ userId: 'server-user', status: 'ACTIVE' })
    })

    const { activateClassDraft } = await import('./classes.js')
    const response = await activateClassDraft(jsonRequest('https://api.test/content/classes/class-1/draft/activate', {
      subjectKind: 'CLASS',
      subjectId: 'class-1'
    } satisfies AuthoredDraftActivateRequestDto))

    expect(response.status).toBe(200)
    expect(routeMocks.normalizeNodeRuntimeValues).toHaveBeenCalledWith(dbMock, {
      mapId: 'class',
      values: expect.objectContaining({ id: 'class-1', userId: 'server-user' })
    })
    expect(routeMocks.draftRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'CLASS',
      subjectId: 'class-1',
      userId: 'server-user'
    })
  })

  it('rejects saving drafts against locked class records', async () => {
    routeMocks.ownershipRow = { isMaster: true, ownerUserId: null }

    const { saveClassDraft } = await import('./classes.js')
    const response = await saveClassDraft(jsonRequest('https://api.test/content/classes/draft', {
      subjectKind: 'CLASS',
      subjectId: 'class-1',
      systemId: 'system-1',
      label: 'Draft Class',
      payload: createClassPayload()
    } satisfies AuthoredDraftSaveRequestDto))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toContain('CLASS "class-1" cannot be edited by the current user.')
    expect(routeMocks.draftRepository.save).not.toHaveBeenCalled()
  })
})

function createDraft(overrides: Partial<AuthoredSubjectDraft> = {}): AuthoredSubjectDraft {
  return {
    id: 'draft-1',
    subjectKind: 'CLASS',
    subjectId: 'class-1',
    userId: 'server-user',
    systemId: 'system-1',
    label: 'Draft Class',
    status: 'DRAFT',
    payload: createClassPayload(),
    draftState: 'ACTIVE_WITH_DRAFT',
    baseActiveUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createClassInput(overrides: Partial<ClassAuthoringInputDto> = {}): ClassAuthoringInputDto {
  return {
    id: 'class-1',
    label: 'Draft Class',
    description: 'Draft',
    status: 'DRAFT',
    userId: 'server-user',
    systemId: 'system-1',
    category: 'SUBCLASS',
    parentClassId: 'fighter',
    ...overrides
  }
}

function createClassPayload() {
  return {
    id: 'class-1',
    label: 'Draft Class',
    description: 'Draft',
    status: 'DRAFT',
    userId: 'server-user',
    systemId: 'system-1',
    category: 'SUBCLASS',
    parentClassId: 'fighter'
  }
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
