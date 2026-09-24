import { describe, expect, it } from 'vitest'
import {
  MAX_LIVE_SESSION_RULES_REVISIONS,
  liveSessionRulesRevisionsSchema,
  type LiveSessionRulesRevisions
} from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'

const systemId = '00000000-0000-4000-8000-000000000001'
const campaignId = '00000000-0000-4000-8000-000000000002'
const sessionId = '00000000-0000-4000-8000-000000000003'
const firstRevision = '00000000-0000-4000-8000-000000000004'
const secondRevision = '00000000-0000-4000-8000-000000000005'
const characterId = '00000000-0000-4000-8000-000000000006'

const base: LiveSessionRulesRevisions = [
  { scope: 'SYSTEM', id: systemId, revision: firstRevision },
  { scope: 'CAMPAIGN', id: campaignId, revision: null },
  { scope: 'SESSION', id: sessionId, revision: firstRevision }
]

describe('native rules revisions', () => {
  it('keeps matching observations and distinct Character identities once', () => {
    let revisions = mergeNativeRulesRevisions([], base)
    revisions = mergeNativeRulesRevisions(revisions, [
      ...base,
      { scope: 'CHARACTER', id: characterId, revision: null }
    ])
    revisions = mergeNativeRulesRevisions(revisions, [
      ...base,
      { scope: 'CHARACTER', id: characterId, revision: null },
      {
        scope: 'CHARACTER',
        id: '00000000-0000-4000-8000-000000000007',
        revision: secondRevision
      }
    ])
    expect(revisions).toHaveLength(5)
  })

  it('rejects conflicts within a capture and across Encounter and Character captures atomically', () => {
    let revisions = mergeNativeRulesRevisions([], base)
    expect(() =>
      mergeNativeRulesRevisions(revisions, [
        ...base,
        { scope: 'CAMPAIGN', id: campaignId, revision: secondRevision }
      ])
    ).toThrow('Live rules revision changed during preparation.')
    expect(revisions).toEqual(base)

    revisions = mergeNativeRulesRevisions(revisions, [
      ...base,
      { scope: 'CHARACTER', id: characterId, revision: null }
    ])
    const encounterObservations = revisions
    expect(() =>
      mergeNativeRulesRevisions(revisions, [
        ...base,
        { scope: 'CHARACTER', id: characterId, revision: secondRevision }
      ])
    ).toThrow('Live rules revision changed during preparation.')
    expect(revisions).toEqual(encounterObservations)
  })

  it('accepts actor and detached maintained Character revisions through the shared bound', () => {
    const revisions = mergeNativeRulesRevisions([], base)
    const characters: LiveSessionRulesRevisions = Array.from(
      { length: MAX_ENCOUNTER_ACTORS + MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + 1 },
      (_, index) => ({
        scope: 'CHARACTER',
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        revision: null
      })
    )
    const actors = mergeNativeRulesRevisions(revisions, [
      ...base,
      ...characters.slice(0, MAX_ENCOUNTER_ACTORS)
    ])
    const complete = mergeNativeRulesRevisions(actors, [
      ...base,
      ...characters.slice(
        MAX_ENCOUNTER_ACTORS,
        MAX_ENCOUNTER_ACTORS + MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
      )
    ])
    expect(complete).toHaveLength(MAX_LIVE_SESSION_RULES_REVISIONS)
    expect(liveSessionRulesRevisionsSchema.safeParse(complete).success).toBe(true)

    const overBound = [...complete, characters.at(-1)!]
    expect(() => mergeNativeRulesRevisions(complete, overBound)).toThrow(
      'Live rules revisions exceed the supported bound.'
    )
    expect(liveSessionRulesRevisionsSchema.safeParse(overBound).success).toBe(false)
    expect(complete).toHaveLength(MAX_LIVE_SESSION_RULES_REVISIONS)
  })
})
