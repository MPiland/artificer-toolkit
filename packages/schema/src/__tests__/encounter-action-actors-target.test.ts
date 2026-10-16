import { describe, expect, it } from 'vitest'

import { resolveEncounterActionTargetDtoSchema } from '../api/encounterRuleCommands.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'

const actorId = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const sceneId = actorId(0xfff)

const actors = (actorIds: string[], scene: unknown = null) => ({
  kind: 'ACTORS',
  actorIds,
  scene
})

describe('a list of chosen creatures as a RESOLVE_ACTION target (D118)', () => {
  const parse = (value: unknown) => resolveEncounterActionTargetDtoSchema.safeParse(value).success

  it('takes one or more creatures, with or without a Scene and a point', () => {
    expect(parse(actors([actorId(1)]))).toBe(true)
    expect(
      parse(actors([actorId(1), actorId(2)], { sceneId, expectedSceneVersion: 3, point: null }))
    ).toBe(true)
    expect(
      parse(actors([actorId(1)], { sceneId, expectedSceneVersion: 0, point: { x: 350, y: 150 } }))
    ).toBe(true)
  })

  it('names a creature once per entry: a repeat is a further dart, which the action decides', () => {
    expect(parse(actors([actorId(1), actorId(1), actorId(2)]))).toBe(true)
  })

  it('takes the form of an authored creature form, whose id is any hexadecimal UUID shape', () => {
    // The SRD derives its authored child ids (Giant Insect's forms), which carry no version nibble.
    const srdFormId = '00000f4f-0000-0214-0b0e-000000000001'
    expect(parse({ ...actors([actorId(1)]), formId: srdFormId })).toBe(true)
    expect(parse({ ...actors([actorId(1)]), formId: 'not-a-form' })).toBe(false)
  })

  it('refuses an empty list and a list past the Encounter’s size', () => {
    expect(parse(actors([]))).toBe(false)
    const tooMany = Array.from({ length: MAX_ENCOUNTER_ACTORS + 1 }, (_, index) =>
      actorId(index + 1)
    )
    expect(parse(actors(tooMany))).toBe(false)
    expect(parse(actors(tooMany.slice(0, MAX_ENCOUNTER_ACTORS)))).toBe(true)
  })

  it('refuses a stray field on the list or on its Scene', () => {
    expect(parse({ ...actors([actorId(1)]), actorId: actorId(1) })).toBe(false)
    expect(
      parse(actors([actorId(1)], { sceneId, expectedSceneVersion: 1, point: null, extra: 1 }))
    ).toBe(false)
  })
})
