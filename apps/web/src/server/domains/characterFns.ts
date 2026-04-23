import { createServerFn } from '@tanstack/react-start'
import { getAuthUser } from '@supabase'
import { createCharacterRepository, createDb, withUserContext } from '@artificer-toolkit/db'
import {
  AUTHORED_RECORD_STATUS,
  createCharacterBuilderChangePreview,
  createEmptyCharacterAuthored,
  reconcileCharacterBuilderCharacter,
  resolveCharacterBuilder,
  type CharacterBuilderResolution
} from '@artificer-toolkit/functions'
import type { AuthoredRecordStatus, CharacterAuthored } from '@artificer-toolkit/shared'

export interface CharacterBuilderPayload {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
}

type CharacterBuilderMode = 'create' | 'edit'

export interface CharacterListItem {
  id: string
  label: string
  status: AuthoredRecordStatus
  systemId: string
  streamVersion: number
}

export interface ResolveCharacterBuilderInput {
  character: CharacterAuthored
  mode: CharacterBuilderMode
}

export interface UpsertCharacterBuilderInput {
  character: CharacterAuthored
  mode: CharacterBuilderMode
  targetStatus?: AuthoredRecordStatus
}

export interface PreviewCharacterBuilderInput {
  character: CharacterAuthored
  mode: CharacterBuilderMode
  targetStatus?: AuthoredRecordStatus
}

export interface CreateCharacterDraftInput {
  id: string
  systemId?: string
}

export interface CharacterBuilderPreviewPayload {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  preview: ReturnType<typeof createCharacterBuilderChangePreview>
}

function resolvePersistedCharacterStatus(params: {
  existingStatus?: AuthoredRecordStatus
  targetStatus?: AuthoredRecordStatus
  ready: boolean
}): AuthoredRecordStatus {
  if (params.targetStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    return params.ready
      ? AUTHORED_RECORD_STATUS.ACTIVE
      : AUTHORED_RECORD_STATUS.DRAFT
  }

  if (params.existingStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    return params.ready
      ? AUTHORED_RECORD_STATUS.ACTIVE
      : AUTHORED_RECORD_STATUS.DRAFT
  }

  return AUTHORED_RECORD_STATUS.DRAFT
}

async function buildCharacterBuilderSavePayload(params: {
  ctx: Parameters<typeof createCharacterRepository>[0]
  input: UpsertCharacterBuilderInput | PreviewCharacterBuilderInput
  existing: CharacterAuthored | null
  userId: string
}): Promise<CharacterBuilderPreviewPayload> {
  const authored = {
    ...params.input.character,
    userId: params.userId
  }
  const reconciled = await reconcileCharacterBuilderCharacter(params.ctx, authored, params.existing)
  const draftResolution = await resolveCharacterBuilder(
    params.ctx,
    {
      ...reconciled,
      status: AUTHORED_RECORD_STATUS.DRAFT
    },
    params.input.mode
  )
  const persistedStatus = resolvePersistedCharacterStatus({
    existingStatus: params.existing?.status,
    targetStatus: params.input.targetStatus,
    ready: draftResolution.readiness.ready
  })
  const character = {
    ...reconciled,
    status: persistedStatus
  }
  const resolution = await resolveCharacterBuilder(params.ctx, character, params.input.mode)

  return {
    character,
    resolution,
    preview: createCharacterBuilderChangePreview({
      previousCharacter: params.existing,
      nextCharacter: character,
      predictedStatus: persistedStatus,
      registry: resolution.registry
    })
  }
}

export const getCharacterListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<CharacterListItem[]> => {
    const user = await getAuthUser()
    if (!user) return []

    const db = createDb()
    try {
      return await withUserContext(db, user.id, async (ctx) => {
        const rows = await createCharacterRepository(ctx).listByUser(user.id)
        return rows.map((row) => ({
          id: row.id,
          label: row.label,
          status: row.status,
          systemId: row.system_id,
          streamVersion: row.stream_version
        }))
      })
    } finally {
      await db.destroy()
    }
  })

export const getCharacterBuilderFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) throw new Error('Character id is required.')
    return id
  })
  .handler(async ({ data: id }): Promise<CharacterBuilderPayload | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      return await withUserContext(db, user.id, async (ctx) => {
        const repository = createCharacterRepository(ctx)
        const character = await repository.findAuthoredById(id)
        if (!character) return null

        return {
          character,
          resolution: await resolveCharacterBuilder(ctx, character, 'edit')
        }
      })
    } finally {
      await db.destroy()
    }
  })

export const resolveCharacterBuilderFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: ResolveCharacterBuilderInput) => payload)
  .handler(async ({ data }): Promise<CharacterBuilderPayload> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, async (ctx) => {
        const authored = {
          ...data.character,
          userId: user.id
        }

        return {
          character: authored,
          resolution: await resolveCharacterBuilder(ctx, authored, data.mode)
        }
      })
    } finally {
      await db.destroy()
    }
  })

export const previewCharacterBuilderSaveFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: PreviewCharacterBuilderInput) => payload)
  .handler(async ({ data }): Promise<CharacterBuilderPreviewPayload> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, async (ctx) => {
        const repository = createCharacterRepository(ctx)
        const existing = await repository.findAuthoredById(data.character.id)
        return await buildCharacterBuilderSavePayload({
          ctx,
          input: data,
          existing,
          userId: user.id
        })
      })
    } finally {
      await db.destroy()
    }
  })

export const upsertCharacterBuilderFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: UpsertCharacterBuilderInput) => payload)
  .handler(async ({ data }): Promise<CharacterBuilderPayload> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, async (ctx) => {
        const repository = createCharacterRepository(ctx)
        const existing = await repository.findAuthoredById(data.character.id)
        const previewPayload = await buildCharacterBuilderSavePayload({
          ctx,
          input: data,
          existing,
          userId: user.id
        })

        await repository.upsertAuthored(previewPayload.character)

        const persisted = await repository.findAuthoredById(previewPayload.character.id)
        const character = persisted ?? previewPayload.character

        return {
          character,
          resolution: await resolveCharacterBuilder(ctx, character, data.mode)
        }
      })
    } finally {
      await db.destroy()
    }
  })

export const createCharacterDraftFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: CreateCharacterDraftInput) => {
    if (!payload.id) {
      throw new Error('Character id is required.')
    }
    return payload
  })
  .handler(async ({ data }): Promise<CharacterBuilderPayload> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, async (ctx) => {
        const repository = createCharacterRepository(ctx)
        const existing = await repository.findAuthoredById(data.id)
        if (existing) {
          return {
            character: existing,
            resolution: await resolveCharacterBuilder(ctx, existing, 'create')
          }
        }

        if (!data.systemId) {
          throw new Error('System id is required when creating a new character draft.')
        }

        const character = createEmptyCharacterAuthored({
          id: data.id,
          systemId: data.systemId,
          userId: user.id
        })

        return {
          character,
          resolution: await resolveCharacterBuilder(ctx, character, 'create')
        }
      })
    } finally {
      await db.destroy()
    }
  })
