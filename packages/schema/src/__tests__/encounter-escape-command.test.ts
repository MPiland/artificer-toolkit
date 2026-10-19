import { describe, expect, it } from 'vitest'

import { escapeRelationshipInputDtoSchema } from '../api/encounterRuleCommands.js'

const id = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`

const escape = (extra: Record<string, unknown> = {}) => ({
  type: 'ESCAPE',
  encounterId: id(1),
  commandId: id(2),
  expectedVersion: 0,
  actorId: id(3),
  activeEffectId: id(4),
  checkDefinitionId: id(5),
  ...extra
})

describe('an ESCAPE command that frees another creature (ATTACK-7.9)', () => {
  const parse = (value: unknown) => escapeRelationshipInputDtoSchema.safeParse(value).success

  it('escapes for the actor itself when no held creature is named', () => {
    expect(parse(escape())).toBe(true)
  })

  it('names the held creature a rescuer within reach frees', () => {
    expect(parse(escape({ heldActorId: id(6) }))).toBe(true)
  })

  it('refuses a rescuer that names itself as the held creature', () => {
    expect(parse(escape({ heldActorId: id(3) }))).toBe(false)
  })
})
