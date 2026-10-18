import {
  authoredNodeRuntimeSourceFactsSchema,
  type AuthoredNodeRuntimeSourceFacts,
  type NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { AuthoredDocumentVersion } from '@artificer-toolkit/schema/projections/authoredContent'
import type {
  EffectPathAuthored,
  ProficiencyGrantAuthored,
  ResultBlockAuthored
} from '@artificer-toolkit/shared/authored'

type Scalar = string | number | boolean | null
type Row = Record<string, Scalar>
type Subject = {
  [K in AuthoredDocumentVersion['subjectKind']]: Pick<
    Extract<AuthoredDocumentVersion, { subjectKind: K }>,
    'subjectKind' | 'document' | 'checksum'
  >
}[AuthoredDocumentVersion['subjectKind']]
type EffectFacts = { id: string; paths: readonly EffectPathAuthored[] }
type ProficiencyGrantFacts = { proficiencies?: readonly ProficiencyGrantAuthored[] }
type FeatureOptionFacts = {
  id: string
  label: string
  effects?: readonly EffectFacts[]
  grants?: ProficiencyGrantFacts
}
type FeatureFacts = FeatureOptionFacts & { options?: readonly FeatureOptionFacts[] }

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
  proficiency_grant_equipment: featureSubjectKinds,
  proficiency_grant_equipment_properties: featureSubjectKinds,
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

  const addResultBlock = (resultBlock: ResultBlockAuthored) => {
    for (const outcome of resultBlock.outcomes) {
      add('effect_result_block_outcomes', {
        result_block_id: resultBlock.id,
        outcome_id: outcome.id
      })
      if (outcome.effectKind === 'CONDITION')
        add('conditions', { id: outcome.id, condition_type_id: outcome.conditionId })
      if (outcome.effectKind === 'DAMAGE')
        add('damages', { id: outcome.id, damage_type_id: outcome.damageTypeId ?? null })
    }
  }

  const addEffect = (effect: EffectFacts) => {
    for (const path of effect.paths) {
      add('effect_paths', {
        effect_id: effect.id,
        id: path.id,
        result_block_id: path.selectionKind === 'FIXED' ? path.resultBlock.id : null
      })
      switch (path.selectionKind) {
        case 'FIXED':
          addResultBlock(path.resultBlock)
          break
        case 'CHOICE':
          for (const option of path.options) {
            add('effect_path_choice_options', {
              path_id: path.id,
              result_block_id: option.resultBlock.id
            })
            addResultBlock(option.resultBlock)
          }
          break
        case 'ROLL_TABLE':
          for (const row of path.rows) {
            if (row.resolutionKind !== 'RESULT') continue
            add('effect_path_roll_table_rows', {
              path_id: path.id,
              result_block_id: row.resultBlock.id
            })
            addResultBlock(row.resultBlock)
          }
          break
      }
    }
  }

  const addGrant = (
    grant: ProficiencyGrantAuthored,
    table:
      | 'class_proficiency_grants'
      | 'feat_proficiency_grants'
      | 'feature_proficiency_grants'
      | 'option_proficiency_grants',
    ownerId: string
  ) => {
    add(table, {
      [table === 'class_proficiency_grants'
        ? 'class_id'
        : table === 'feat_proficiency_grants'
          ? 'feat_id'
          : table === 'feature_proficiency_grants'
            ? 'feature_id'
            : 'option_id']: ownerId,
      proficiency_grant_id: grant.id
    })
    if (grant.authoringModeKind !== 'SELECTED') return
    if (grant.proficiencyKind === 'SKILL')
      for (const skillId of grant.skillIds)
        add('proficiency_grant_skills', { proficiency_grant_id: grant.id, skill_id: skillId })
    if (grant.proficiencyKind === 'LANGUAGE')
      for (const languageId of grant.languageIds)
        add('proficiency_grant_languages', {
          proficiency_grant_id: grant.id,
          language_id: languageId
        })
    if (grant.proficiencyKind === 'EQUIPMENT')
      for (const equipmentId of grant.equipmentIds)
        add('proficiency_grant_equipment', {
          proficiency_grant_id: grant.id,
          equipment_id: equipmentId
        })
    if (grant.proficiencyKind === 'EQUIPMENT_PROPERTY')
      for (const propertyCode of grant.properties)
        add('proficiency_grant_equipment_properties', {
          proficiency_grant_id: grant.id,
          property_code: propertyCode
        })
  }

  const addFeature = (
    feature: FeatureFacts,
    owner: {
      table:
        | 'background_features'
        | 'class_features'
        | 'equipment_features'
        | 'feat_features'
        | 'race_features'
        | 'race_ancestry_option_features'
      key: string
      id: string
    } | null
  ) => {
    add('features', { id: feature.id, label: feature.label })
    if (owner) add(owner.table, { [owner.key]: owner.id, feature_id: feature.id })
    for (const effect of feature.effects ?? []) {
      add('feature_effects', { feature_id: feature.id, effect_id: effect.id })
      addEffect(effect)
    }
    for (const grant of feature.grants?.proficiencies ?? [])
      addGrant(grant, 'feature_proficiency_grants', feature.id)
    for (const option of feature.options ?? []) {
      add('options', { id: option.id, label: option.label })
      add('feature_options', { feature_id: feature.id, option_id: option.id })
      for (const effect of option.effects ?? []) {
        add('option_effects', { option_id: option.id, effect_id: effect.id })
        addEffect(effect)
      }
      for (const grant of option.grants?.proficiencies ?? [])
        addGrant(grant, 'option_proficiency_grants', option.id)
    }
  }

  switch (subject.subjectKind) {
    case 'BACKGROUND': {
      const { document } = subject
      add('backgrounds', { id: document.id, label: document.label })
      for (const feature of document.features ?? [])
        addFeature(feature, { table: 'background_features', key: 'background_id', id: document.id })
      break
    }
    case 'CLASS': {
      const { document } = subject
      add('classes', {
        id: document.id,
        label: document.label,
        category: document.category,
        parent_class_id: document.category === 'SUBCLASS' ? document.parentClassId : null
      })
      for (const feature of document.features ?? [])
        addFeature(feature, { table: 'class_features', key: 'class_id', id: document.id })
      if (document.resources)
        add('class_resources', {
          class_id: document.id,
          id: document.resources.id,
          label: document.resources.label
        })
      const specializations = document.category === 'SUBCLASS' ? document.specializations : []
      for (const specialization of specializations ?? [])
        add('class_specializations', {
          class_id: document.id,
          id: specialization.id,
          label: specialization.label
        })
      for (const grant of [
        ...(document.proficiencies ?? []),
        ...(document.category === 'BASE' ? (document.multiclass.proficiencies ?? []) : [])
      ])
        addGrant(grant, 'class_proficiency_grants', document.id)
      break
    }
    case 'CREATURE': {
      const { document } = subject
      add('creatures', { id: document.id, label: document.label })
      for (const feature of document.features) addFeature(feature, null)
      break
    }
    case 'EQUIPMENT': {
      const { document } = subject
      add('equipment', { id: document.id, label: document.label, category: document.category })
      for (const property of document.properties ?? [])
        add('equipment_properties', { equipment_id: document.id, property_code: property })
      for (const feature of document.features ?? [])
        addFeature(feature, { table: 'equipment_features', key: 'equipment_id', id: document.id })
      for (const effect of document.effects ?? []) {
        add('equipment_effects', { equipment_id: document.id, effect_id: effect.id })
        addEffect(effect)
      }
      break
    }
    case 'FEAT': {
      const { document } = subject
      add('feats', { id: document.id, label: document.label })
      for (const feature of document.features ?? [])
        addFeature(feature, { table: 'feat_features', key: 'feat_id', id: document.id })
      for (const effect of document.effects ?? []) {
        add('feat_effects', { feat_id: document.id, effect_id: effect.id })
        addEffect(effect)
      }
      for (const grant of document.grants?.proficiencies ?? [])
        addGrant(grant, 'feat_proficiency_grants', document.id)
      break
    }
    case 'RACE': {
      const { document } = subject
      add('races', {
        id: document.id,
        label: document.label,
        category: document.category,
        parent_race_id: document.category === 'SUBRACE' ? document.parentRaceId : null
      })
      for (const feature of document.features ?? [])
        addFeature(feature, { table: 'race_features', key: 'race_id', id: document.id })
      const ancestry = document.category === 'BASE' ? document.ancestry : undefined
      if (ancestry) {
        add('race_ancestries', { id: ancestry.id, race_id: document.id })
        for (const option of ancestry.options) {
          add('race_ancestry_options', {
            ancestry_id: ancestry.id,
            id: option.id,
            label: option.label
          })
          for (const feature of option.features ?? [])
            addFeature(feature, {
              table: 'race_ancestry_option_features',
              key: 'ancestry_option_id',
              id: option.id
            })
        }
      }
      break
    }
    case 'SPELL': {
      const { document } = subject
      add('spells', {
        id: document.id,
        label: document.label,
        magic_school_id: document.magicSchoolId
      })
      for (const effect of document.effects ?? []) {
        add('spell_effects', { spell_id: document.id, effect_id: effect.id })
        addEffect(effect)
      }
      break
    }
    case 'VEHICLE':
      for (const feature of subject.document.features ?? []) addFeature(feature, null)
      break
  }

  for (const tableRows of Object.values(rows))
    tableRows?.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  return authoredNodeRuntimeSourceFactsSchema.parse({ checksum: subject.checksum, rows })
}
