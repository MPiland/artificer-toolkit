import type {
  SpellAuthoringInputDto,
  SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'

export function createEmptySpell({ systemId }: { systemId: string }): SpellAuthoringInputDto {
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
  spell: SpellAuthoringInputDto | SpellAuthoredDto
): SpellAuthoringInputDto {
  return {
    ...spell,
    label: spell.label.trim(),
    description: spell.description ?? '',
    magicSchoolId: spell.magicSchoolId,
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
