import type {
  SpellAuthoringInputDto,
  SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'
import type { SpellReferenceOption } from '#app/data/spells/referenceData'

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
  magicSchoolId,
  systemId
}: {
  magicSchoolId?: string
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
    magicSchoolId: magicSchoolId ?? '',
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
  fallbackMagicSchoolId = ''
): SpellAuthoringInputDto {
  return {
    ...spell,
    label: spell.label.trim() || 'Untitled Spell',
    description: spell.description ?? '',
    magicSchoolId: spell.magicSchoolId || fallbackMagicSchoolId,
    systemId: spell.systemId,
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

export function hasMaterialComponent(
  spell: Pick<SpellAuthoredDto, 'components' | 'materialDescription'>
): boolean {
  return Boolean(spell.components?.includes('MATERIAL') || spell.materialDescription)
}

export function getSelectData(options: SpellReferenceOption[]): SpellReferenceOption[] {
  return options.length > 0 ? options : [emptyOption]
}
