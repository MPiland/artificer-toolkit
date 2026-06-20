import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'

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
