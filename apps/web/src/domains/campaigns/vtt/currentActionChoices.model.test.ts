import { describe, expect, it } from 'vitest'
import type { EncounterActionChoicesDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import { selectCurrentActionChoices } from './currentActionChoices.model'

const scope = { encounterId: 'run', expectedVersion: 3, actorId: 'hero' }
const loaded = {
  encounterId: 'run',
  encounterVersion: 3,
  actorId: 'hero'
} as EncounterActionChoicesDto

describe('the action choices in scope', () => {
  it('keeps choices for the same Run version and actor', () => {
    expect(selectCurrentActionChoices(loaded, scope)).toBe(loaded)
  })

  it('drops choices from another version, actor or Run, or with nothing in scope', () => {
    expect(selectCurrentActionChoices(loaded, { ...scope, expectedVersion: 4 })).toBeNull()
    expect(selectCurrentActionChoices(loaded, { ...scope, actorId: 'other' })).toBeNull()
    expect(selectCurrentActionChoices(loaded, { ...scope, encounterId: 'other' })).toBeNull()
    expect(selectCurrentActionChoices(loaded, null)).toBeNull()
    expect(selectCurrentActionChoices(undefined, scope)).toBeNull()
  })
})
