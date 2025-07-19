import type { Spell } from '../../../../../../gql/types'

type MetaObject = { spellIds: string[]; id: string | number }

type ActionMetaObject = MetaObject & {
  amount?: number | null
}

type RangeMetaObject = MetaObject & {
  unit?: string | null
  minRange?: number | null
  maxRange?: number | null
  distance?: number | null
}

type DurationMetaObject = MetaObject & {
  amount?: number | null
}

type ShapeMetaObject = MetaObject & {
  size?: number | null
  unit?: string | null
}

export type MetaData = {
  attributes: MetaObject[]
  primaryDamages: MetaObject[]
  secondaryDamages: MetaObject[]
  primaryActions: ActionMetaObject[]
  secondaryActions: ActionMetaObject[]
  conditions: MetaObject[]
  classes: MetaObject[]
  durations: DurationMetaObject[]
  ranges: RangeMetaObject[]
  shapes: ShapeMetaObject[]
  schools: MetaObject[]
  levels: MetaObject[]
  saveAbilities: MetaObject[]
  requirements: MetaObject[]
}

export const metaData: MetaData = {
  attributes: [],
  primaryDamages: [],
  secondaryDamages: [],
  primaryActions: [],
  secondaryActions: [],
  conditions: [],
  classes: [],
  durations: [],
  ranges: [],
  shapes: [],
  schools: [],
  levels: [],
  saveAbilities: [],
  requirements: [],
}

export const itemsToMeta = (items: Spell[]) => {
  items.map((item) => {
    if (item.attributes?.length) {
      item.attributes.forEach((attribute) => {
        addToMeta(metaData.attributes, attribute, item.id)
      })
    }
    if (item.damage?.primary?.id) {
      addToMeta(metaData.primaryDamages, item.damage.primary.id, item.id)
    }
    if (item.damage?.secondary?.id) {
      addToMeta(metaData.secondaryDamages, item.damage.secondary.id, item.id)
    }
    if (item.actions?.primary?.id) {
      addToMeta(metaData.primaryActions, item.actions.primary.id, item.id, {
        amount: item.actions.primary.amount || null,
      })
    }
    if (item.actions?.secondary?.id) {
      addToMeta(metaData.secondaryActions, item.actions.secondary.id, item.id, {
        amount: item.actions.secondary.amount || null,
      })
    }
    if (item.conditions?.length) {
      item.conditions.forEach((condition) => {
        addToMeta(metaData.conditions, condition, item.id)
      })
    }
    if (item.classes?.length) {
      item.classes.forEach((classId) => {
        addToMeta(metaData.classes, classId, item.id)
      })
    }
    if (item.range?.id) {
      addToMeta(metaData.ranges, item.range.id, item.id, {
        unit: item.range.unit,
        minRange: item.range.minRange,
        maxRange: item.range.maxRange,
        distance: item.range.distance,
      })
    }
    if (item.shape?.id) {
      addToMeta(metaData.shapes, item.shape.id, item.id, {
        unit: item.shape.unit,
        size: item.shape.size,
      })
    }
    if (item.duration?.id) {
      addToMeta(metaData.durations, item.duration.id, item.id, {
        amount: item.duration.amount,
      })
    }
    if (item.school) {
      addToMeta(metaData.schools, item.school, item.id)
    }
    if (item.level) {
      addToMeta(metaData.levels, item.level, item.id)
    }
    if (item.saveAbility?.id) {
      addToMeta(metaData.saveAbilities, item.saveAbility.id, item.id)
    }
    if (item.requirements?.length) {
      item.requirements.forEach((requirement) => {
        addToMeta(metaData.requirements, requirement, item.id)
      })
    }
  })
}

export const addToMeta = <T extends Record<string, unknown>>(
  metaArray: (MetaObject & T)[],
  keyId: string | number,
  spellId: string,
  additionalFields?: T
) => {
  // If we have additional fields, we need to find an exact match
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    )

    if (exactMatch) {
      // Add spellId to the existing entry with matching fields
      exactMatch.spellIds.push(spellId)
    } else {
      // Create a new entry with the additional fields
      metaArray.push({
        id: keyId,
        spellIds: [spellId],
        ...additionalFields,
      } as MetaObject & T)
    }
  } else {
    // Original behavior for simple ID-only metadata
    const existing = metaArray.find((m) => m.id === keyId)
    if (!existing) {
      metaArray.push({ id: keyId, spellIds: [spellId] } as MetaObject & T)
    } else {
      existing.spellIds.push(spellId)
    }
  }
}
