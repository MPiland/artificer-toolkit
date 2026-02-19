import { type FeatureListItem, type Feature, featureSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getFeatureListQuery, getFeatureQuery } from '@artificer-toolkit/functions'
import type { FeatureInput } from '@types'

// List
export const getFeatureListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<FeatureListItem[]> => {
    const user = await getAuthUser()
    if (!user) return []

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getFeatureListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getFeatureFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a feature')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Feature | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getFeatureQuery(ctx, id))

      return result ? featureSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertFeatureFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: FeatureInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a feature')
    }
    if (!payload) {
      throw new Error('No feature data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Feature> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = featureSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_features', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Feature Error:', error)
      throw new Error(error.message)
    }

    const result = featureSchema.parse(updated)

    return result
  })

// Delete
export const deleteFeatureFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('features').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Feature Error:', error)
      throw new Error(error.message)
    }

    return true
  })
