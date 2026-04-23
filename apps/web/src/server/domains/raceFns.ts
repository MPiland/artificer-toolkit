import { type RaceListItem, type Race, type RaceMeta, raceSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getRaceListQuery, getRaceQuery } from '@artificer-toolkit/functions'
import type { RaceInput } from '@types'

// List
export const getRaceListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ items: RaceListItem[], meta: RaceMeta }> => {
    const user = await getAuthUser()
    if (!user) return {
      items: [],
      meta: {
        categories: [],
        selectionModes: [],
        parentRaces: [],
        features: []
      }
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getRaceListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getRaceFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a race')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Race | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getRaceQuery(ctx, id))

      return result ? raceSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertRaceFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: RaceInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a race')
    }
    if (!payload) {
      throw new Error('No race data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Race> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = raceSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_races', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Race Error:', error)
      throw new Error(error.message)
    }

    const result = raceSchema.parse(updated)
    return result
  })

// Delete
export const deleteRaceFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('races').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Race Error:', error)
      throw new Error(error.message)
    }

    return true
  })
