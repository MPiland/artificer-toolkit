import { type EquipmentListItem, type Equipment, type EquipmentMeta, equipmentSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getEquipmentListQuery, getEquipmentQuery } from '@artificer-toolkit/functions'
import type { EquipmentInput } from '@types'

// List
export const getEquipmentListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ items: EquipmentListItem[], meta: EquipmentMeta }> => {
    const user = await getAuthUser()
    if (!user) return {
      items: [],
      meta: {
        categories: [],
        properties: [],
        primaryDamages: [],
        secondaryDamages: [],
        armorClasses: [],
        costs: [],
        weights: [],
        features: []
      }
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getEquipmentListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getEquipmentFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a equipment')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Equipment | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getEquipmentQuery(ctx, id))

      return result ? equipmentSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertEquipmentFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: EquipmentInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a equipment')
    }
    if (!payload) {
      throw new Error('No equipment data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Equipment> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = equipmentSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_equipment', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Equipment Error:', error)
      throw new Error(error.message)
    }

    const result = equipmentSchema.parse(updated)

    return result
  })

// Delete
export const deleteEquipmentFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('equipment').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Equipment Error:', error)
      throw new Error(error.message)
    }

    return true
  })
