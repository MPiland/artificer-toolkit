import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCharacterSpellCastRuleFacts } from '../character/characterSpellCastRuleFacts.js'
import { buildCharacterSpellRuleFacts } from '../character/characterSpellRuleFacts.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { targetingExcludesCreatureType } from '../encounterActionTargetPolicy.js'
import { encounterSourceImmunityLabel } from '../encounterSourceImmunity.js'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature,
  srdRegistry
} from '../testing/dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  characterActor,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast, plannedCastEffects } from '../testing/plannedTimedCondition.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId
} from './encounterCreatureAction.js'

const SOURCE_ID = testUuid(0x5100)
const OTHER_SOURCE_ID = testUuid(0x5101)
const TARGET_ID = testUuid(0x5102)
const FRIGHTENED = srdCondition('Frightened')
const ROAR_ID = testUuid(0x5110)
const ROAR_EFFECT_ID = testUuid(0x5111)

/**
 * A homebrew Roar written from core options alone (ADR 0038): DC 13 Wisdom or Frightened until the
 * end of the roarer's next turn; a creature that succeeds is immune to this roarer's Roar for an hour.
 */
function roaringOgre(): CreatureAuthored {
  const ogre = srdByLabel(SRD.creatures, 'Ogre')
  return {
    ...ogre,
    features: [
      ...ogre.features,
      {
        id: ROAR_ID,
        label: 'Roar',
        description:
          'Each creature of the ogre’s choice within 30 feet must make a DC 13 Wisdom save.',
        order: 99,
        effects: [
          {
            id: ROAR_EFFECT_ID,
            order: 1,
            invocation: {
              kind: 'ACTION' as const,
              triggerCode: 'SAVING_THROW' as const,
              savingThrow: {
                id: testUuid(0x5112),
                dcMethod: 'FIXED_DC' as const,
                abilityDefinitionId: srdAbilityId('WISDOM'),
                baseDc: 13
              },
              activation: { code: 'ACTION' as const, amount: 1 },
              range: {
                id: testUuid(0x5113),
                rangeKind: 'DISTANCE' as const,
                amount: 30,
                unit: 'FEET' as const
              },
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              }
            },
            paths: [
              {
                id: testUuid(0x5114),
                order: 1,
                pathCode: 'ON_SAVE_FAIL' as const,
                groupType: 'SINGLE' as const,
                originKind: 'SOURCE' as const,
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: testUuid(0x5115),
                  resultKind: 'SINGLE' as const,
                  duration: { id: testUuid(0x5116), durationKind: 'ROUND' as const, amount: 1 },
                  lifecycle: {
                    turnAnchor: { actor: 'SOURCE' as const, boundary: 'END_OF_TURN' as const }
                  },
                  outcomes: [
                    {
                      id: testUuid(0x5117),
                      effectKind: 'CONDITION' as const,
                      conditionId: FRIGHTENED,
                      recordsSource: true
                    }
                  ]
                }
              },
              {
                id: testUuid(0x5118),
                order: 2,
                pathCode: 'ON_SAVE_SUCCESS' as const,
                groupType: 'SINGLE' as const,
                originKind: 'SOURCE' as const,
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: testUuid(0x5119),
                  resultKind: 'SINGLE' as const,
                  duration: { id: testUuid(0x511a), durationKind: 'HOUR' as const, amount: 1 },
                  outcomes: [{ id: testUuid(0x511b), effectKind: 'SOURCE_IMMUNITY' as const }]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}

/** The Roar against a seeded Ogre (WIS 7: -2 to its save), its save d20 the given 0-based face. */
async function roar(saveFace: number, sourceId = SOURCE_ID) {
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: sourceId, creature: roaringOgre() }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: ROAR_ID,
    overridable: true
  })
  const { execution, mechanics } = await settleCreatureAction({ prepared, rolls: [saveFace] })
  const target = mechanics.targetPlan.updatedActor
  if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
  return {
    prepared,
    conditionIds: readEncounterActorConditionState(target.conditions).ids,
    effects: prepareNativeActionEffectsPlan({
      prepared,
      execution,
      occurrenceId: testUuid(0x5120),
      commandId: testUuid(0x5121),
      activeEffectsByActorId: new Map()
    })
  }
}

describe('immunity to a source after a successful save (SPELLS-31.T5l, D156)', () => {
  it('frightens on a failure and plans no immunity', async () => {
    const failed = await roar(0)
    expect(failed.conditionIds).toEqual([FRIGHTENED])
    expect(failed.effects.riderEffects.filter(Boolean)).toEqual([])
  })

  it('makes a target that saves immune to this roarer’s Roar for its hour, outliving the action', async () => {
    const saved = await roar(19)
    expect(saved.conditionIds).toEqual([])
    expect(saved.effects.riderMaintained).toBe(false)
    expect(saved.effects.riderEffects[0]?.definition).toMatchObject({
      origin: { sourceActorId: SOURCE_ID },
      recurrence: { expiration: { kind: 'TICKS', initialRemaining: 600 } },
      stateContributions: [
        {
          kind: 'SOURCE_IMMUNITY',
          immuneToId: ROAR_EFFECT_ID,
          sourceCharacterId: null,
          sourceLabel: 'Roar'
        }
      ]
    })
  })

  it('refuses the same roarer’s Roar against the holder, not another roarer’s', async () => {
    const saved = await roar(19)
    const immunity = saved.effects.riderEffects[0]
    if (!immunity) throw new Error('The successful save planned no immunity.')
    const held = [
      {
        ...activeEffect({
          id: testUuid(0x5122),
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: TARGET_ID },
          createdOrdinal: 1,
          sourceActorId: SOURCE_ID,
          stateContributions: [immunity.definition.stateContributions[0]!]
        }),
        definition: immunity.definition
      }
    ]
    expect(
      encounterSourceImmunityLabel({ source: saved.prepared.source, holderEffects: held })
    ).toBe('Roar')
    const other = await roar(0, OTHER_SOURCE_ID)
    expect(
      encounterSourceImmunityLabel({ source: other.prepared.source, holderEffects: held })
    ).toBeNull()
  })
})

describe('SRD Intimidating Presence (SPELLS-31.T5l)', () => {
  const berserker = srdByLabel(SRD.classes, 'Path of the Berserker')
  const effectId = berserker.features
    ?.find((feature) => feature.label === 'Intimidating Presence')
    ?.effects?.at(0)?.id

  it('compiles to Frightened on a failure and a day of immunity on a success', () => {
    const barbarian = evaluateSrdCharacter({
      classes: [{ label: 'Barbarian', level: 10, subclass: 'Path of the Berserker' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Barbarian',
          subclassLabel: 'Path of the Berserker',
          featureLabel: 'Intimidating Presence',
          level: 10
        })
      ]
    })
    const entry = compileCharacterActionEntryPoints({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: barbarian.facts.actionCandidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: SRD_SYSTEM_ID,
        candidates: barbarian.facts.actionCandidates,
        conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id).sort(),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        entryPoints: barbarian.entryPoints
      })
    }).find((value) => value.kind === 'CHARACTER_ACTION' && value.effectId === effectId)
    if (entry?.kind !== 'CHARACTER_ACTION' || entry.compilation.kind !== 'COMPILED')
      throw new Error('SRD Intimidating Presence must compile.')
    const plan = entry.compilation.activeEffectPlan
    expect(plan?.conditionContributions).toMatchObject([{ conditionId: FRIGHTENED }])
    expect(plan?.sourceImmunity).toMatchObject({
      appliesTo: 'SAVE_SUCCESS',
      immuneToId: effectId,
      // 24 hours of 6-second rounds.
      initialRemaining: 14_400
    })
  })
})

