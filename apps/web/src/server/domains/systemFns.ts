import { type SystemListItem, type System, systemSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getSystemListQuery, getSystemQuery } from '@artificer-toolkit/functions'
import type { SystemInput } from '@types'

// List
export const getSystemListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<SystemListItem[]> => {
    const user = await getAuthUser()
    if (!user) return []

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getSystemListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getSystemFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a system')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<System | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getSystemQuery(ctx, id))

      return result ? systemSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertSystemFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: SystemInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a system')
    }
    if (!payload) {
      throw new Error('No system data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<System> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = systemSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_systems', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert System Error:', error)
      throw new Error(error.message)
    }

    const result = systemSchema.parse(updated)

    return result
  })

// Delete
export const deleteSystemFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('systems').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete System Error:', error)
      throw new Error(error.message)
    }

    return true
  })
