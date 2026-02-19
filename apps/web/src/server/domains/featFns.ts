import { type FeatListItem, type Feat, type FeatMeta, featSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getFeatListQuery, getFeatQuery } from '@artificer-toolkit/functions'
import type { FeatInput } from '@types'

// List
export const getFeatListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ items: FeatListItem[], meta: FeatMeta }> => {
    const user = await getAuthUser()
    if (!user) return {
      items: [],
      meta: {
        features: []
      }
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getFeatListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getFeatFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a feat')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Feat | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getFeatQuery(ctx, id))

      return result ? featSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertFeatFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: FeatInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a feat')
    }
    if (!payload) {
      throw new Error('No feat data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Feat> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = featSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_feats', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Feat Error:', error)
      throw new Error(error.message)
    }

    const result = featSchema.parse(updated)
    return result
  })

// Delete
export const deleteFeatFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('feats').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Feat Error:', error)
      throw new Error(error.message)
    }

    return true
  })
