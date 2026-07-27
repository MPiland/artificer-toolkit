import type { DBLike } from '#types'
import type { SystemSeedRecord } from '../../../source-data/content.js'

type VocabularyTableName =
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
  if (rows.length === 0) {
    await db.deleteFrom(table).where('system_id', '=', systemId).execute()

    return
  }

  const ids = rows.map((row) => row.id)

  await db
    .deleteFrom(table)
    .where((eb) => eb.and([eb('system_id', '=', systemId), eb('id', 'not in', ids)]))
    .execute()

  await db
    .insertInto(table)
    .values(rows)
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        system_id: eb.ref('excluded.system_id'),
        code: eb.ref('excluded.code'),
        label: eb.ref('excluded.label'),
        description: eb.ref('excluded.description'),
        tooltip: eb.ref('excluded.tooltip'),
        short: eb.ref('excluded.short')
      }))
    )
    .execute()
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
  await db
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
    db,
    'alignments',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.alignments)
  )
  await replaceSystemVocabulary(
    db,
    'challenge_ratings',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.challengeRatings)
  )
  await replaceSystemVocabulary(
    db,
    'condition_types',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.conditionTypes)
  )
  await replaceSystemVocabulary(
    db,
    'creature_types',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.creatureTypes)
  )
  await replaceSystemVocabulary(
    db,
    'currencies',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.currencies)
  )
  await replaceSystemVocabulary(
    db,
    'damage_types',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.damageTypes)
  )
  await replaceSystemVocabulary(
    db,
    'heritages',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.heritages)
  )
  await replaceSystemVocabulary(
    db,
    'languages',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.languages)
  )
  await replaceSystemVocabulary(
    db,
    'lifestyles',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.lifestyles)
  )
  await replaceSystemVocabulary(
    db,
    'magic_schools',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.magicSchools)
  )
  await replaceSystemVocabulary(
    db,
    'passives',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.passives)
  )
  await replaceSystemVocabulary(
    db,
    'rarities',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.rarities)
  )
  await replaceSystemVocabulary(
    db,
    'senses',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.senses)
  )
  await replaceSystemVocabulary(
    db,
    'skills',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.skills)
  )
  await replaceSystemVocabulary(
    db,
    'speeds',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.speeds)
  )
  await replaceSystemVocabulary(
    db,
    'terrains',
    json_data.id,
    mapVocabularyRows(json_data.id, json_data.terrains)
  )
}
