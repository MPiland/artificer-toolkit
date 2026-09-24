import {
  authoredNodeRuntimeSourceFactsSchema,
  type AuthoredNodeRuntimeSourceFacts,
  type NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { AuthoredDocumentVersion } from '@artificer-toolkit/schema/projections/authoredContent'

type Scalar = string | number | boolean | null
type Row = Record<string, Scalar>
type AuthoredRecord = Record<string, unknown>
type Subject = Pick<AuthoredDocumentVersion, 'subjectKind' | 'document' | 'checksum'>

const featureSubjectKinds = [
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'VEHICLE'
] as const

const effectSubjectKinds = [...featureSubjectKinds, 'SPELL'] as const

/** Authored roots whose facts can populate each closed resolver source table. */
export const authoredSourceKindsByTable: Readonly<
  Partial<Record<NodeRuntimeSourceTable, readonly Subject['subjectKind'][]>>
> = {
  background_features: ['BACKGROUND'],
  backgrounds: ['BACKGROUND'],
  class_features: ['CLASS'],
  class_proficiency_grants: ['CLASS'],
  class_resources: ['CLASS'],
  class_specializations: ['CLASS'],
  classes: ['CLASS'],
  conditions: effectSubjectKinds,
  creatures: ['CREATURE'],
  damages: effectSubjectKinds,
  effect_path_choice_options: effectSubjectKinds,
  effect_path_roll_table_rows: effectSubjectKinds,
  effect_paths: effectSubjectKinds,
  effect_result_block_outcomes: effectSubjectKinds,
  equipment: ['EQUIPMENT'],
  equipment_effects: ['EQUIPMENT'],
  equipment_features: ['EQUIPMENT'],
  equipment_properties: ['EQUIPMENT'],
  feat_effects: ['FEAT'],
  feat_features: ['FEAT'],
  feat_proficiency_grants: ['FEAT'],
  feats: ['FEAT'],
  feature_effects: featureSubjectKinds,
  feature_options: featureSubjectKinds,
  feature_proficiency_grants: featureSubjectKinds,
  features: featureSubjectKinds,
  option_effects: featureSubjectKinds,
  option_proficiency_grants: featureSubjectKinds,
  options: featureSubjectKinds,
  proficiency_grant_languages: featureSubjectKinds,
  proficiency_grant_skills: featureSubjectKinds,
  race_ancestries: ['RACE'],
  race_ancestry_option_features: ['RACE'],
  race_ancestry_options: ['RACE'],
  race_features: ['RACE'],
  races: ['RACE'],
  spell_effects: ['SPELL'],
  spells: ['SPELL']
}

function records(value: unknown): AuthoredRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AuthoredRecord => !!entry && typeof entry === 'object')
    : []
}

function value(record: AuthoredRecord, key: string): Scalar {
  const candidate = record[key]
  if (
    typeof candidate === 'string' ||
    typeof candidate === 'number' ||
    typeof candidate === 'boolean' ||
    candidate === null
  )
    return candidate
  throw new Error(`Authored source fact is missing scalar ${key}.`)
}

function optionalValue(record: AuthoredRecord, key: string): Scalar {
  return record[key] === undefined ? null : value(record, key)
}

function projectionRows() {
  const rows: Partial<Record<NodeRuntimeSourceTable, Row[]>> = {}
  const identities = new Map<NodeRuntimeSourceTable, Map<string, string>>()
  const seen = new Map<NodeRuntimeSourceTable, Set<string>>()

  function add(table: NodeRuntimeSourceTable, row: Row) {
    const canonical = JSON.stringify(row)
    const id = row.id
    if (typeof id === 'string') {
      const known = identities.get(table) ?? new Map<string, string>()
      const previous = known.get(id)
      if (previous && previous !== canonical)
        throw new Error(`Incompatible ${table} row for ${id}.`)
      known.set(id, canonical)
      identities.set(table, known)
    }
    const knownRows = seen.get(table) ?? new Set<string>()
    if (knownRows.has(canonical)) return
    knownRows.add(canonical)
    seen.set(table, knownRows)
    const tableRows = rows[table] ?? []
    tableRows.push(row)
    rows[table] = tableRows
  }

  return { rows, add }
}

