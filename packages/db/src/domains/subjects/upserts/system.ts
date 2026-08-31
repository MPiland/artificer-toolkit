import type { DBLike } from '#types'
import type { SystemSeedRecord } from '../../../source-data/content.js'
import { withTransaction } from '../../../utils/index.js'

type VocabularyTableName =
  | 'ability_definitions'
  | 'alignments'
  | 'challenge_ratings'
  | 'condition_types'
  | 'creature_types'
  | 'currencies'
  | 'damage_types'
  | 'heritages'
  | 'languages'
  | 'lifestyles'
  | 'magic_schools'
  | 'passives'
  | 'rarities'
  | 'senses'
  | 'skills'
  | 'speeds'
  | 'terrains'

type VocabularyRow = {
  id: string
  system_id: string
  code: string
  label: string
  description: string | null
  tooltip: string | null
  short: string | null
}

async function replaceSystemVocabulary(
  db: DBLike,
  table: VocabularyTableName,
  systemId: string,
  rows: VocabularyRow[]
) {
  const ids = rows.map((row) => row.id)
  const existingRows = ids.length
    ? await db
        .selectFrom(table)
        .select(['id', 'system_id'])
        .where('id', 'in', ids)
        .forUpdate()
        .execute()
    : []
  const foreignRow = existingRows.find((row) => row.system_id !== systemId)

  if (foreignRow) {
    throw new Error(
      `System vocabulary ${table} UUID "${foreignRow.id}" is already owned by another System.`
    )
  }

  if (rows.length === 0) {
    await db.deleteFrom(table).where('system_id', '=', systemId).execute()

    return
  }

  await db.deleteFrom(table).where('system_id', '=', systemId).where('id', 'not in', ids).execute()

  await db
    .insertInto(table)
    .values(rows)
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        code: eb.ref('excluded.code'),
        label: eb.ref('excluded.label'),
        description: eb.ref('excluded.description'),
        tooltip: eb.ref('excluded.tooltip'),
        short: eb.ref('excluded.short')
      }))
    )
    .execute()

  const persistedRows = await db
    .selectFrom(table)
    .select(['id', 'system_id'])
    .where('id', 'in', ids)
    .forUpdate()
    .execute()
  const persistedForeignRow = persistedRows.find((row) => row.system_id !== systemId)
  if (persistedForeignRow) {
    throw new Error(
      `System vocabulary ${table} UUID "${persistedForeignRow.id}" is already owned by another System.`
    )
  }
}

function mapVocabularyRows(
  systemId: string,
  rows: SystemSeedRecord['alignments']
): VocabularyRow[] {
  return rows.map((row) => ({
    id: row.id,
    system_id: systemId,
    code: row.code,
    label: row.label,
    description: row.description ?? null,
    tooltip: row.tooltip ?? null,
    short: row.short ?? null
  }))
}

export async function upsertSystem(db: DBLike, json_data: SystemSeedRecord) {
  return withTransaction(db, async (trx) => {
    await trx
      .insertInto('systems')
      .values({
        id: json_data.id,
        user_id: json_data.userId,
        label: json_data.label,
        description: json_data.description ?? null,
        ruleset_code: json_data.rulesetCode,
        ruleset_version: json_data.rulesetVersion
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          user_id: eb.ref('excluded.user_id'),
          label: eb.ref('excluded.label'),
          description: eb.ref('excluded.description'),
          ruleset_code: eb.ref('excluded.ruleset_code'),
          ruleset_version: eb.ref('excluded.ruleset_version')
        }))
      )
      .execute()

    await replaceSystemVocabulary(
      trx,
      'ability_definitions',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.abilities ?? [])
    )
    await replaceSystemVocabulary(
      trx,
      'alignments',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.alignments)
    )
    await replaceSystemVocabulary(
      trx,
      'challenge_ratings',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.challengeRatings)
    )
    await replaceSystemVocabulary(
      trx,
      'condition_types',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.conditionTypes)
    )
    await replaceSystemVocabulary(
      trx,
      'creature_types',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.creatureTypes)
    )
    await replaceSystemVocabulary(
      trx,
      'currencies',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.currencies)
    )
    await replaceSystemVocabulary(
      trx,
      'damage_types',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.damageTypes)
    )
    await replaceSystemVocabulary(
      trx,
      'heritages',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.heritages)
    )
    await replaceSystemVocabulary(
      trx,
      'languages',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.languages)
    )
    await replaceSystemVocabulary(
      trx,
      'lifestyles',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.lifestyles)
    )
    await replaceSystemVocabulary(
      trx,
      'magic_schools',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.magicSchools)
    )
    await replaceSystemVocabulary(
      trx,
      'passives',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.passives)
    )
    await replaceSystemVocabulary(
      trx,
      'rarities',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.rarities)
    )
    await replaceSystemVocabulary(
      trx,
      'senses',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.senses)
    )
    await replaceSystemVocabulary(
      trx,
      'skills',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.skills)
    )
    await replaceSystemVocabulary(
      trx,
      'speeds',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.speeds)
    )
    await replaceSystemVocabulary(
      trx,
      'terrains',
      json_data.id,
      mapVocabularyRows(json_data.id, json_data.terrains)
    )
  })
}
