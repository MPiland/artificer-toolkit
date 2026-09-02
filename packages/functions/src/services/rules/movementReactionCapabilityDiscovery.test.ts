import type { EncounterActorRecord, Json } from '@artificer-toolkit/db'
import { featureDtoSchema } from '@artificer-toolkit/schema/features/feature'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { ACTIVATION_CODE, RANGE_KIND, TRIGGER } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { normalizeCharacterActionMechanicFacts } from '../character/characterActionRuleFacts.js'
import type {
  CharacterActionCapabilityDescriptor,
  EffectActionCapabilityDescriptor
} from './characterActionCapabilityDiscovery.js'
import {
  assertEncounterCreatureEquipmentLoadoutCapabilities,
  assertEncounterFeatureActionCapabilityCurrent,
  createEncounterFeatureActionCapabilityDiscoveryRegistry,
  type EncounterFeatureEffectCompilerInput,
  type EncounterFeatureActionCapabilityAdapter
} from './encounterFeatureActionCapabilityDiscovery.js'
import { snapshotCreatureEquipmentLoadout } from './encounterCreatureEquipmentSources.js'
import { discoverEncounterFeatureActionCapabilities } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { discoverMovementReactionCapabilities } from './movementReactionCapabilityDiscovery.js'
import { DND5E_SYSTEM_ID } from './systems/dnd5e/characterActionCapabilityDiscovery.js'

const ACTOR_ID = '00000000-0000-4000-8000-000000000001'
const FEATURE_ID = '00000000-0000-4000-8000-000000000010'
const EFFECT_ID = '00000000-0000-4000-8000-000000000011'
const ELIGIBILITY_ID = '00000000-0000-4000-8000-000000000012'
const SOURCE_VERSION_ID = '00000000-0000-4000-8000-000000000013'
const OWNER_RULE_DEFINITION_ID = '00000000-0000-4000-8000-000000000014'
const OPTION_ID = '00000000-0000-4000-8000-000000000015'
const OPTION_EFFECT_ID = '00000000-0000-4000-8000-000000000016'
const OPTION_RULE_DEFINITION_ID = '00000000-0000-4000-8000-000000000017'
const LOADOUT_ID = '00000000-0000-4000-8000-000000000018'
const EQUIPMENT_ID = '00000000-0000-4000-8000-000000000019'
const EQUIPMENT_VERSION_ID = '00000000-0000-4000-8000-000000000020'

type Assert<T extends true> = T
type CompilerInputDoesNotExposeMutableActorState = Assert<
  'currentHitPoints' extends keyof EncounterFeatureEffectCompilerInput ? false : true
>
void (0 as unknown as CompilerInputDoesNotExposeMutableActorState)

function effect(
  input: { activation?: 'ACTION' | 'REACTION'; binding?: boolean; passive?: boolean } = {}
) {
  if (input.passive) {
    return compileEffect({
      id: EFFECT_ID,
      order: 0,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: TRIGGER.ACTIVATED,
        range: { id: 'range', rangeKind: RANGE_KIND.SELF }
      },
      paths: []
    })
  }
  if (input.activation === ACTIVATION_CODE.ACTION) {
    return compileEffect({
      id: EFFECT_ID,
      order: 0,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.SELF }
      },
      paths: []
    })
  }
  if (input.binding === false) {
    return compileEffect({
      id: EFFECT_ID,
      order: 0,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.SELF }
      },
      paths: []
    })
  }
  return compileEffect({
    id: EFFECT_ID,
    order: 0,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
      range: { id: 'range', rangeKind: RANGE_KIND.SELF },
      reactionMovementTrigger: {
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        perceptionRequirement: 'SEE',
        eligibilityDefinitionId: ELIGIBILITY_ID
      }
    },
    paths: []
  })
}

const testCreatureFeatureAdapter: EncounterFeatureActionCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  compile: (input) => {
    expect(Object.keys(input).sort()).toEqual([
      'abilityDefinitions',
      'compiledEffect',
      'conditionDefinitionIds',
      'creatureSourceId',
      'encounterActorId',
      'featureOption',
      'gameSystemId',
      'ownerFeature',
      'sourceChecksum',
      'sourceRevision',
      'sourceVersionId'
    ])
    return {}
  }
}

