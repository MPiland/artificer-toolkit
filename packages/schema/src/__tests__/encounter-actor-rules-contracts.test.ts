import { describe, expect, it } from 'vitest'

import {
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema
} from '../api/encounterActorRules.js'

const actorId = '00000000-0000-4000-8000-000000000001'
const dexterityId = '00000000-0000-4000-8000-000000000002'
const charismaId = '00000000-0000-4000-8000-000000000003'
const targetProtection = { status: 'NOT_NORMALIZED' as const }

describe('Encounter actor rule contracts', () => {
  it('accepts raw actor facts and resolved resource state', () => {
    const input = encounterActorRuleInputSchema.parse({
      contractVersion: 1,
      actors: [
        {
          actorId,
          abilityScores: { [dexterityId]: 14, [charismaId]: 18 },
          saveProficiencyBonuses: {},
          targetProtection,
          featureResources: [
            {
              featureId: 'legendary-resistance',
              charge: {
                id: 'legendary-resistance-charges',
                resetKind: 'DAILY',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 3
              },
              used: 1
            }
          ]
        }
      ]
    })

    expect(input.actors[0]?.abilityScores[dexterityId]).toBe(14)
    expect(
      encounterActorRuleOutputSchema.parse({
        actors: [
          {
            actorId,
            initiativeModifier: 2,
            targetProtection,
            featureResources: [
              {
                featureId: 'legendary-resistance',
                maximum: 3,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                rawUsed: 1,
                used: 1,
                remaining: 2,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      })
    ).toMatchObject({ actors: [{ initiativeModifier: 2 }] })
  })

  it('rejects ambiguous actor and feature identities', () => {
    const actor = {
      actorId,
      abilityScores: {},
      saveProficiencyBonuses: {},
      targetProtection,
      featureResources: [
        { featureId: 'feature-1', charge: null, used: 0 },
        { featureId: 'feature-1', charge: null, used: 0 }
      ]
    }
    expect(() =>
      encounterActorRuleInputSchema.parse({
        contractVersion: 1,
        actors: [actor]
      })
    ).toThrow(/duplicated/)
    expect(() =>
      encounterActorRuleInputSchema.parse({
        contractVersion: 1,
        actors: [
          { ...actor, featureResources: [] },
          { ...actor, featureResources: [] }
        ]
      })
    ).toThrow(/duplicated/)
  })

  it('requires the pinned save proficiency bonuses on every actor fact', () => {
    expect(() =>
      encounterActorRuleInputSchema.parse({
        contractVersion: 1,
        actors: [{ actorId, abilityScores: {}, targetProtection, featureResources: [] }]
      })
    ).toThrow()
  })

  it('requires complete finite state and accepts a zero maximum', () => {
    const finite = {
      featureId: 'feature-1',
      maximum: 0,
      reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
      rawUsed: 0,
      used: 0,
      remaining: 0,
      resetKind: 'DAILY'
    }
    expect(
      encounterActorRuleOutputSchema.parse({
        actors: [{ actorId, initiativeModifier: 0, targetProtection, featureResources: [finite] }]
      })
    ).toMatchObject({ actors: [{ featureResources: [{ maximum: 0 }] }] })
    expect(() =>
      encounterActorRuleOutputSchema.parse({
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection,
            featureResources: [{ ...finite, reconciliationPolicy: null }]
          }
        ]
      })
    ).toThrow(/finite state is incomplete/)
  })

  it('rejects duplicated output identities', () => {
    const resource = {
      featureId: 'feature-1',
      maximum: null,
      reconciliationPolicy: null,
      rawUsed: 0,
      used: 0,
      remaining: null,
      resetKind: null
    }
    expect(() =>
      encounterActorRuleOutputSchema.parse({
        actors: [
          { actorId, initiativeModifier: 0, targetProtection, featureResources: [resource] },
          { actorId, initiativeModifier: 0, targetProtection, featureResources: [] }
        ]
      })
    ).toThrow(/duplicated/)
    expect(() =>
      encounterActorRuleOutputSchema.parse({
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection,
            featureResources: [resource, resource]
          }
        ]
      })
    ).toThrow(/duplicated/)
    const abilityDefinitionId = '00000000-0000-4000-8000-000000000020'
    const savingThrow = {
      abilityDefinitionId,
      modifier: 2,
      rollMode: 'NORMAL',
      contributors: []
    }
    expect(() =>
      encounterActorRuleOutputSchema.parse({
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            savingThrowDefinitions: [savingThrow, savingThrow],
            targetProtection,
            featureResources: []
          }
        ]
      })
    ).toThrow(/unique and canonically ordered/)
  })
})
