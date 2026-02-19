import { type ClassListItem, type Class, type ClassMeta, classSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getClassListQuery, getClassQuery } from '@artificer-toolkit/functions'
import type { ClassInput } from '@types'

// List
export const getClassListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ items: ClassListItem[], meta: ClassMeta }> => {
    const user = await getAuthUser()
    if (!user) return {
      items: [],
      meta: {
        categories: [],
        parentClasses: [],
        multiclassAbilities: [],
        features: []
      }
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getClassListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getClassFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a class')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Class | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getClassQuery(ctx, id))

      return result ? classSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertClassFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: ClassInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a class')
    }
    if (!payload) {
      throw new Error('No class data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Class> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = classSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_classes', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Class Error:', error)
      throw new Error(error.message)
    }

    const result = classSchema.parse(updated)
    return result
  })

// Delete
export const deleteClassFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('classes').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Class Error:', error)
      throw new Error(error.message)
    }

    return true
  })
