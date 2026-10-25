import {
  authoredDetailResponseSchemas,
  type AuthoredDetailReadInput
} from '@artificer-toolkit/schema/api/content'
import { collectReferenceIds } from '@artificer-toolkit/shared/utils'
import type { QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot } from './documents'
import { readSystem } from './systemDocuments'

function referenceIds(
  kind: AuthoredDetailReadInput['subjectKind'],
  item: Record<string, unknown>,
  key: string
) {
  const collect = (singular: string, plural: string, value: unknown = item) =>
    collectReferenceIds(value, singular, plural)
  switch (key) {
    case 'classes':
      if (kind === 'EQUIPMENT') return collect('classId', 'classIds', item.restrictions)
      return collect(
        kind === 'CLASS' ? 'parentClassId' : 'classId',
        'classIds',
        kind === 'CLASS' ? { parentClassId: item.parentClassId } : { classIds: item.classIds }
      )
    case 'races':
      return collect('parentRaceId', 'raceIds', { parentRaceId: item.parentRaceId })
    case 'equipment':
      if (kind === 'CREATURE') return collect('equipmentId', 'equipmentIds', item.equipmentLoadout)
      if (kind === 'EQUIPMENT')
        return [
          ...collect('parentEquipmentId', 'equipmentIds', {
            parentEquipmentId: item.parentEquipmentId
          }),
          ...collect('equipmentId', 'equipmentIds', item.contains)
        ]
      return collect('equipmentId', 'equipmentIds')
    case 'currencies':
      return collect('currencyId', 'currencyIds', kind === 'VEHICLE' ? item.cost : item)
    case 'languages':
      return collect('languageId', 'languageIds')
    case 'skills':
      return collect('skillId', 'skillIds')
    case 'magicSchools':
      return collect('magicSchoolId', 'magicSchoolIds')
    case 'damageTypes':
      return kind === 'CREATURE'
        ? collect('damageTypeId', 'damageTypeIds', {
            damageTypeIds: [
              item.damageVulnerabilities,
              item.damageResistances,
              item.damageImmunities
            ].flat(),
            qualifiedDamageDefenses: item.qualifiedDamageDefenses
          })
        : collect('damageTypeId', 'damageTypeIds')
    case 'conditionTypes':
      return kind === 'CREATURE'
        ? collect('conditionId', 'conditionIds', { conditionIds: item.conditionImmunities })
        : [
            ...collect('conditionTypeId', 'conditionTypeIds'),
            ...collect('conditionId', 'conditionIds')
          ]
    case 'heritages':
      if (kind === 'EQUIPMENT') return collect('heritageId', 'heritageIds', item.restrictions)
      return collect('heritageId', 'heritageIds', { heritageIds: item.heritageIds })
    case 'speeds':
      return collect('speedId', 'speedIds', item.speeds)
    case 'challengeRatings':
      return collect('challengeRatingId', 'challengeRatingIds', {
        challengeRatingId: item.challengeRatingId
      })
    case 'creatureTypes':
      return collect('creatureTypeId', 'creatureTypeIds', { creatureTypeId: item.creatureTypeId })
    case 'rarities':
      return collect('rarityId', 'rarityIds', { rarityId: item.rarityId })
    default:
      return []
  }
}

export async function readDetailMeta(
  ctx: QueryCtx,
  input: AuthoredDetailReadInput,
  item: Record<string, unknown> & { systemId: string },
  userId: string | null
) {
  if (!input.meta?.length || input.subjectKind === 'FEAT') return undefined
  const metaSchema =
    authoredDetailResponseSchemas[input.subjectKind]._zod.def.innerType.shape.meta._zod.def
      .innerType
  const keys = [...new Set(input.meta)].filter((key) => Object.hasOwn(metaSchema.shape, key))
  const system = await ctx.db
    .query('systems')
    .withIndex('by_publicId', (q) => q.eq('id', item.systemId))
    .unique()
  if (!system) throw new Error('System not found.')
  const vocabulary = readSystem(system)
  const meta: Record<string, { value: string; label: string; short?: string }[]> = {}
  for (const key of keys) {
    if (key === 'abilities') {
      // A stat block shows every System ability, in System order.
      meta.abilities = vocabulary.abilities.map(({ code, label, short }) => ({
        value: code,
        label,
        short: short ?? label
      }))
      continue
    }
    const ids = new Set(referenceIds(input.subjectKind, item, key))
    if (key === 'classes' || key === 'races' || key === 'equipment') {
      const kind = key === 'classes' ? 'CLASS' : key === 'races' ? 'RACE' : 'EQUIPMENT'
      const options = await Promise.all(
        [...ids].map(async (id) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
          if (
            !root ||
            root.subjectKind !== kind ||
            root.systemId !== item.systemId ||
            !(await canReadAuthoredRoot(ctx, root, userId))
          )
            return null
          return { value: root.id, label: root.label }
        })
      )
      meta[key] = options.filter((option) => option !== null)
    } else {
      const entries = Object.entries(vocabulary).find(([name]) => name === key)?.[1]
      meta[key] = Array.isArray(entries)
        ? entries
            .filter((entry) => ids.has(entry.id))
            .map((entry) => ({ value: entry.id, label: entry.label }))
        : []
    }
    meta[key].sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value))
  }
  return meta
}