/** Derives the resolver's compact, checksum-bound source facts from one validated authored root. */
export function authoredSourceFacts(subject: Subject): AuthoredNodeRuntimeSourceFacts {
  const { rows, add } = projectionRows()

  const addResultBlock = (resultBlock: AuthoredRecord) => {
    for (const outcome of records(resultBlock.outcomes)) {
      add('effect_result_block_outcomes', {
        result_block_id: value(resultBlock, 'id'),
        outcome_id: value(outcome, 'id')
      })
      if (outcome.effectKind === 'CONDITION')
        add('conditions', {
          id: value(outcome, 'id'),
          condition_type_id: value(outcome, 'conditionId')
        })
      if (outcome.effectKind === 'DAMAGE')
        add('damages', { id: value(outcome, 'id'), damage_type_id: value(outcome, 'damageTypeId') })
    }
  }

  const addEffect = (effect: AuthoredRecord) => {
    for (const path of records(effect.paths)) {
      add('effect_paths', {
        effect_id: value(effect, 'id'),
        id: value(path, 'id'),
        result_block_id:
          path.selectionKind === 'FIXED' ? value(path.resultBlock as AuthoredRecord, 'id') : null
      })
      if (path.selectionKind === 'FIXED') addResultBlock(path.resultBlock as AuthoredRecord)
      if (path.selectionKind === 'CHOICE')
        for (const option of records(path.options)) {
          const resultBlock = option.resultBlock as AuthoredRecord
          add('effect_path_choice_options', {
            path_id: value(path, 'id'),
            result_block_id: value(resultBlock, 'id')
          })
          addResultBlock(resultBlock)
        }
      if (path.selectionKind === 'ROLL_TABLE')
        for (const row of records(path.rows)) {
          if (row.resolutionKind !== 'RESULT') continue
          const resultBlock = row.resultBlock as AuthoredRecord
          add('effect_path_roll_table_rows', {
            path_id: value(path, 'id'),
            result_block_id: value(resultBlock, 'id')
          })
          addResultBlock(resultBlock)
        }
    }
  }

  const addGrant = (
    grant: AuthoredRecord,
    table:
      | 'class_proficiency_grants'
      | 'feat_proficiency_grants'
      | 'feature_proficiency_grants'
      | 'option_proficiency_grants',
    ownerId: Scalar
  ) => {
    add(table, {
      [table === 'class_proficiency_grants'
        ? 'class_id'
        : table === 'feat_proficiency_grants'
          ? 'feat_id'
          : table === 'feature_proficiency_grants'
            ? 'feature_id'
            : 'option_id']: ownerId,
      proficiency_grant_id: value(grant, 'id')
    })
    if (grant.authoringModeKind !== 'SELECTED') return
    for (const skillId of Array.isArray(grant.skillIds) ? grant.skillIds : [])
      if (typeof skillId === 'string')
        add('proficiency_grant_skills', {
          proficiency_grant_id: value(grant, 'id'),
          skill_id: skillId
        })
    for (const languageId of Array.isArray(grant.languageIds) ? grant.languageIds : [])
      if (typeof languageId === 'string')
        add('proficiency_grant_languages', {
          proficiency_grant_id: value(grant, 'id'),
          language_id: languageId
        })
  }

  const addFeature = (
    feature: AuthoredRecord,
    owner: {
      table:
        | 'background_features'
        | 'class_features'
        | 'equipment_features'
        | 'feat_features'
        | 'race_features'
        | 'race_ancestry_option_features'
      key: string
      id: Scalar
    } | null
  ) => {
    add('features', { id: value(feature, 'id'), label: value(feature, 'label') })
    if (owner) add(owner.table, { [owner.key]: owner.id, feature_id: value(feature, 'id') })
    for (const effect of records(feature.effects)) {
      add('feature_effects', { feature_id: value(feature, 'id'), effect_id: value(effect, 'id') })
      addEffect(effect)
    }
    for (const grant of records((feature.grants as AuthoredRecord | undefined)?.proficiencies))
      addGrant(grant, 'feature_proficiency_grants', value(feature, 'id'))
    for (const option of records(feature.options)) {
      add('options', { id: value(option, 'id'), label: value(option, 'label') })
      add('feature_options', { feature_id: value(feature, 'id'), option_id: value(option, 'id') })
      for (const effect of records(option.effects)) {
        add('option_effects', { option_id: value(option, 'id'), effect_id: value(effect, 'id') })
        addEffect(effect)
      }
      for (const grant of records((option.grants as AuthoredRecord | undefined)?.proficiencies))
        addGrant(grant, 'option_proficiency_grants', value(option, 'id'))
    }
  }

  const document = subject.document as unknown as AuthoredRecord
  switch (subject.subjectKind) {
    case 'BACKGROUND':
      add('backgrounds', { id: value(document, 'id'), label: value(document, 'label') })
      for (const feature of records(document.features))
        addFeature(feature, {
          table: 'background_features',
          key: 'background_id',
          id: value(document, 'id')
        })
      break
    case 'CLASS':
      add('classes', {
        id: value(document, 'id'),
        label: value(document, 'label'),
        category: value(document, 'category'),
        parent_class_id: optionalValue(document, 'parentClassId')
      })
      for (const feature of records(document.features))
        addFeature(feature, { table: 'class_features', key: 'class_id', id: value(document, 'id') })
      if (
        document.resources &&
        typeof document.resources === 'object' &&
        !Array.isArray(document.resources)
      ) {
        const resource = document.resources as AuthoredRecord
        add('class_resources', {
          class_id: value(document, 'id'),
          id: value(resource, 'id'),
          label: value(resource, 'label')
        })
      }
      for (const specialization of records(document.specializations))
        add('class_specializations', {
          class_id: value(document, 'id'),
          id: value(specialization, 'id'),
          label: value(specialization, 'label')
        })
      for (const grant of [
        ...records(document.proficiencies),
        ...records((document.multiclass as AuthoredRecord | undefined)?.proficiencies)
      ])
        addGrant(grant, 'class_proficiency_grants', value(document, 'id'))
      break
    case 'CREATURE':
      add('creatures', { id: value(document, 'id'), label: value(document, 'label') })
      for (const feature of records(document.features)) addFeature(feature, null)
      break
    case 'EQUIPMENT':
      add('equipment', {
        id: value(document, 'id'),
        label: value(document, 'label'),
        category: value(document, 'category')
      })
      for (const property of Array.isArray(document.properties) ? document.properties : [])
        if (typeof property === 'string')
          add('equipment_properties', {
            equipment_id: value(document, 'id'),
            property_code: property
          })
      for (const feature of records(document.features))
        addFeature(feature, {
          table: 'equipment_features',
          key: 'equipment_id',
          id: value(document, 'id')
        })
      for (const effect of records(document.effects)) {
        add('equipment_effects', {
          equipment_id: value(document, 'id'),
          effect_id: value(effect, 'id')
        })
        addEffect(effect)
      }
      break
    case 'FEAT':
      add('feats', { id: value(document, 'id'), label: value(document, 'label') })
      for (const feature of records(document.features))
        addFeature(feature, { table: 'feat_features', key: 'feat_id', id: value(document, 'id') })
      for (const effect of records(document.effects)) {
        add('feat_effects', { feat_id: value(document, 'id'), effect_id: value(effect, 'id') })
        addEffect(effect)
      }
      for (const grant of records((document.grants as AuthoredRecord | undefined)?.proficiencies))
        addGrant(grant, 'feat_proficiency_grants', value(document, 'id'))
      break
    case 'RACE': {
      add('races', {
        id: value(document, 'id'),
        label: value(document, 'label'),
        category: value(document, 'category'),
        parent_race_id: optionalValue(document, 'parentRaceId')
      })
      for (const feature of records(document.features))
        addFeature(feature, { table: 'race_features', key: 'race_id', id: value(document, 'id') })
      const ancestry = document.ancestry as AuthoredRecord | undefined
      if (ancestry) {
        add('race_ancestries', { id: value(ancestry, 'id'), race_id: value(document, 'id') })
        for (const option of records(ancestry.options)) {
          add('race_ancestry_options', {
            ancestry_id: value(ancestry, 'id'),
            id: value(option, 'id'),
            label: value(option, 'label')
          })
          for (const feature of records(option.features))
            addFeature(feature, {
              table: 'race_ancestry_option_features',
              key: 'ancestry_option_id',
              id: value(option, 'id')
            })
        }
      }
      break
    }
    case 'SPELL':
      add('spells', {
        id: value(document, 'id'),
        label: value(document, 'label'),
        magic_school_id: value(document, 'magicSchoolId')
      })
      for (const effect of records(document.effects)) {
        add('spell_effects', { spell_id: value(document, 'id'), effect_id: value(effect, 'id') })
        addEffect(effect)
      }
      break
    case 'VEHICLE':
      for (const feature of records(document.features)) addFeature(feature, null)
      break
  }

  for (const tableRows of Object.values(rows))
    tableRows?.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  return authoredNodeRuntimeSourceFactsSchema.parse({ checksum: subject.checksum, rows })
}
