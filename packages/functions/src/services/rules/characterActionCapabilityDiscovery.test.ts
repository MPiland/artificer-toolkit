import { describe, expect, it } from 'vitest'

import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { ACTIVATION_CODE, RANGE_KIND, TRIGGER } from '@artificer-toolkit/shared/core'
import type { CharacterActionRuleEntryPoint } from '../character/characterActionRuleFacts.js'

import {
  createCharacterActionCapabilityDiscoveryRegistry,
  type CharacterActionCapabilityAdapter
} from './characterActionCapabilityDiscovery.js'
import { dnd5eCharacterActionCapabilityAdapter } from './systems/dnd5e/characterActionCapabilityDiscovery.js'

const DND5E_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_SYSTEM_ID = '00000000-0000-0000-0000-000000000002'
const EFFECT_A_ID = '00000000-0000-4000-8000-000000000010'
const EFFECT_B_ID = '00000000-0000-4000-8000-000000000011'
const DEXTERITY_ABILITY_ID = '00000000-0000-4000-8000-000000000012'

function candidate(input: Partial<CharacterActionCandidate> = {}): CharacterActionCandidate {
  return {
    sequence: 0,
    actionId: `source-a:ACTION:${EFFECT_A_ID}`,
    effectId: EFFECT_A_ID,
    sourceId: 'source-a',
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: 'feature-definition',
      sourceInstanceId: 'source-a'
    },
    mechanicsOwner: { kind: 'FEATURE', id: 'feature-definition' },
    activationSourceKind: 'ACTIVE_SOURCE',
    equipment: null,
    resourceUse: null,
    mechanicFacts: {
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { rangeKind: 'SELF', amount: null, unit: null },
        savingThrow: null,
        reactionMovementTrigger: null
      },
      outcomes: []
    },
    ...input
  }
}

function entryPoint(input: CharacterActionCandidate): CharacterActionRuleEntryPoint {
  return {
    actionId: input.actionId,
    effectId: input.effectId,
    sourceId: input.sourceId,
    source: input.source,
    mechanicsOwner: input.mechanicsOwner,
    activationSourceKind: input.activationSourceKind,
    compiledEffect: compileEffect({
      id: input.effectId,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.SELF },
        targeting: { selectionKind: 'SELF' }
      },
      paths: []
    })
  }
}