describe('SRD Chains of Carceri: a grant that locks each target out (SPELLS-31.T5l, D156)', () => {
  const warlock = srdByLabel(SRD.classes, 'Warlock')
  const holdMonster = srdByLabel(SRD.spells, 'Hold Monster')
  const compiledWarlock = srdRegistry.classes[warlock.id]
  const chains = compiledWarlock?.features
    ?.find((feature) => feature.label === 'Eldritch Invocations')
    ?.options?.find((option) => option.label === 'Chains of Carceri')
  if (!compiledWarlock || !chains) throw new Error('The SRD Warlock offers Chains of Carceri.')
  const typeId = (code: string) => SRD_CREATURE_TYPES.find((type) => type.code === code)!.id
  const CASTER_ID = testUuid(0x5130)
  const HOLDER_ID = testUuid(0x5131)
  const CHARACTER_ID = testUuid(0x5132)

  const warlock15 = evaluateSrdCharacter({
    classes: [{ label: 'Warlock', level: 15 }],
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: 'Warlock',
        featureLabel: 'Eldritch Invocations',
        level: 2,
        optionLabels: ['Chains of Carceri']
      })
    ]
  })
  const { spellAccessCandidates } = buildCharacterSpellRuleFacts(warlock15.snapshot, srdRegistry)
  const access = spellAccessCandidates.find(({ spellId }) => spellId === holdMonster.id)
  const casts = buildCharacterSpellCastRuleFacts({
    snapshot: warlock15.snapshot,
    spellCatalog: SRD.spells,
    spellAccessCandidates,
    resourcePoolCandidates: []
  }).spellCastCandidates
  const atWill = casts.find(({ castMode }) => castMode === 'AT_WILL')
  if (!access || !atWill) throw new Error('Chains of Carceri grants Hold Monster at will.')
  const cast = compiledTestSpellCast({
    spell: holdMonster,
    cast: atWill,
    decision: { status: 'AVAILABLE', reasonCode: 'AT_WILL', slotKey: null },
    spellAccessCandidates
  })
  const planned = (resultPath: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS') =>
    plannedCastEffects({
      encounterId: ENCOUNTER_ID,
      sourceActorId: CASTER_ID,
      sourceCharacterId: CHARACTER_ID,
      holderActorId: HOLDER_ID,
      spell: holdMonster,
      entry: cast.entry,
      lifetimeScope: 'ENCOUNTER',
      resultPath
    })

  it('carries the grant’s creature types and lockout into spell access', () => {
    expect(access).toMatchObject({
      sourceKind: 'OPTION',
      sourceId: chains.id,
      acquiredParentId: `acquired:${compiledWarlock.features?.find((feature) => feature.label === 'Eldritch Invocations')?.id}`,
      perTargetLockout: true,
      allowedCreatureTypeIds: [typeId('CELESTIAL'), typeId('FIEND'), typeId('ELEMENTAL')]
    })
  })

  it('narrows its casts to celestials, fiends and elementals', () => {
    const policy = cast.entry.targetPolicy
    if (!policy) throw new Error('The cast carries its target policy.')
    const { targeting } = policy
    expect(targetingExcludesCreatureType(targeting, typeId('FIEND'))).toBe(false)
    expect(targetingExcludesCreatureType(targeting, typeId('HUMANOID'))).toBe(true)
  })

  it('locks every creature it targets out of the grant, whether it saves or not', () => {
    expect(cast.entry.compilation.activeEffectPlan?.sourceImmunity).toMatchObject({
      appliesTo: 'EVERY_TARGET',
      immuneToId: access.grantId,
      initialRemaining: null
    })
    for (const resultPath of ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS'] as const)
      expect(planned(resultPath).riderEffects[0]?.definition, resultPath).toMatchObject({
        // A Run holds no rest, so the lockout lasts the Run.
        recurrence: {
          recurrenceStage: 'NONE',
          anchor: 'HOLDER',
          lifetimeScope: 'ENCOUNTER',
          expiration: { kind: 'INDEFINITE' }
        },
        stateContributions: [
          {
            kind: 'SOURCE_IMMUNITY',
            immuneToId: access.grantId,
            sourceCharacterId: CHARACTER_ID,
            sourceLabel: 'Hold Monster'
          }
        ]
      })
  })

  it('refuses the locked-out creature this Warlock’s next at-will cast', () => {
    const lockout = planned('ON_SAVE_SUCCESS').riderEffects[0]
    if (!lockout) throw new Error('The cast planned no lockout.')
    const holderEffects = [
      {
        ...activeEffect({
          id: testUuid(0x5133),
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
          createdOrdinal: 1,
          sourceActorId: CASTER_ID,
          stateContributions: [lockout.definition.stateContributions[0]!]
        }),
        definition: lockout.definition
      }
    ]
    const source = {
      kind: 'CHARACTER_ACTION' as const,
      actor: characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
      characterId: CHARACTER_ID,
      characterStreamVersion: 1,
      candidate: cast.candidate,
      entry: cast.entry,
      effectivePolicyOutput: warlock15.output
    }
    expect(encounterSourceImmunityLabel({ source, holderEffects })).toBe('Hold Monster')
  })

  it('locks nobody out of a slot cast of the same spell', () => {
    const slotCast = compiledTestSpellCast({
      spell: holdMonster,
      cast: {
        sequence: 0,
        candidateId: `CLASS:warlock:${holdMonster.id}:level:5`,
        spellId: holdMonster.id,
        source: { spellId: holdMonster.id, sourceKind: 'CLASS', sourceInstanceId: 'warlock' },
        spellLevel: 5,
        castMode: 'SPELL_SLOT',
        castLevel: 5,
        baseEntry: true,
        resourceOwnerKey: null,
        slotPoolCode: null
      },
      decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:5' },
      spellAccessCandidates
    })
    expect(slotCast.entry.compilation.activeEffectPlan?.sourceImmunity).toBeNull()
  })
})
