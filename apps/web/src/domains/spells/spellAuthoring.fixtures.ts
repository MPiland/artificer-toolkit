import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import type { SpellReferenceData } from '#app/data/spells/referenceData'

export const spellReferenceFixture: SpellReferenceData = {
  systemId: 'srd',
  magicSchools: [
    { value: 'evocation', label: 'Evocation' },
    { value: 'abjuration', label: 'Abjuration' }
  ],
  classes: [
    { value: 'wizard', label: 'Wizard' },
    { value: 'sorcerer', label: 'Sorcerer' }
  ],
  damageTypes: [
    { value: 'fire', label: 'Fire' },
    { value: 'cold', label: 'Cold' }
  ],
  conditionTypes: [
    { value: 'blinded', label: 'Blinded' },
    { value: 'restrained', label: 'Restrained' }
  ],
  skills: [{ value: 'arcana', label: 'Arcana' }],
  speeds: [{ value: 'walk', label: 'Walk' }],
  creatures: [{ value: 'sprite', label: 'Sprite' }]
}

export const spellFixture: SpellAuthoredDto = {
  kind: 'SPELL',
  id: 'spell-fire-lace',
  label: 'Fire Lace',
  status: 'DRAFT',
  description: 'A ribbon of flame follows a creature across the battlefield.',
  level: 2,
  classIds: ['wizard', 'sorcerer'],
  magicSchoolId: 'evocation',
  castingTime: {
    amount: 1,
    unit: 'ROUND'
  },
  attributes: ['CONCENTRATION'],
  components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
  materialDescription: 'A red silk thread.',
  effects: [],
  userId: 'user-1',
  systemId: 'srd'
}
