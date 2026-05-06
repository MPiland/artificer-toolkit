import type {
  SpellAuthoringInputDto,
  SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'
import type { SpellReferenceData, SpellReferenceOption } from '#app/data/spells/referenceData'

export const spellLevelOptions = [
  { value: '0', label: 'Cantrip' },
  { value: '1', label: '1st level' },
  { value: '2', label: '2nd level' },
  { value: '3', label: '3rd level' },
  { value: '4', label: '4th level' },
  { value: '5', label: '5th level' },
  { value: '6', label: '6th level' },
  { value: '7', label: '7th level' },
  { value: '8', label: '8th level' },
  { value: '9', label: '9th level' }
]

export const castingTimeUnitOptions = [
  { value: 'ROUND', label: 'Round' },
  { value: 'MINUTE', label: 'Minute' },
  { value: 'HOUR', label: 'Hour' }
]

export const spellAttributeOptions = [
  { value: 'CONCENTRATION', label: 'Concentration' },
  { value: 'RITUAL', label: 'Ritual' },
  { value: 'ADDS_TO_WEAPON_ATTACK', label: 'Adds to weapon attack' }
]

export const spellComponentOptions = [
  { value: 'VERBAL', label: 'Verbal' },
  { value: 'SOMATIC', label: 'Somatic' },
  { value: 'MATERIAL', label: 'Material' }
]

export const emptyOption = { value: '', label: 'None yet' }

export function createEmptySpell({
  systemId
}: {
  systemId: string
}): SpellAuthoringInputDto {
  return {
    kind: 'SPELL',
    id: crypto.randomUUID(),
    label: '',
    status: 'DRAFT',
    description: '',
    level: 0,
    classIds: [],
    magicSchoolId: '',
    castingTime: {
      amount: 1,
      unit: 'ROUND'
    },
    attributes: [],
    components: [],
    effects: [],
    systemId
  }
}

export function normalizeSpellForSubmit(
  spell: SpellAuthoringInputDto | SpellAuthoredDto,
  references: SpellReferenceData
): SpellAuthoringInputDto {
  return {
    ...spell,
    label: spell.label.trim() || 'Untitled Spell',
    description: spell.description ?? '',
    magicSchoolId: spell.magicSchoolId || references.magicSchools[0]?.value || 'unknown-school',
    systemId: spell.systemId || references.systemId,
    castingTime: {
      amount: Number(spell.castingTime?.amount ?? 1),
      unit: spell.castingTime?.unit ?? 'ROUND'
    },
    classIds: spell.classIds ?? [],
    attributes: spell.attributes ?? [],
    components: spell.components ?? [],
    materialDescription: spell.components?.includes('MATERIAL')
      ? spell.materialDescription
      : undefined,
    effects: spell.effects ?? []
  }
}

export function hasMaterialComponent(spell: Pick<SpellAuthoredDto, 'components' | 'materialDescription'>): boolean {
  return Boolean(spell.components?.includes('MATERIAL') || spell.materialDescription)
}

export function getSelectData(options: SpellReferenceOption[]): SpellReferenceOption[] {
  return options.length > 0 ? options : [emptyOption]
}
