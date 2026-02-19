import { type SpellListItem, type Spell, type SpellMeta, spellSchema } from '@artificer-toolkit/shared'
import { createServerFn } from '@tanstack/react-start'
import { getAuthUser, getSupabaseServerClient } from '@supabase'
import { createDb, withUserContext, type Json } from '@artificer-toolkit/db'
import { getSpellListQuery, getSpellQuery } from '@artificer-toolkit/functions'
import type { SpellInput } from '@types'

// List
export const getSpellListFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ items: SpellListItem[], meta: SpellMeta }> => {
    const user = await getAuthUser()
    if (!user) return {
      items: [],
      meta: {
        attributes: [],
        primaryDamages: [],
        secondaryDamages: [],
        bonusDamages: [],
        castingActions: [],
        secondaryActions: [],
        bonusActions: [],
        conditions: [],
        classes: [],
        durations: [],
        ranges: [],
        shapes: [],
        schools: [],
        levels: [],
        saveDcs: [],
        requirements: []
      }
    }

    const db = createDb()
    try {
      return await withUserContext(db, user.id, (ctx) => getSpellListQuery(ctx))
    } finally {
      await db.destroy()
    }
  })

// Single
export const getSpellFn = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => {
    if (!id) {
      throw new Error('Id is required to select a spell')
    }

    return id
  })
  .handler(async ({ data: id }): Promise<Spell | null> => {
    const user = await getAuthUser()
    if (!user) return null

    const db = createDb()
    try {
      const result = await withUserContext(db, user.id, (ctx) => getSpellQuery(ctx, id))

      return result ? spellSchema.parse(result) : null
    } finally {
      await db.destroy()
    }
  })

// Add/Update
export const upsertSpellFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: SpellInput) => {
    if (!payload.id) {
      throw new Error('Id is required to select a spell')
    }
    if (!payload) {
      throw new Error('No spell data to process')
    }

    return payload
  })
  .handler(async ({ data }): Promise<Spell> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const parsed = spellSchema.parse(data)

    const { data: updated, error } = await supabase.rpc('upsert_spells', {
      json_data: parsed as unknown as Json
    })

    if (error) {
      console.error('Upsert Spell Error:', error)
      throw new Error(error.message)
    }

    const result = spellSchema.parse(updated)
    return result
  })

// Delete
export const deleteSpellFn = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }): Promise<boolean> => {
    const user = await getAuthUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = getSupabaseServerClient()

    const { error } = await supabase.from('spells').delete()
      .eq('id', id)

    if (error) {
      console.error('Delete Spell Error:', error)
      throw new Error(error.message)
    }

    return true
  })
