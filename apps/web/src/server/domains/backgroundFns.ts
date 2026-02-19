import { type BackgroundListItem, type Background, type BackgroundMeta, backgroundSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getBackgroundListQuery, getBackgroundQuery } from '@artificer-toolkit/functions'
import type { BackgroundInput } from '@types'

// List
export const getBackgroundListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ items: BackgroundListItem[], meta: BackgroundMeta }> => {
    const user = await getAuthUser()
    if (!user) return {
      items: [],
      meta: {
        features: []
      }
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getBackgroundListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getBackgroundFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a background')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Background | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getBackgroundQuery(ctx, id))

      return result ? backgroundSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertBackgroundFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: BackgroundInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a background')
    }
    if (!payload) {
      throw new Error('No background data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Background> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = backgroundSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_backgrounds', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Background Error:', error)
      throw new Error(error.message)
    }

    const result = backgroundSchema.parse(updated)
    return result
  })

// Delete
export const deleteBackgroundFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('backgrounds').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Background Error:', error)
      throw new Error(error.message)
    }

    return true
  })