describe('Character action capability discovery', () => {
  it('discovers exact Effect entry points in candidate order without conflating source instances', () => {
    const candidates = [
      candidate(),
      candidate({
        sequence: 1,
        actionId: `source-b:ACTION:${EFFECT_A_ID}`,
        sourceId: 'source-b',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: 'wand-definition',
          itemInstanceId: 'source-b'
        },
        mechanicsOwner: { kind: 'EQUIPMENT', id: 'wand-definition' },
        activationSourceKind: 'ACTIVE_EQUIPMENT',
        equipment: {
          itemInstanceId: 'source-b',
          equipped: true,
          attuned: false,
          requiresAttunement: false,
          requiresEquipped: true,
          requiresAttuned: false
        }
      })
    ]
    const registry = createCharacterActionCapabilityDiscoveryRegistry([
      dnd5eCharacterActionCapabilityAdapter
    ])

    const descriptors = registry.discover({
      gameSystemId: DND5E_SYSTEM_ID,
      candidates,
      entryPoints: candidates.map(entryPoint)
    })

    expect(descriptors.map((descriptor) => descriptor.actionId)).toEqual(
      candidates.map((entry) => entry.actionId)
    )
    expect(descriptors.map((descriptor) => descriptor.sourceId)).toEqual(['source-a', 'source-b'])
    expect(descriptors.map((descriptor) => descriptor.entryPointDefinitionId)).toEqual([
      EFFECT_A_ID,
      EFFECT_A_ID
    ])
  })

  it('fails closed for an unregistered System', () => {
    const registry = createCharacterActionCapabilityDiscoveryRegistry([
      dnd5eCharacterActionCapabilityAdapter
    ])
    expect(
      registry.discover({
        gameSystemId: OTHER_SYSTEM_ID,
        candidates: [candidate()],
        entryPoints: [entryPoint(candidate())]
      })
    ).toEqual([])
  })

  it('resolves an authored saving throw to its exact pinned ability UUID', () => {
    const saved = candidate({
      mechanicFacts: {
        invocation: {
          triggerCode: 'SAVING_THROW',
          activation: { code: 'ACTION', amount: 1 },
          range: { rangeKind: 'UNLIMITED', amount: null, unit: null },
          savingThrow: {
            dcMethod: 'FIXED_DC',
            abilityDefinitionId: DEXTERITY_ABILITY_ID,
            baseDc: 14,
            bonuses: []
          },
          reactionMovementTrigger: null
        },
        outcomes: []
      }
    })
    const savedEntry: CharacterActionRuleEntryPoint = {
      ...entryPoint(saved),
      compiledEffect: compileEffect({
        id: saved.effectId,
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: 'save',
            abilityDefinitionId: DEXTERITY_ABILITY_ID,
            dcMethod: 'FIXED_DC',
            baseDc: 14
          },
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: []
      })
    }
    const registry = createCharacterActionCapabilityDiscoveryRegistry([
      dnd5eCharacterActionCapabilityAdapter
    ])
    expect(
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [saved],
        entryPoints: [savedEntry],
        abilityDefinitions: [{ id: DEXTERITY_ABILITY_ID, code: 'NOT_USED_FOR_RUNTIME_IDENTITY' }]
      })[0]?.savingThrowAbilityDefinitionId
    ).toBe(DEXTERITY_ABILITY_ID)
    expect(() =>
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [saved],
        entryPoints: [savedEntry],
        abilityDefinitions: []
      })
    ).toThrow('no exact System ability definition')
  })

  it('rejects duplicate and invalid adapter registrations before they can fabricate capabilities', () => {
    expect(() =>
      createCharacterActionCapabilityDiscoveryRegistry([
        dnd5eCharacterActionCapabilityAdapter,
        dnd5eCharacterActionCapabilityAdapter
      ])
    ).toThrow('Duplicate Character action capability adapter')

    const invalid: CharacterActionCapabilityAdapter = {
      gameSystemId: DND5E_SYSTEM_ID,
      authoredRootKind: 'effect',
      discover: () => []
    }
    const registry = createCharacterActionCapabilityDiscoveryRegistry([invalid])
    expect(() =>
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate()],
        entryPoints: [entryPoint(candidate())]
      })
    ).toThrow('return every input candidate exactly once')
  })

  it('rejects reordered or fabricated adapter descriptors', () => {
    const candidates = [
      candidate(),
      candidate({
        sequence: 1,
        actionId: `source-b:ACTION:${EFFECT_B_ID}`,
        effectId: EFFECT_B_ID,
        sourceId: 'source-b'
      })
    ]
    const invalid: CharacterActionCapabilityAdapter = {
      gameSystemId: DND5E_SYSTEM_ID,
      authoredRootKind: 'effect',
      discover: ({ candidates: input }) =>
        [...input].reverse().map((entry) => ({
          kind: 'CHARACTER_ACTION',
          gameSystemId: DND5E_SYSTEM_ID,
          authoredRootKind: 'effect',
          entryPointDefinitionId: entry.effectId,
          effectId: entry.effectId,
          actionId: entry.actionId,
          sourceId: entry.sourceId,
          source: entry.source,
          mechanicsOwner: entry.mechanicsOwner,
          activationSourceKind: entry.activationSourceKind,
          mechanicFacts: entry.mechanicFacts,
          compiledEffect: entryPoint(entry).compiledEffect
        }))
    }
    const registry = createCharacterActionCapabilityDiscoveryRegistry([invalid])
    expect(() =>
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates,
        entryPoints: candidates.map(entryPoint)
      })
    ).toThrow('invalid descriptor at index 0')
  })

  it('rejects non-UUID and non-canonical Effect entry-point identities', () => {
    const registry = createCharacterActionCapabilityDiscoveryRegistry([
      dnd5eCharacterActionCapabilityAdapter
    ])

    expect(() =>
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate({ effectId: 'effect-definition' })],
        entryPoints: [entryPoint(candidate({ effectId: 'effect-definition' }))]
      })
    ).toThrow('entry point at index 0 must be a canonical PostgreSQL UUID')

    expect(() =>
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates: [candidate({ effectId: '00000000-0000-4000-8000-0000000000aa'.toUpperCase() })],
        entryPoints: [
          entryPoint(candidate({ effectId: '00000000-0000-4000-8000-0000000000aa'.toUpperCase() }))
        ]
      })
    ).toThrow('entry point at index 0 must be a canonical PostgreSQL UUID')
  })

  it.each([
    [
      'action identity',
      [
        candidate(),
        candidate({
          sequence: 1,
          actionId: `source-a:ACTION:${EFFECT_A_ID}`,
          effectId: EFFECT_B_ID,
          sourceId: 'source-b'
        })
      ],
      'duplicate action identity'
    ],
    [
      'source/Effect identity',
      [candidate(), candidate({ sequence: 1, actionId: `other:ACTION:${EFFECT_A_ID}` })],
      'duplicate source/Effect identity'
    ]
  ] as const)('rejects duplicate %s before exposing capabilities', (_label, candidates, error) => {
    const registry = createCharacterActionCapabilityDiscoveryRegistry([
      dnd5eCharacterActionCapabilityAdapter
    ])
    expect(() =>
      registry.discover({
        gameSystemId: DND5E_SYSTEM_ID,
        candidates,
        entryPoints: candidates.map(entryPoint)
      })
    ).toThrow(error)
  })
})