function characterCapability(compiledEffect = effect()): CharacterActionCapabilityDescriptor {
  return {
    kind: 'CHARACTER_ACTION',
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: EFFECT_ID,
    effectId: EFFECT_ID,
    actionId: `source:ACTION:${EFFECT_ID}`,
    sourceId: FEATURE_ID,
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: FEATURE_ID,
      sourceInstanceId: FEATURE_ID
    },
    mechanicsOwner: { kind: 'FEATURE', id: FEATURE_ID },
    activationSourceKind: 'ACTIVE_SOURCE',
    mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
    compiledEffect
  }
}

function creatureActor(): EncounterActorRecord {
  return {
    id: ACTOR_ID,
    encounterId: '00000000-0000-4000-8000-000000000002',
    kind: 'CREATURE',
    sourceId: '00000000-0000-4000-8000-000000000003',
    sourceRevision: 1,
    label: 'Creature',
    systemId: DND5E_SYSTEM_ID,
    stableTieKey: 'creature',
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: {},
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {
      kind: 'CREATURE',
      id: '00000000-0000-4000-8000-000000000003',
      systemId: DND5E_SYSTEM_ID,
      sourceRevision: 1,
      sourceVersionId: SOURCE_VERSION_ID,
      sourceChecksum: 'a'.repeat(64),
      payload: {
        features: [
          {
            id: FEATURE_ID,
            label: 'Reaction feature',
            description: '',
            order: 0,
            section: 'REACTION',
            ruleDefinitionIds: [OWNER_RULE_DEFINITION_ID],
            effects: [
              {
                id: EFFECT_ID,
                order: 0,
                invocation: {
                  kind: 'ACTION',
                  triggerCode: 'ACTIVATED',
                  activation: { code: 'REACTION', amount: 1 },
                  range: { id: 'range', rangeKind: 'SELF' },
                  reactionMovementTrigger: {
                    kind: 'MOVEMENT',
                    stage: 'BEFORE_LEAVE_REACH',
                    perceptionRequirement: 'SEE',
                    eligibilityDefinitionId: ELIGIBILITY_ID
                  }
                },
                paths: [
                  {
                    id: 'reaction-path',
                    order: 0,
                    pathCode: 'ON_USE',
                    groupType: 'SINGLE',
                    selectionKind: 'FIXED',
                    resultBlock: {
                      id: 'reaction-result',
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: 'reaction-outcome',
                          effectKind: 'CONDITION',
                          conditionId: 'reaction-condition'
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    } as Json,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function weaponEffect(input: { id: string; diceConfig: string; extraOutcome?: boolean }) {
  return {
    id: input.id,
    order: 0,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: 'MELEE_WEAPON_ATTACK' as const,
      activation: { code: 'ACTION' as const, amount: 1 },
      range: {
        id: `${input.id}-range`,
        rangeKind: 'DISTANCE' as const,
        amount: 5,
        unit: 'FEET' as const
      }
    },
    paths: [
      {
        id: `${input.id}-path`,
        order: 0,
        pathCode: 'ON_HIT' as const,
        groupType: input.extraOutcome ? ('SEQUENTIAL' as const) : ('SINGLE' as const),
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: `${input.id}-result`,
          resultKind: input.extraOutcome ? ('SEQUENCE' as const) : ('SINGLE' as const),
          outcomes: [
            {
              id: `${input.id}-damage`,
              effectKind: 'DAMAGE' as const,
              damageTypeId: '00000000-0000-4000-8000-000000000021',
              valueKind: 'DICE' as const,
              scalingKind: 'NONE' as const,
              diceConfig: input.diceConfig
            },
            ...(input.extraOutcome
              ? [
                  {
                    id: `${input.id}-condition`,
                    effectKind: 'CONDITION' as const,
                    conditionId: '00000000-0000-4000-8000-000000000030'
                  }
                ]
              : [])
          ]
        }
      }
    ]
  }
}

function equipmentBoundCreatureActor(input: { extraOutcome?: boolean } = {}): EncounterActorRecord {
  const actor = creatureActor()
  const normal = weaponEffect({
    id: '00000000-0000-4000-8000-000000000022',
    diceConfig: '1d4+2',
    extraOutcome: input.extraOutcome
  })
  const variant = weaponEffect({ id: '00000000-0000-4000-8000-000000000023', diceConfig: '2d4+2' })
  const equipmentPayload = {
    kind: 'EQUIPMENT' as const,
    id: EQUIPMENT_ID,
    label: 'Equipment',
    description: null,
    rarityId: '00000000-0000-4000-8000-000000000024',
    userId: '00000000-0000-4000-8000-000000000025',
    systemId: DND5E_SYSTEM_ID,
    category: 'WEAPON' as const,
    properties: [],
    effects: [weaponEffect({ id: '00000000-0000-4000-8000-000000000026', diceConfig: '1d4' })]
  }
  actor.snapshot = {
    kind: 'CREATURE',
    id: actor.sourceId!,
    systemId: DND5E_SYSTEM_ID,
    sourceRevision: 1,
    sourceVersionId: SOURCE_VERSION_ID,
    sourceChecksum: 'a'.repeat(64),
    payload: {
      features: [
        {
          id: FEATURE_ID,
          label: 'Weapon',
          description: '',
          order: 0,
          rollDefinitions: [
            {
              id: '00000000-0000-4000-8000-000000000027',
              label: 'Weapon attack',
              kind: 'ATTACK',
              expression: { count: 1, die: 20, modifier: 4 },
              rollMode: 'NORMAL',
              chargeCost: null,
              order: 1
            }
          ],
          effects: [normal, variant]
        }
      ],
      equipmentLoadout: [
        {
          id: LOADOUT_ID,
          equipmentId: EQUIPMENT_ID,
          quantity: 1,
          useState: 'HELD',
          attuned: false,
          actionFeatureIds: [FEATURE_ID]
        }
      ]
    },
    equipmentSources: [
      {
        loadoutEntryId: LOADOUT_ID,
        equipmentId: EQUIPMENT_ID,
        sourceRevision: 2,
        sourceVersionId: EQUIPMENT_VERSION_ID,
        sourceChecksum: checksumRuleDocument(equipmentPayload),
        payload: equipmentPayload
      }
    ]
  } as Json
  return actor
}

describe('movement reaction capability discovery', () => {
  it('binds structured Feature variants to the exact pinned base Equipment source', () => {
    const actor = equipmentBoundCreatureActor()
    const descriptors = createEncounterFeatureActionCapabilityDiscoveryRegistry([
      testCreatureFeatureAdapter
    ]).discover({ actor })
    expect(descriptors).toHaveLength(2)
    expect(descriptors.map((descriptor) => descriptor.equipmentBinding)).toEqual([
      expect.objectContaining({
        loadoutEntryId: LOADOUT_ID,
        equipmentId: EQUIPMENT_ID,
        sourceVersionId: EQUIPMENT_VERSION_ID
      }),
      expect.objectContaining({
        loadoutEntryId: LOADOUT_ID,
        equipmentId: EQUIPMENT_ID,
        sourceVersionId: EQUIPMENT_VERSION_ID
      })
    ])
    expect(descriptors.map((descriptor) => descriptor.attackMechanic)).toEqual([
      expect.objectContaining({ attackBonus: 4, rollMode: 'NORMAL' }),
      expect.objectContaining({ attackBonus: 4, rollMode: 'NORMAL' })
    ])
    const baseEquipmentEffect = compileEffect(
      (actor.snapshot as { equipmentSources: Array<{ payload: { effects: unknown[] } }> })
        .equipmentSources[0]!.payload.effects[0] as Parameters<typeof compileEffect>[0]
    )
    expect(descriptors[0]?.compiledEffect).toMatchObject({
      id: '00000000-0000-4000-8000-000000000022',
      entries: [
        {
          id: baseEquipmentEffect.entries[0]?.id,
          pathGroupId: baseEquipmentEffect.entries[0]?.pathGroupId,
          outcome: { dice: '1d4+2' }
        }
      ]
    })
    expect(descriptors[1]?.compiledEffect.id).toBe('00000000-0000-4000-8000-000000000023')
    expect(descriptors[1]?.compiledEffect).toMatchObject({
      entries: [{ outcome: { dice: '2d4+2' } }]
    })
    for (const descriptor of descriptors) {
      assertEncounterFeatureActionCapabilityCurrent({ actor, capability: descriptor })
    }
    const snapshot = actor.snapshot as { equipmentSources: Array<Record<string, unknown>> }
    snapshot.equipmentSources[0]!.sourceChecksum = 'c'.repeat(64)
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({ actor, capability: descriptors[0]! })
    ).toThrow('checksum does not match')
  })

  it('preserves additional typed outcomes on an Equipment-backed Creature action', () => {
    const actor = equipmentBoundCreatureActor({ extraOutcome: true })
    const [descriptor] = createEncounterFeatureActionCapabilityDiscoveryRegistry([
      testCreatureFeatureAdapter
    ]).discover({ actor })

    expect(
      descriptor?.compiledEffect.entries.map((entry) =>
        'outcome' in entry ? entry.outcome.effectKind : null
      )
    ).toEqual(['DAMAGE', 'CONDITION'])
    assertEncounterFeatureActionCapabilityCurrent({ actor, capability: descriptor! })
  })

  it('prefers the Encounter-owned loadout overlay and rejects incompatible bound Equipment', () => {
    const actor = equipmentBoundCreatureActor()
    const snapshot = actor.snapshot as {
      equipmentLoadoutOverride?: Array<Record<string, unknown>>
      equipmentSources: Array<Record<string, unknown>>
    }
    const replacementEquipmentId = '00000000-0000-4000-8000-000000000028'
    const replacementPayload = {
      ...(snapshot.equipmentSources[0]!.payload as Record<string, unknown>),
      id: replacementEquipmentId
    }
    snapshot.equipmentLoadoutOverride = [
      {
        id: LOADOUT_ID,
        equipmentId: replacementEquipmentId,
        quantity: 1,
        useState: 'HELD',
        attuned: false,
        actionFeatureIds: [FEATURE_ID]
      }
    ]
    snapshot.equipmentSources[0] = {
      ...snapshot.equipmentSources[0]!,
      equipmentId: replacementEquipmentId,
      sourceVersionId: '00000000-0000-4000-8000-000000000029',
      payload: replacementPayload,
      sourceChecksum: checksumRuleDocument(replacementPayload)
    }
    expect(snapshotCreatureEquipmentLoadout(actor)[0]?.equipmentId).toBe(replacementEquipmentId)
    expect(
      createEncounterFeatureActionCapabilityDiscoveryRegistry([
        testCreatureFeatureAdapter
      ]).discover({ actor })[0]?.equipmentBinding
    ).toMatchObject({ equipmentId: replacementEquipmentId })
    assertEncounterCreatureEquipmentLoadoutCapabilities(actor)

    const incompatiblePayload = { ...replacementPayload, effects: [] }
    snapshot.equipmentSources[0] = {
      ...snapshot.equipmentSources[0]!,
      payload: incompatiblePayload,
      sourceChecksum: checksumRuleDocument(incompatiblePayload)
    }
    expect(() => assertEncounterCreatureEquipmentLoadoutCapabilities(actor)).toThrow(
      'has no compiled action mechanics'
    )
  })

  it('uses the production D&D adapter without replacing the generic compiled Effect', () => {
    const [descriptor] = discoverEncounterFeatureActionCapabilities({ actor: creatureActor() })

    expect(descriptor).toMatchObject({
      gameSystemId: DND5E_SYSTEM_ID,
      effectId: EFFECT_ID,
      compiledEffect: {
        id: EFFECT_ID,
        invocation: {
          reactionMovementTrigger: { eligibilityDefinitionId: ELIGIBILITY_ID }
        }
      }
    })
    expect(descriptor?.compiledEffectChecksum).toBe(
      checksumRuleDocument(descriptor?.compiledEffect)
    )
  })

  it('retains exact Character and immutable Creature feature reaction capabilities', () => {
    const character = characterCapability()
    const actor = creatureActor()
    const snapshot = actor.snapshot as { payload: { features: Array<{ effects: unknown[] }> } }
    const normalizedFeature = featureDtoSchema.parse(snapshot.payload.features[0])
    const expectedEffectChecksum = checksumRuleDocument(normalizedFeature.effects?.[0])
    const creature = createEncounterFeatureActionCapabilityDiscoveryRegistry([
      testCreatureFeatureAdapter
    ]).discover({ actor })
    const discovered = discoverMovementReactionCapabilities([character, ...creature])

    expect(discovered).toHaveLength(2)
    expect(discovered.map(({ capability }) => capability.kind)).toEqual([
      'CHARACTER_ACTION',
      'ENCOUNTER_FEATURE'
    ])
    expect(creature[0]).toMatchObject({
      encounterActorId: ACTOR_ID,
      creatureSourceId: '00000000-0000-4000-8000-000000000003',
      ownerFeatureId: FEATURE_ID,
      featureOptionId: null,
      ownerRuleDefinitionIds: [OWNER_RULE_DEFINITION_ID],
      optionRuleDefinitionIds: [],
      sourceRevision: 1,
      sourceVersionId: SOURCE_VERSION_ID,
      sourceChecksum: 'a'.repeat(64),
      effectId: EFFECT_ID,
      entryPointDefinitionId: EFFECT_ID,
      authoredEffectChecksum: expectedEffectChecksum
    })
    expect(creature[0]?.compiledEffectChecksum).toBe(
      checksumRuleDocument(creature[0]?.compiledEffect)
    )
  })

  it('discovers top-level and nested Feature option actions without collapsing provenance or resource use', () => {
    const actor = creatureActor()
    const snapshot = actor.snapshot as {
      payload: { features: Array<Record<string, unknown>> }
    }
    const feature = snapshot.payload.features[0]!
    const topLevelEffect = (feature.effects as Array<Record<string, unknown>>)[0]!
    feature.charges = {
      id: '00000000-0000-4000-8000-0000000000d5',
      resetKind: 'SHORT_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      amount: 3
    }
    feature.options = [
      {
        id: OPTION_ID,
        label: 'Nested option',
        description: '',
        order: 0,
        ruleDefinitionIds: [OPTION_RULE_DEFINITION_ID],
        effects: [
          {
            id: OPTION_EFFECT_ID,
            order: 0,
            invocation: {
              kind: 'ACTION',
              triggerCode: 'ACTIVATED',
              activation: { code: 'ACTION', amount: 1 },
              range: { id: 'range', rangeKind: 'SELF' },
              resourceUse: {
                chargeId: '00000000-0000-4000-8000-0000000000d5',
                cost: 2
              }
            },
            paths: topLevelEffect.paths
          }
        ]
      }
    ]
    const discovered = createEncounterFeatureActionCapabilityDiscoveryRegistry([
      testCreatureFeatureAdapter
    ]).discover({ actor })

    expect(discovered).toHaveLength(2)
    expect(discovered.map((entry) => entry.actionId)).toEqual([
      `${ACTOR_ID}:FEATURE:${FEATURE_ID}:EFFECT:${EFFECT_ID}`,
      `${ACTOR_ID}:FEATURE:${FEATURE_ID}:OPTION:${OPTION_ID}:EFFECT:${OPTION_EFFECT_ID}`
    ])
    expect(discovered[1]).toMatchObject({
      ownerFeatureId: FEATURE_ID,
      featureOptionId: OPTION_ID,
      ownerRuleDefinitionIds: [OWNER_RULE_DEFINITION_ID],
      optionRuleDefinitionIds: [OPTION_RULE_DEFINITION_ID],
      compiledEffect: {
        invocation: {
          resourceUse: { chargeId: '00000000-0000-4000-8000-0000000000d5', cost: 2 }
        }
      }
    })
  })

  it('excludes Custom, passive, ordinary, and unbound capabilities', () => {
    const custom = {
      ...creatureActor(),
      kind: 'CUSTOM' as const,
      sourceId: null,
      sourceRevision: null
    }
    expect(
      createEncounterFeatureActionCapabilityDiscoveryRegistry([
        testCreatureFeatureAdapter
      ]).discover({
        actor: custom
      })
    ).toEqual([])
    expect(
      createEncounterFeatureActionCapabilityDiscoveryRegistry([]).discover({
        actor: creatureActor()
      })
    ).toEqual([])
    expect(
      discoverMovementReactionCapabilities([
        characterCapability(effect({ passive: true })),
        characterCapability(effect({ activation: ACTIVATION_CODE.ACTION })),
        characterCapability(effect({ binding: false }))
      ])
    ).toEqual([])
  })

  it('sorts by exact stable identities and rejects a mismatched binding', () => {
    const first = characterCapability()
    const later: EffectActionCapabilityDescriptor = {
      ...first,
      actionId: `z:ACTION:${EFFECT_ID}`,
      sourceId: '00000000-0000-4000-8000-000000000099'
    }
    expect(
      discoverMovementReactionCapabilities([later, first]).map((entry) => entry.capability.actionId)
    ).toEqual([first.actionId, later.actionId])
    expect(() =>
      discoverMovementReactionCapabilities([
        {
          ...first,
          mechanicFacts: {
            ...first.mechanicFacts,
            invocation: {
              ...first.mechanicFacts.invocation,
              reactionMovementTrigger: {
                ...first.mechanicFacts.invocation.reactionMovementTrigger!,
                eligibilityDefinitionId: '00000000-0000-4000-8000-000000000098'
              }
            }
          }
        }
      ])
    ).toThrow('does not match the compiled Effect')
  })

  it('retains the generic compiled Effect when a System adapter returns an unrelated extra field', () => {
    const invalid: EncounterFeatureActionCapabilityAdapter = {
      gameSystemId: DND5E_SYSTEM_ID,
      compile: () => ({ compiledEffect: effect({ binding: false }) }) as never
    }
    const [descriptor] = createEncounterFeatureActionCapabilityDiscoveryRegistry([
      invalid
    ]).discover({
      actor: creatureActor()
    })
    expect(descriptor?.compiledEffect.invocation).toMatchObject({
      reactionMovementTrigger: { eligibilityDefinitionId: ELIGIBILITY_ID }
    })
  })

  it('rejects repeated immutable feature/effect rows before they can fabricate duplicate actions', () => {
    const actor = creatureActor()
    const snapshot = actor.snapshot as { payload: { features: unknown[] } }
    snapshot.payload.features.push(snapshot.payload.features[0]!)
    expect(() =>
      createEncounterFeatureActionCapabilityDiscoveryRegistry([
        testCreatureFeatureAdapter
      ]).discover({ actor })
    ).toThrow('duplicate action identity')
  })

  it('rejects malformed nested immutable Feature identities instead of skipping them', () => {
    const actor = creatureActor()
    const snapshot = actor.snapshot as {
      payload: { features: Array<Record<string, unknown>> }
    }
    snapshot.payload.features[0]!.options = [
      { id: 'not-a-uuid', label: 'Invalid', description: '', order: 0, effects: [] }
    ]
    expect(() =>
      createEncounterFeatureActionCapabilityDiscoveryRegistry([
        testCreatureFeatureAdapter
      ]).discover({ actor })
    ).toThrow('Creature feature option identity must be a canonical PostgreSQL UUID')
  })

  it('rejects an option with multiple action-invoked Effects without fabricating a composite action', () => {
    const actor = creatureActor()
    const snapshot = actor.snapshot as {
      payload: { features: Array<Record<string, unknown>> }
    }
    const feature = snapshot.payload.features[0]!
    const topLevelEffect = (feature.effects as Array<Record<string, unknown>>)[0]!
    feature.options = [
      {
        id: OPTION_ID,
        label: 'Invalid multi-effect option',
        description: '',
        order: 0,
        effects: [topLevelEffect, { ...topLevelEffect, id: '00000000-0000-4000-8000-0000000000d6' }]
      }
    ]
    expect(() =>
      createEncounterFeatureActionCapabilityDiscoveryRegistry([
        testCreatureFeatureAdapter
      ]).discover({ actor })
    ).toThrow('at most one action-invoked Effect')
  })

  it.each([
    ['kind', 'CUSTOM'],
    ['id', '00000000-0000-4000-8000-000000000099'],
    ['systemId', '00000000-0000-4000-8000-000000000099'],
    ['sourceRevision', 2]
  ] as const)('rejects a Creature snapshot with a mismatched %s', (field, value) => {
    const actor = creatureActor()
    const snapshot = actor.snapshot as Record<string, unknown>
    snapshot[field] = value
    expect(() =>
      createEncounterFeatureActionCapabilityDiscoveryRegistry([
        testCreatureFeatureAdapter
      ]).discover({ actor })
    ).toThrow('invalid immutable source provenance')
  })
})
