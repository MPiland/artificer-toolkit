import { describe, expect, it } from 'vitest'

import {
  dnd5eInitiativeFactAdapter,
  DND5E_INITIATIVE_FACT_KEYS
} from './systems/dnd5e/initiativeFactAdapter.js'
import {
  createInitiativeFactAdapterRegistry,
  initiativeFactAdapterRegistry
} from './initiativeFactAdapterRegistry.js'

const DND5E_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-000000000099'

describe('initiativeFactAdapterRegistry', () => {
  it('uses exact System identity and fails closed for an unknown adapter', () => {
    expect(initiativeFactAdapterRegistry.get(DND5E_SYSTEM_ID.toUpperCase())).toBe(
      dnd5eInitiativeFactAdapter
    )
    expect(initiativeFactAdapterRegistry.get(UNKNOWN_SYSTEM_ID)).toBeUndefined()
  })

  it('rejects duplicate canonical System identities', () => {
    expect(() =>
      createInitiativeFactAdapterRegistry([
        dnd5eInitiativeFactAdapter,
        { ...dnd5eInitiativeFactAdapter, gameSystemId: DND5E_SYSTEM_ID.toUpperCase() }
      ])
    ).toThrow('Duplicate initiative System adapter')
  })
})

describe('dnd5eInitiativeFactAdapter', () => {
  it("uses a Character's locked Campaign overlay rather than base mechanics", () => {
    const binding = dnd5eInitiativeFactAdapter.bindActor({
      kind: 'CHARACTER',
      actor: { id: 'actor' },
      characterId: 'character',
      systemId: DND5E_SYSTEM_ID,
      streamVersion: 4,
      mechanics: {
        rulePolicyOutput: {
          derivedStats: { initiative: { effective: 1 } },
          rollModes: { initiative: 'NORMAL' }
        }
      },
      overlay: {
        rulePolicyOutput: {
          derivedStats: { initiative: { effective: 6 } },
          rollModes: { initiative: 'ADVANTAGE' }
        }
      }
    } as never)
    expect(binding).toEqual({
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 6,
        [DND5E_INITIATIVE_FACT_KEYS.rollMode]: 'ADVANTAGE'
      }
    })
  })

  it('uses a transient effective Character policy when active scalar state changes it', () => {
    const binding = dnd5eInitiativeFactAdapter.bindActor({
      kind: 'CHARACTER',
      actor: { id: 'actor' },
      characterId: 'character',
      systemId: DND5E_SYSTEM_ID,
      streamVersion: 4,
      mechanics: {},
      overlay: {
        rulePolicyOutput: {
          derivedStats: { initiative: { effective: 4 } },
          rollModes: { initiative: 'NORMAL' }
        }
      },
      effectiveRulePolicyOutput: {
        derivedStats: { initiative: { effective: 1 } },
        rollModes: { initiative: 'DISADVANTAGE' }
      }
    } as never)
    expect(binding).toEqual({
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 1,
        [DND5E_INITIATIVE_FACT_KEYS.rollMode]: 'DISADVANTAGE'
      }
    })
  })

  it('uses pinned Creature policy and never parses Creature prose', () => {
    const binding = dnd5eInitiativeFactAdapter.bindActor({
      kind: 'CREATURE',
      actor: { id: 'creature', snapshot: { senses: ['initiative + 99'] } },
      systemId: DND5E_SYSTEM_ID,
      actorRule: { initiativeModifier: 3 }
    } as never)
    expect(binding.automatic).toBe(true)
    if (!binding.automatic) throw new Error('Expected automatic Creature initiative facts.')
    expect(binding.facts[DND5E_INITIATIVE_FACT_KEYS.modifier]).toBe(3)
  })

  it('marks statless Custom actors unavailable without deriving initiative facts', () => {
    const binding = dnd5eInitiativeFactAdapter.bindActor({
      kind: 'CUSTOM',
      actor: { id: 'custom' },
      systemId: null
    } as never)
    expect(binding).toEqual({ automatic: false })
  })

  it('binds a System-owned normal side roll without selecting a representative actor', () => {
    const binding = dnd5eInitiativeFactAdapter.bindSide({
      sideId: '00000000-0000-4000-8000-000000000010',
      participants: [
        {
          kind: 'CUSTOM',
          actor: { id: 'custom' },
          systemId: null
        } as never
      ]
    })
    expect(binding).toEqual({
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 0,
        [DND5E_INITIATIVE_FACT_KEYS.rollMode]: 'NORMAL'
      }
    })
  })

  it('binds only exact declared Speed Factor facts and composes each factor once', () => {
    const binding = dnd5eInitiativeFactAdapter.bindDeclaredActor(
      {
        kind: 'CHARACTER',
        actor: { id: 'actor' },
        characterId: 'character',
        systemId: DND5E_SYSTEM_ID,
        streamVersion: 4,
        mechanics: { initiativeActorFacts: { effectiveSize: 'SMALL' } },
        overlay: {
          rulePolicyOutput: {
            derivedStats: { initiative: { effective: 3 } },
            rollModes: { initiative: 'NORMAL' }
          }
        }
      } as never,
      {
        actorSize: 'SMALL',
        primary: {
          kind: 'CHARACTER_ACTION',
          optionId: 'primary',
          effectId: '00000000-0000-4000-8000-000000000010',
          sourceId: 'primary',
          sourceChecksum: 'a'.repeat(64),
          activationCode: 'ACTION',
          equipmentInstanceId: 'item',
          equipmentProperties: ['MELEE', 'HEAVY', 'TWO_HANDED']
        },
        bonus: {
          kind: 'CHARACTER_SPELL_CAST',
          optionId: 'bonus',
          spellId: '00000000-0000-4000-8000-000000000011',
          spellVersionId: 'version',
          spellVersion: 1,
          spellChecksum: 'a'.repeat(64),
          sourceKind: 'SPELL',
          sourceInstanceId: 'instance',
          castLevel: 4
        }
      }
    )
    expect(binding).toMatchObject({
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 3,
        [DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier]: -6
      }
    })
  })

  it('fails closed when a declared weapon factor lacks its normalized attack category', () => {
    expect(
      dnd5eInitiativeFactAdapter.bindDeclaredActor(
        {
          kind: 'CHARACTER',
          actor: { id: 'actor' },
          characterId: 'character',
          systemId: DND5E_SYSTEM_ID,
          streamVersion: 4,
          mechanics: { initiativeActorFacts: { effectiveSize: 'MEDIUM' } },
          overlay: {
            rulePolicyOutput: {
              derivedStats: { initiative: { effective: 0 } },
              rollModes: { initiative: 'NORMAL' }
            }
          }
        } as never,
        {
          actorSize: 'MEDIUM',
          primary: {
            kind: 'CHARACTER_ACTION',
            optionId: 'primary',
            effectId: '00000000-0000-4000-8000-000000000010',
            sourceId: 'primary',
            sourceChecksum: 'a'.repeat(64),
            activationCode: 'ACTION',
            equipmentInstanceId: 'item',
            equipmentProperties: ['HEAVY']
          },
          bonus: null
        }
      )
    ).toEqual({ automatic: false })
  })

  it('binds an exact immutable Creature Feature declaration without a Character overlay', () => {
    const binding = dnd5eInitiativeFactAdapter.bindDeclaredActor(
      {
        kind: 'CREATURE',
        actor: {
          id: '00000000-0000-4000-8000-000000000020',
          sourceId: '00000000-0000-4000-8000-000000000021',
          sourceRevision: 3,
          snapshot: { payload: { size: 'LARGE' } }
        },
        systemId: DND5E_SYSTEM_ID,
        actorRule: { initiativeModifier: 4 }
      } as never,
      {
        actorSize: 'LARGE',
        primary: {
          kind: 'CREATURE_FEATURE_ACTION',
          optionId: 'feature-action',
          actorId: '00000000-0000-4000-8000-000000000020',
          creatureSourceId: '00000000-0000-4000-8000-000000000021',
          sourceRevision: 3,
          sourceVersionId: '00000000-0000-4000-8000-000000000022',
          sourceChecksum: 'a'.repeat(64),
          ownerFeatureId: '00000000-0000-4000-8000-000000000023',
          featureOptionId: null,
          effectId: '00000000-0000-4000-8000-000000000024',
          compiledEffectChecksum: 'b'.repeat(64),
          activationCode: 'ACTION',
          featureResourceUse: null
        },
        bonus: null
      }
    )
    expect(binding).toMatchObject({
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 4,
        [DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier]: -2
      }
    })
  })

  it('accepts only GM-adjudicated Custom factors and never invents Custom stats', () => {
    const source = {
      kind: 'CUSTOM' as const,
      actor: { id: '00000000-0000-4000-8000-000000000030' },
      systemId: null
    }
    const declaration = {
      actorSize: 'TINY',
      primary: {
        kind: 'GM_ADJUDICATED' as const,
        optionId: 'GM_ADJUDICATED' as const,
        actorId: '00000000-0000-4000-8000-000000000030',
        actionFactors: ['RANGED_LOADING' as const],
        spellLevel: 2
      },
      bonus: null
    }
    expect(
      dnd5eInitiativeFactAdapter.bindDeclaredActor(source as never, declaration)
    ).toMatchObject({
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 0,
        [DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier]: -2
      }
    })
    expect(
      dnd5eInitiativeFactAdapter.bindDeclaredActor(source as never, {
        ...declaration,
        primary: { ...declaration.primary, actorId: '00000000-0000-4000-8000-000000000031' }
      })
    ).toEqual({ automatic: false })
  })
})
