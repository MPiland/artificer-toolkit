import type { CharacterRuleProficiency } from './characterSheetRuleProjection.js'
import { formatCodeLabel } from './sheetCommandReducer.js'

export function formatProficiencyScaling(scaling: CharacterRuleProficiency['scaling']): string {
  switch (scaling) {
    case 'DOUBLE':
      return 'Expertise'
    case 'HALF':
      return 'Half proficiency'
    case 'FULL':
      return 'Proficient'
  }
}

export function formatProficiencyKind(kind: string): string {
  switch (kind) {
    case 'EQUIPMENT':
      return 'Equipment'
    case 'EQUIPMENT_PROPERTY':
      return 'Equipment property'
    case 'LANGUAGE':
      return 'Language'
    case 'SAVE_ABILITY':
      return 'Saving throw'
    case 'SKILL':
      return 'Skill'
    default:
      return formatCodeLabel(kind)
  }
}

function formatAllProficiencyLabel(kind: string): string {
  switch (kind) {
    case 'EQUIPMENT':
      return 'All equipment'
    case 'EQUIPMENT_PROPERTY':
      return 'All equipment properties'
    case 'LANGUAGE':
      return 'All languages'
    case 'SAVE_ABILITY':
      return 'All saving throws'
    case 'SKILL':
      return 'All skills'
    default:
      return `All ${formatCodeLabel(kind).toLowerCase()}`
  }
}

export function formatProficiencyLabel(params: {
  abilityByCode: ReadonlyMap<string, { label: string }>
  equipmentLabels: ReadonlyMap<string, string>
  languageLabels: ReadonlyMap<string, string>
  proficiency: CharacterRuleProficiency
  skillLabels: ReadonlyMap<string, string>
}): string {
  const { proficiency } = params
  if (proficiency.subjectId === '*') return formatAllProficiencyLabel(proficiency.kind)

  switch (proficiency.kind) {
    case 'EQUIPMENT':
      return params.equipmentLabels.get(proficiency.subjectId) ?? 'Unknown equipment'
    case 'EQUIPMENT_PROPERTY': {
      const propertyLabel = formatCodeLabel(proficiency.subjectId)
      if (proficiency.category === 'ARMOR') return `${propertyLabel} Armor`
      if (proficiency.category === 'WEAPON') return `${propertyLabel} Weapons`
      return propertyLabel
    }
    case 'LANGUAGE':
      return params.languageLabels.get(proficiency.subjectId) ?? 'Unknown language'
    case 'SAVE_ABILITY': {
      const abilityLabel = params.abilityByCode.get(proficiency.subjectId)?.label
      return abilityLabel ? `${abilityLabel} saves` : 'Unknown saving throw'
    }
    case 'SKILL':
      return params.skillLabels.get(proficiency.subjectId) ?? 'Unknown skill'
    default:
      return formatCodeLabel(proficiency.subjectId)
  }
}
