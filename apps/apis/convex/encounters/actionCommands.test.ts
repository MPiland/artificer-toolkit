import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import {
  sceneStoredLiveStateSchema,
  sceneStoredLiveEntitySchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import {
  encounterAttackActionState,
  encounterRuleUsageUsed,
  featureChargeUsed,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { seededSrdCreature, srdWolf } from '../../tests/fixtures/srdCreatures'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  readRoomRollCards,
  readRoomTimeline,
  type RoomCaller,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import {
  expectReusedCommandRefusal,
  expectUnavailableRefusal,
  rejection
} from '../../tests/fixtures/roomRefusals'

useLocalRoomWorker()

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
/**
 * The Wolf with its Bite rewritten to a one-damage ACTIVATED action at any range, for tests of
 * charges, self targeting, recurring effects, saves and undo that need no attack roll or Scene.
 */
const creature = {
  ...srdWolf,
  features: srdWolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              range: {
                id: effect.invocation.range.id,
                rangeKind: 'UNLIMITED' as const
              },
              // It names another creature, so targeting its own user stays a warning (D99).
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const,
                self: 'WARN'
              }
            },
            paths: effect.paths?.slice(0, 1).map((path) => {
              if (!('resultBlock' in path)) return path
              return {
                ...path,
                pathCode: 'ON_USE' as const,
                resultBlock: {
                  ...path.resultBlock,
                  outcomes: path.resultBlock.outcomes.map((outcome) => {
                    if (outcome.effectKind !== 'DAMAGE')
                      throw new Error('Expected Bite damage fixture.')
                    return {
                      id: outcome.id,
                      effectKind: 'DAMAGE' as const,
                      damageTypeId: outcome.damageTypeId,
                      valueKind: 'FIXED' as const,
                      scalingKind: 'NONE' as const,
                      amount: 1
                    }
                  })
                }
              }
            })
          }))
        }
  )
}

function nativeCreature(
  charged: boolean,
  self = false,
  recurring = false,
  phased = false,
  nestedForced = false,
  outcomeDice = false,
  condition = false,
  directRepeatSave = false,
  conditionImmune = false
) {
  const strengthAbilityDefinitionId = srdSystemRecord.abilities?.find(
    (ability) => ability.code === 'STRENGTH'
  )?.id
  if (!strengthAbilityDefinitionId) throw new Error('Missing Strength ability definition.')
  return {
    ...creature,
    ...(conditionImmune
      ? {
          conditionImmunities: [
            srdSystemRecord.conditionTypes.find((condition) => condition.code === 'FRIGHTENED')!.id
          ]
        }
      : {}),
    features: creature.features.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            ...(phased
              ? {
                  rollDefinitions: [
                    {
                      id: '00000000-0000-4000-8000-000000000095',
                      label: 'Bite attack',
                      kind: 'ATTACK' as const,
                      expression: { count: 1, die: 20, modifier: 4 },
                      rollMode: 'NORMAL' as const,
                      chargeCost: null,
                      order: 1
                    }
                  ]
                }
              : {}),
            ...(charged
              ? {
                  charges: {
                    id: '00000000-0000-4000-8000-000000000099',
                    limitKind: 'FIXED_AMOUNT' as const,
                    scalingKind: 'NONE' as const,
                    resetKind: 'MANUAL' as const,
                    amount: 1
                  }
                }
              : {}),
            effects: feature.effects?.map((effect) => ({
              ...effect,
              invocation: directRepeatSave
                ? {
                    ...effect.invocation,
                    triggerCode: 'SAVING_THROW' as const,
                    savingThrow: {
                      id: '00000000-0000-4000-8000-000000000060',
                      dcMethod: 'FIXED_DC' as const,
                      abilityDefinitionId:
                        srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
                          ?.id ??
                        (() => {
                          throw new Error('Missing Dexterity ability fixture.')
                        })(),
                      baseDc: 10
                    },
                    range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
                    targeting: {
                      selectionKind: 'SINGLE_TARGET' as const,
                      dispositionKind: 'ANY' as const
                    }
                  }
                : phased
                  ? {
                      ...effect.invocation,
                      triggerCode: 'MELEE_WEAPON_ATTACK' as const,
                      range: {
                        id: effect.invocation.range.id,
                        rangeKind: 'UNLIMITED' as const
                      },
                      targeting: {
                        selectionKind: 'SINGLE_TARGET' as const,
                        dispositionKind: 'ANY' as const
                      },
                      ...(charged
                        ? {
                            resourceUse: {
                              chargeId: '00000000-0000-4000-8000-000000000099',
                              cost: 1
                            }
                          }
                        : {})
                    }
                  : charged
                    ? {
                        ...effect.invocation,
                        ...(self
                          ? {
                              range: {
                                id: effect.invocation.range.id,
                                rangeKind: 'SELF' as const
                              },
                              targeting: { selectionKind: 'SELF' as const }
                            }
                          : {}),
                        resourceUse: {
                          chargeId: '00000000-0000-4000-8000-000000000099',
                          cost: 1
                        }
                      }
                    : self
                      ? {
                          ...effect.invocation,
                          range: {
                            id: effect.invocation.range.id,
                            rangeKind: 'SELF' as const
                          },
                          targeting: { selectionKind: 'SELF' as const }
                        }
                      : effect.invocation,
              ...(directRepeatSave
                ? {
                    paths: [
                      {
                        id: '00000000-0000-4000-8000-000000000061',
                        order: 1,
                        pathCode: 'ON_SAVE_FAIL' as const,
                        groupType: 'SEQUENTIAL' as const,
                        originKind: 'SOURCE' as const,
                        selectionKind: 'FIXED' as const,
                        resultBlock: {
                          id: '00000000-0000-4000-8000-000000000062',
                          resultKind: 'SEQUENCE' as const,
                          duration: {
                            id: '00000000-0000-4000-8000-000000000063',
                            durationKind: 'ROUND' as const,
                            amount: 10
                          },
                          outcomes: [
                            {
                              id: '00000000-0000-4000-8000-000000000064',
                              effectKind: 'CONDITION' as const,
                              conditionId:
                                srdSystemRecord.conditionTypes.find(
                                  (value) => value.code === 'FRIGHTENED'
                                )?.id ??
                                (() => {
                                  throw new Error('Missing frightened condition fixture.')
                                })()
                            },
                            {
                              id: '00000000-0000-4000-8000-000000000065',
                              effectKind: 'FOLLOW_UP_SAVE' as const,
                              timing: 'TARGET_TURN_END' as const,
                              savingThrow: {
                                id: '00000000-0000-4000-8000-000000000066',
                                dcMethod: 'FIXED_DC' as const,
                                abilityDefinitionId:
                                  srdSystemRecord.abilities?.find(
                                    (ability) => ability.code === 'DEXTERITY'
                                  )?.id ??
                                  (() => {
                                    throw new Error('Missing Dexterity ability fixture.')
                                  })(),
                                baseDc: 10
                              },
                              attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                              onSuccess: { kind: 'END' as const },
                              onFailure: { kind: 'CONTINUE' as const },
                              onDurationComplete: { kind: 'END' as const }
                            }
                          ]
                        }
                      }
                    ]
                  }
                : nestedForced
                  ? {
                      paths: effect.paths?.slice(0, 1).map((path) => {
                        if (!('resultBlock' in path)) return path
                        const damage = path.resultBlock.outcomes.find(
                          (outcome): outcome is Extract<typeof outcome, { effectKind: 'DAMAGE' }> =>
                            outcome.effectKind === 'DAMAGE'
                        )
                        if (!damage)
                          throw new Error('Missing nested forced-movement damage fixture.')
                        return {
                          ...path,
                          pathCode: 'ON_HIT' as const,
                          groupType: 'SEQUENTIAL' as const,
                          resultBlock: {
                            ...path.resultBlock,
                            id: '00000000-0000-4000-8000-000000000094',
                            resultKind: 'SEQUENCE' as const,
                            outcomes: [
                              {
                                id: '00000000-0000-4000-8000-000000000093',
                                effectKind: 'DAMAGE' as const,
                                damageTypeId: damage.damageTypeId,
                                valueKind: 'DICE' as const,
                                scalingKind: 'NONE' as const,
                                diceConfig: '1d6'
                              },
                              {
                                id: '00000000-0000-4000-8000-000000000092',
                                effectKind: 'FOLLOW_UP_SAVE' as const,
                                timing: 'IMMEDIATE' as const,
                                savingThrow: {
                                  id: '00000000-0000-4000-8000-000000000091',
                                  dcMethod: 'FIXED_DC' as const,
                                  abilityDefinitionId: strengthAbilityDefinitionId,
                                  baseDc: 10
                                },
                                attempts: { kind: 'ONCE' as const },
                                onFailure: {
                                  kind: 'OUTCOMES' as const,
                                  endCurrent: false,
                                  resultKind: 'SINGLE' as const,
                                  outcomes: [
                                    {
                                      id: '00000000-0000-4000-8000-000000000090',
                                      effectKind: 'FORCED_MOVEMENT' as const,
                                      direction: 'TOWARD_SOURCE' as const,
                                      actionEconomy: 'NONE' as const,
                                      distanceMode: 'EXACT' as const,
                                      amount: 25,
                                      unit: 'FEET' as const
                                    }
                                  ]
                                },
                                onSuccess: { kind: 'END' as const }
                              }
                            ]
                          }
                        }
                      })
                    }
                  : recurring
                    ? {
                        paths: effect.paths?.map((path) => {
                          if (!('resultBlock' in path)) return path
                          const frightened = srdSystemRecord.conditionTypes.find(
                            (value) => value.code === 'FRIGHTENED'
                          )
                          if (!frightened) throw new Error('Missing frightened condition fixture.')
                          return {
                            ...path,
                            resultBlock: {
                              ...path.resultBlock,
                              id: '00000000-0000-4000-8000-000000000096',
                              duration: {
                                id: '00000000-0000-4000-8000-000000000098',
                                durationKind: 'ROUND' as const,
                                amount: 2
                              },
                              lifecycle: { recurringKind: 'START_OF_TURN' as const },
                              outcomes: condition
                                ? [
                                    {
                                      id: '00000000-0000-4000-8000-0000000000aa',
                                      effectKind: 'CONDITION' as const,
                                      conditionId: frightened.id
                                    }
                                  ]
                                : [
                                    {
                                      id: '00000000-0000-4000-8000-000000000097',
                                      effectKind: 'HEAL' as const,
                                      valueKind: 'FIXED' as const,
                                      scalingKind: 'NONE' as const,
                                      amount: 1
                                    }
                                  ]
                            }
                          }
                        })
                      }
                    : phased
                      ? {
                          paths: effect.paths?.slice(0, 1).map((path) =>
                            'resultBlock' in path
                              ? {
                                  ...path,
                                  pathCode: 'ON_HIT' as const,
                                  resultBlock: outcomeDice
                                    ? {
                                        ...path.resultBlock,
                                        outcomes: path.resultBlock.outcomes.map((outcome) => {
                                          if (outcome.effectKind !== 'DAMAGE')
                                            throw new Error('Expected Bite damage.')
                                          return {
                                            id: outcome.id,
                                            effectKind: 'DAMAGE' as const,
                                            damageTypeId: outcome.damageTypeId,
                                            valueKind: 'DICE' as const,
                                            scalingKind: 'NONE' as const,
                                            diceConfig: '1d6'
                                          }
                                        })
                                      }
                                    : path.resultBlock
                                }
                              : path
                          )
                        }
                      : {})
            }))
          }
    )
  }
}

async function setup({
  charged = false,
  self = false,
  recurring = false,
  phased = false,
  nestedForced = false,
  targetCreature = false,
  rolls = 'AUTO_ROLL',
  distance = false,
  condition = false,
  directRepeatSave = false,
  conditionImmune = false,
  ranged = false
}: {
  charged?: boolean
  self?: boolean
  recurring?: boolean
  phased?: boolean
  nestedForced?: boolean
  targetCreature?: boolean
  rolls?: FixtureRolls
  distance?: boolean
  condition?: boolean
  directRepeatSave?: boolean
  conditionImmune?: boolean
  /** The seeded SRD Ape throws its Rock (range 25/50 ft.) in place of the Wolf's Bite. */
  ranged?: boolean
} = {}) {
  const base = await fixture()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  // Scene-bound actions run the seeded SRD Wolf's own Bite: a +4 melee attack within 5 feet.
  const actionCreature = ranged
    ? seededSrdCreature('Ape')
    : distance
      ? srdWolf
      : nativeCreature(
          charged,
          self,
          recurring,
          phased,
          nestedForced,
          rolls === 'PROMPT',
          condition,
          directRepeatSave,
          conditionImmune
        )
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) =>
        definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID ||
        (directRepeatSave &&
          definition.id ===
            srdSystemRecord.conditionTypes.find((condition) => condition.code === 'FRIGHTENED')?.id)
    )
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...actionCreature,
        subjectKind: 'CREATURE',
        document: actionCreature
      })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Native action fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Native action fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: actionCreature.id },
      ...(targetCreature ? [{ kind: 'CREATURE' as const, sourceId: actionCreature.id }] : []),
      { kind: 'CUSTOM', label: 'Target', maxHitPoints: 100 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, campaign.id)
  const creatures = run.actors.filter((candidate) => candidate.kind === 'CREATURE')
  const actor = creatures[0]
  const target = targetCreature
    ? creatures[1]
    : run.actors.find((candidate) => candidate.kind === 'CUSTOM')
  if (!actor || !target) throw new Error('Missing native action fixture actors.')
  await base.t.run((ctx) =>
    activateFixtureRun(ctx, run.id, {
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
  )
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!row) throw new Error('Missing native action fixture actor.')
    const capability = discoverEncounterFeatureActionCapabilities({
      spells: new Map(),
      actor: await readTestActor(ctx, row),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find(
      (candidate) =>
        candidate.mechanicFacts.invocation.triggerCode ===
        (ranged
          ? 'RANGED_WEAPON_ATTACK'
          : directRepeatSave
            ? 'SAVING_THROW'
            : phased
              ? 'MELEE_WEAPON_ATTACK'
              : 'ACTIVATED')
    )
    if (!capability) throw new Error('Missing native action fixture capability.')
    return capability.actionId
  })
  if (distance) {
    const sceneId = crypto.randomUUID()
    const definitionId = crypto.randomUUID()
    const saveId = crypto.randomUUID()
    const now = new Date().toISOString()
    const tokens = [actor.id, target.id].map((_, index) => ({
      id: crypto.randomUUID(),
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      label: index === 0 ? 'Source token' : 'Target token',
      locked: false,
      position: { x: index * 100, y: 0 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 1
    }))
    await base.t.run(async (ctx) => {
      const settings = {
        campaignId: campaign.id,
        name: 'Distance action Scene',
        ambientIllumination: 'BRIGHT' as const,
        daylight: false,
        fogMode: 'SHARED_PARTY' as const,
        visionRevealMode: 'ON_DRAG' as const,
        grid: {
          kind: 'SQUARE' as const,
          origin: { x: 0, y: 0 },
          cellSize: 100,
          distancePerCell: 5,
          diagonalPolicy: 'EQUAL' as const,
          unit: 'FEET' as const
        },
        map: { assetId: crypto.randomUUID(), width: 2000, height: 500, tileManifestAssetId: null }
      }
      const materializationCommandId = crypto.randomUUID()
      await ctx.db.insert(
        'campaignScenes',
        sceneStoredInitialStateSchema.parse({
          ...settings,
          id: sceneId,
          definitionId,
          definitionVersion: 1,
          definitionSaveId: saveId,
          version: 0,
          materializationCommandId,
          materializationCommandFingerprint: '0'.repeat(64),
          createdAt: now,
          updatedAt: now
        })
      )
      await ctx.db.insert(
        'sceneDefinitionSaves',
        sceneStoredDefinitionSaveSchema.parse({
          id: saveId,
          commandId: materializationCommandId,
          commandFingerprint: '0'.repeat(64),
          ownerUserId: base.owner.userId,
          definitionId,
          expectedVersion: null,
          settings,
          counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 2 },
          received: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 2 },
          status: 'PUBLISHED',
          liveSceneId: sceneId,
          entitiesRemoved: false,
          createdAt: now,
          expiresAt: Date.now() + 60_000
        })
      )
      for (const [ordinal, entity] of tokens.entries()) {
        const value = { collection: 'tokens' as const, entity }
        await ctx.db.insert(
          'sceneDefinitionEntities',
          sceneStoredDefinitionEntitySchema.parse({
            saveId,
            entityId: entity.id,
            ordinal,
            value,
            checksum: checksumCanonicalJson(value)
          })
        )
      }
      await ctx.db.insert(
        'campaignScenePresentations',
        sceneStoredPresentationSchema.parse({
          campaignId: campaign.id,
          sceneId,
          version: 0,
          activeMapAssetId: null,
          createdAt: now,
          updatedAt: now
        })
      )
      await ctx.db.insert('encounterSceneBindings', {
        encounterId: run.id,
        campaignId: campaign.id,
        sceneId,
        commandId: crypto.randomUUID(),
        commandFingerprint: checksumCanonicalJson({ sceneId }),
        createdAt: now
      })
    })
    const bind = makeFunctionReference<
      'mutation',
      { input: EncounterActorTokenBindingCommandInputDto },
      EncounterCommandResultDto
    >('encounters/actorTokenBindings:execute')
    let expectedEncounterVersion: number = run.version
    for (const [index, actorId] of [actor.id, target.id].entries()) {
      const result = await base.owner.caller.mutation(bind, {
        input: {
          type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
          commandId: crypto.randomUUID(),
          encounterId: run.id,
          expectedEncounterVersion,
          actorId,
          sceneId,
          tokenId: tokens[index]!.id
        }
      })
      expectedEncounterVersion = result.projection.version
    }
    return {
      ...base,
      campaign,
      blueprint,
      run: { ...run, version: expectedEncounterVersion },
      actor,
      target,
      actionId,
      sceneId,
      saveId,
      tokens
    }
  }
  return { ...base, campaign, blueprint, run, actor, target, actionId }
}

type DistanceSetup = Extract<Awaited<ReturnType<typeof setup>>, { sceneId: string }>

async function distanceSetup(options: Parameters<typeof setup>[0] = {}): Promise<DistanceSetup> {
  const value = await setup({ phased: true, targetCreature: true, ...options, distance: true })
  if (!('sceneId' in value) || !('tokens' in value) || !('saveId' in value))
    throw new Error('Distance Scene fixture was not created.')
  return value
}

async function advanceSceneVersion(t: Awaited<ReturnType<typeof fixture>>['t'], sceneId: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert(
      'sceneLiveStates',
      sceneStoredLiveStateSchema.parse({
        sceneId,
        version: 1,
        fogLayerCount: 0,
        nextFogOrdinal: 0,
        counts: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: 2,
          measurements: 0
        },
        nextOrdinals: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: 2,
          measurements: 0
        },
        settings: {
          ambientIllumination: { value: 'BRIGHT', daylight: false, version: 0 },
          visionRevealMode: { value: 'ON_DRAG', version: 0 },
          fogMode: { value: 'SHARED_PARTY', version: 0 }
        }
      })
    )
  })
}

async function replaceTargetToken(base: DistanceSetup, position: { x: number; y: number } | null) {
  await advanceSceneVersion(base.t, base.sceneId)
  await base.t.run(async (ctx) => {
    const token = base.tokens[1]!
    const change = {
      sceneId: base.sceneId,
      collection: 'tokens' as const,
      entityId: token.id.toLowerCase(),
      value: position
        ? {
            collection: 'tokens' as const,
            entity: { ...token, id: token.id.toLowerCase(), position }
          }
        : null,
      ordinal: position ? 1 : null,
      version: 1
    }
    await ctx.db.insert(
      'sceneLiveEntities',
      sceneStoredLiveEntitySchema.parse({
        ...change,
        checksum: checksumCanonicalJson(change)
      })
    )
    if (!position) {
      const head = await ctx.db
        .query('sceneLiveStates')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', base.sceneId))
        .unique()
      if (!head) throw new Error('Missing live Scene fixture.')
      await ctx.db.patch(head._id, { counts: { ...head.counts, tokens: 1 } })
    }
  })
}

/** Moves the target's token in the Scene definition itself, before the room first loads the Scene. */
async function moveDefinitionTargetToken(base: DistanceSetup) {
  await base.t.run(async (ctx) => {
    const entity = (await ctx.db.query('sceneDefinitionEntities').collect()).filter(
      (row) => row.value.collection === 'tokens'
    )
    const target = entity.find((row) => row.ordinal === 1)
    if (!target) throw new Error('Missing target Scene token.')
    if (target.value.collection !== 'tokens') throw new Error('Expected target token entity.')
    const value = {
      ...target.value,
      entity: { ...target.value.entity, position: { x: 300, y: 0 } }
    }
    await ctx.db.patch(target._id, { value, checksum: checksumCanonicalJson(value) })
  })
}

/** The tabletop move that takes the target out of range: a bound token moves at the Run's version. */
function moveTargetTokenInRoom(base: DistanceSetup, encounterVersion: number) {
  const targetToken = base.tokens[1]!
  return executeSceneInRoom(base.owner.caller, {
    type: 'MOVE_SCENE_TOKEN',
    commandId: crypto.randomUUID(),
    sceneId: base.sceneId,
    // The live Scene keys tokens by their lowercase ID.
    tokenId: targetToken.id.toLowerCase(),
    expectedSceneVersion: 0,
    expectedEncounterVersion: encounterVersion,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    path: [targetToken.position, { x: 450, y: 450 }]
  })
}

/** What the room's error log names for each fault in a distance action's Scene context. */
const distanceFaultCause = {
  missing: 'Scene',
  mismatched: 'token',
  stale: 'Scene'
} as const

function command(
  input: Pick<ResolveEncounterActionInputDto, 'actorId' | 'actionId'> & {
    targetActorId: string
    encounterId: string
    commandId?: string
    expectedVersion?: number
    sceneContext?: ResolveEncounterActionInputDto['sceneContext']
  }
): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: input.encounterId,
    commandId: input.commandId ?? crypto.randomUUID(),
    expectedVersion: input.expectedVersion ?? 0,
    actorId: input.actorId,
    target: { kind: 'ACTOR', actorId: input.targetActorId },
    actionId: input.actionId,
    optionalCombatIntent: null,
    sceneContext: input.sceneContext ?? null
  }
}

function creatureActorState(row: Parameters<typeof readStoredRunActor>[0]) {
  const actor = readStoredRunActor(row)
  if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character actor.')
  return actor
}

/** The Run as the room last published it: the room holds receipts and commands until it checkpoints (D85). */
async function records(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  encounterId: string,
  campaignId: string
) {
  await checkpointLiveRoom(campaignId)
  return t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
      .collect(),
    activeEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', encounterId)
      )
      .collect()
  }))
}

async function pendingFor(base: Awaited<ReturnType<typeof setup>>, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
}

/** What `caller` reads of the believed attack modifiers on each creature they can target (ATTACK-17.1). */
async function targetModifiersFor(
  base: DistanceSetup,
  caller: RoomCaller,
  expectedVersion: number,
  scene: { sceneId: string; expectedSceneVersion: number } | null
) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.actionTargetModifiers.get, {
    encounterId: base.run.id,
    expectedVersion,
    actorId: base.actor.id,
    actionId: base.actionId,
    scene
  })
}

/** Seats a second member who controls the acting actor, with the target Blinded (and revealed to them when asked). */
async function seatPlayerControllingActor(base: DistanceSetup, options: { reveal: boolean }) {
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
  )
  await setAutoRollDice(base.t, base.other.userId, false)
  const blinded = srdSystemRecord.conditionTypes.find((value) => value.code === 'BLINDED')
  if (!blinded) throw new Error('Missing Blinded condition fixture.')
  let version = base.run.version
  for (const update of [
    ...(options.reveal ? [{ actorId: base.target.id, reveal: 'NAMED' as const }] : []),
    { actorId: base.target.id, conditions: [blinded.id] },
    { actorId: base.actor.id, controllerUserIds: [base.other.userId] }
  ]) {
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version,
        ...update
      }
    })
    version = result.projection.version
  }
  return version
}

/** How many commands the room has committed past the Run's setup version, as it sends them to the GM (D85). */
async function committedCount(base: Awaited<ReturnType<typeof setup>>) {
  return (await readRoomTimeline(base.owner.caller, base.campaign.id)).filter(
    (entry) => entry.version > base.run.version
  ).length
}

describe('native encounter actions', () => {
  it('pauses Assisted evidence without spending, then settles, replays and rolls back through the public endpoint', async () => {
    const base = await setup({
      charged: true,
      phased: true,
      targetCreature: true,
      rolls: 'PROMPT'
    })
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    const before = await records(base.t, base.run.id, base.campaign.id)
    const issued = await executeInRoom(base.owner.caller, {
      command: input
    })
    let result = issued
    expect(result.occurrence?.status).toBe('PENDING')
    const committedBefore = await committedCount(base)
    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    const responses: Array<{
      command: ResolveRuleOccurrenceInputDto
      result: EncounterCommandResultDto
    }> = []
    while (result.occurrence?.status === 'PENDING') {
      expect(responses.length).toBeLessThan(20)
      const pending = result.occurrence.pending
      if (
        !pending ||
        (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      )
        throw new Error('Expected bounded Assisted action evidence.')
      const staged = await records(base.t, base.run.id, base.campaign.id)
      expect(staged.run).toEqual(before.run)
      expect(staged.actors).toEqual(before.actors)
      expect(await committedCount(base)).toBe(committedBefore)
      await expect(pendingFor(base, base.owner.caller)).resolves.toEqual(pending)
      await expect(pendingFor(base, base.other.caller)).resolves.toBeNull()
      const response: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        correlationId: null,
        occurrenceId: result.occurrence.occurrenceId,
        expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
        resolution:
          pending.kind === 'D20_EVIDENCE'
            ? {
                kind: 'ENTER_DICE',
                requestId: pending.request.requestId,
                rawFaces: pending.request.rollMode === 'NORMAL' ? [15] : [15, 15],
                rollMode: pending.request.rollMode
              }
            : {
                kind: 'ENTER_INTEGER',
                requestId: pending.request.requestId,
                value: pending.request.max
              }
      }
      // A player who does not control the roller may not answer its decision.
      await expect(executeInRoom(base.other.caller, { command: response })).rejects.toMatchObject({
        data: { reason: 'NOT_ACTOR_CONTROLLER' }
      })
      expect(
        await rejection(
          executeInRoom(base.owner.caller, {
            command: {
              ...response,
              resolution: {
                kind: 'SYSTEM_ROLL',
                requestId: 'stale-request',
                rollId: crypto.randomUUID()
              }
            }
          })
        )
      ).toMatchObject({ reason: 'ROLL_UNAVAILABLE' })
      expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(staged)
      // The room's held history (command rows, receipts, evidence rolls, occurrences) is unchanged by
      // the stale answer: `apps/session-worker/test/nativeRoomTurnEvidence.test.ts` ("a refused room
      // command leaves the held commands, receipts and evidence rolls as they were, even after a roll
      // is held") asserts it against the room's own tables.
      result = await executeInRoom(base.owner.caller, {
        command: response
      })
      const settledResponse = await records(base.t, base.run.id, base.campaign.id)
      // Once the action settles, a reused command ID with other input is refused and a fresh one is stale.
      const settledAction = result.occurrence?.status !== 'PENDING'
      const retry = (change: { correlationId: string } | { commandId: string }) =>
        executeInRoom(base.owner.caller, { command: { ...response, ...change } })
      if (settledAction) {
        await expectReusedCommandRefusal(retry({ correlationId: crypto.randomUUID() }))
        await expect(retry({ commandId: crypto.randomUUID() })).rejects.toMatchObject({
          data: { reason: 'VERSION_STALE' }
        })
      } else {
        await expectReusedCommandRefusal(retry({ correlationId: crypto.randomUUID() }))
        expect(await rejection(retry({ commandId: crypto.randomUUID() }))).toMatchObject({
          reason: 'VERSION_STALE',
          message: 'The action occurrence version is stale.'
        })
      }
      await expect(
        executeInRoom(base.owner.caller, {
          command: response
        })
      ).resolves.toEqual(result)
      expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settledResponse)
      responses.push({ command: response, result })
    }
    expect(responses.length).toBeGreaterThanOrEqual(2)
    expect(result.projection.version).toBe(1)
    expect(result.occurrence?.status).toBe('COMPLETE')
    const settled = await records(base.t, base.run.id, base.campaign.id)
    const source = settled.actors.find((actor) => actor.id === base.actor.id)
    const target = settled.actors.find((actor) => actor.id === base.target.id)
    if (!source || !target) throw new Error('Missing settled action actors.')
    const featureId = nativeCreature(true, false, false, true).features?.find(
      (feature) => feature.label === 'Bite'
    )?.id
    if (!featureId) throw new Error('Missing action Feature.')
    const sourceState = readStoredRunActor(source)
    expect(featureChargeUsed(sourceState, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(sourceState, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    expect(creatureActorState(target).currentHitPoints).toBeLessThan(base.target.currentHitPoints!)
    expect(await committedCount(base)).toBe(committedBefore + 1)
    // The root replays its own pending result over the settled projection.
    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual({ ...issued, projection: result.projection })
    // Each answer replays its own result over the settled projection.
    for (const answered of responses)
      await expect(
        executeInRoom(base.owner.caller, {
          command: answered.command
        })
      ).resolves.toEqual({ ...answered.result, projection: result.projection })
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
    await expectReusedCommandRefusal(
      executeInRoom(base.owner.caller, {
        command: { ...input, expectedVersion: 1, commandId: responses[0]!.command.commandId }
      })
    )
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
    const secondRun = await base.owner.caller.mutation(createRun, {
      campaignId: base.campaign.id,
      blueprintId: base.blueprint.id,
      commandId: crypto.randomUUID()
    })
    for (const run of [result.projection, secondRun]) {
      const beforeCollision = await records(base.t, run.id, base.campaign.id)
      await expectReusedCommandRefusal(
        executeInRoom(base.owner.caller, {
          command: {
            type: 'UPSERT_REMINDER',
            encounterId: run.id,
            expectedVersion: run.version,
            commandId: responses[0]!.command.commandId,
            reminder: {
              label: 'Reused evidence command',
              timing: 'ROUND_START',
              round: null,
              actorId: null,
              public: false,
              notes: null,
              order: 0
            }
          }
        })
      )
      expect(await records(base.t, run.id, base.campaign.id)).toEqual(beforeCollision)
    }
  }, 30000)

  it('lets a player resolve only an actor the GM granted them and binds its replay to that player', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const before = await records(base.t, base.run.id, base.campaign.id)
    const uncontrolled = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    expect(
      await rejection(executeInRoom(base.other.caller, { command: uncontrolled }))
    ).toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)
    const granted = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: base.actor.id,
        controllerUserIds: [base.other.userId]
      }
    })
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      expectedVersion: granted.projection.version
    })
    const result = await executeInRoom(base.other.caller, { command: input })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(result.projection.version).toBe(granted.projection.version + 1)
    const settled = await records(base.t, base.run.id, base.campaign.id)
    await expect(executeInRoom(base.other.caller, { command: input })).resolves.toEqual(result)
    await expectReusedCommandRefusal(executeInRoom(base.owner.caller, { command: input }))
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
  }, 30000)

  it('settles an allowed Creature action once, replays it exactly, and rejects stale or unauthorized commands', async () => {
    const base = await setup()
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    const before = await records(base.t, base.run.id, base.campaign.id)
    expect(
      await rejection(
        executeInRoom(base.owner.caller, {
          command: { ...input, target: { kind: 'ACTOR', actorId: base.actor.id } }
        })
      )
    ).toMatchObject({ reason: 'RULE_WARNINGS', warnings: [{ code: 'TARGET_DISPOSITION' }] })
    const result = await executeInRoom(base.owner.caller, {
      command: input
    })
    expect(result.projection.version).toBe(1)
    const settled = await records(base.t, base.run.id, base.campaign.id)
    expect(settled.run?.version).toBe(1)
    const target = settled.actors.find((actor) => actor.id === base.target.id)
    if (!target) throw new Error('Missing settled target.')
    expect(creatureActorState(target).currentHitPoints).toBeLessThan(100)
    expect(settled.occurrences).toHaveLength(before.occurrences.length + 1)
    // The room answers the retry from the receipt it holds for the command; a second commit
    // would move the version, so one committed command is the same fact the rows used to show.
    expect(await committedCount(base)).toBe(1)
    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...input, commandId: crypto.randomUUID() }
      })
    ).rejects.toMatchObject({ data: { reason: 'VERSION_STALE' } })
    await expect(
      executeInRoom(base.other.caller, {
        command: input
      })
    ).rejects.toThrow('Campaign not found.')
  }, 30000)

  it('settles and rolls back distance actions, then replays after movement', async () => {
    const base = await distanceSetup()
    const input = command({
      encounterId: base.run.id,
      expectedVersion: base.run.version,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      sceneContext: {
        sceneId: base.sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: base.tokens[0]!.id,
        targetTokenId: base.tokens[1]!.id
      }
    })
    const before = await records(base.t, base.run.id, base.campaign.id)
    // The attack d20 shows 15; every later die shows its highest face.
    await queueRoomRolls(base.campaign.id, { rolls: [14], repeat: 3 })
    let result: EncounterCommandResultDto
    try {
      expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)
      result = await executeInRoom(base.owner.caller, { command: input })
      // One card per rolled step, oldest first: the attack d20, then the damage it dealt.
      expect(
        (await readRoomRollCards(base.owner.caller, base.campaign.id)).map(
          (card) => card.source.kind
        )
      ).toEqual(['ATTACK', 'DAMAGE'])
    } finally {
      await queueRoomRolls(base.campaign.id, { rolls: [] })
    }
    const settled = await records(base.t, base.run.id, base.campaign.id)
    expect(settled.run?.version).toBe(base.run.version + 1)
    expect(await committedCount(base)).toBe(1)
    const target = creatureActorState(settled.actors.find((actor) => actor.id === base.target.id)!)
    expect(target.currentHitPoints).toBeLessThan(base.target.currentHitPoints)
    // The seeded Bite's second hit path knocks the target prone.
    expect(target.conditions).toEqual([
      {
        conditionTypeId: srdSystemRecord.conditionTypes.find(
          (condition) => condition.code === 'PRONE'
        )?.id
      }
    ])
    // The target moves out of range through the room, as the tabletop moves it.
    await moveTargetTokenInRoom(base, result.projection.version)
    await checkpointLiveRoom(base.campaign.id)
    // A Scene move does not change the Run, so the room answers the retry from its receipt as it was.
    await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
  }, 30000)

  it.each(['moved', 'removed'] as const)(
    'uses live target state instead of the in-range base token when %s',
    async (change) => {
      const base = await distanceSetup()
      await replaceTargetToken(base, change === 'moved' ? { x: 450, y: 450 } : null)
      const before = await records(base.t, base.run.id, base.campaign.id)
      const attempt = () =>
        executeInRoom(base.owner.caller, {
          command: command({
            encounterId: base.run.id,
            expectedVersion: base.run.version,
            actorId: base.actor.id,
            targetActorId: base.target.id,
            actionId: base.actionId,
            sceneContext: {
              sceneId: base.sceneId,
              expectedSceneVersion: 1,
              sourceTokenId: base.tokens[0]!.id,
              targetTokenId: base.tokens[1]!.id
            }
          })
        })
      // A live target out of range is an overridable warning; a missing token stays hard.
      if (change === 'moved')
        expect(await rejection(attempt())).toMatchObject({
          reason: 'RULE_WARNINGS',
          warnings: [{ code: 'TARGET_OUT_OF_RANGE' }]
        })
      else await expectUnavailableRefusal(attempt(), 'token')
      expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)
    },
    30000
  )

  // Each fault gets its own Campaign and room: one attached room serves one fixture at a time.
  it.each(['missing', 'mismatched', 'out-of-range', 'stale'] as const)(
    'rejects a bounded distance action before writes for %s Scene context',
    async (fault) => {
      const base = await distanceSetup()
      if (fault === 'out-of-range') await moveDefinitionTargetToken(base)
      const input = command({
        encounterId: base.run.id,
        expectedVersion: base.run.version,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        sceneContext: {
          sceneId: fault === 'missing' ? crypto.randomUUID() : base.sceneId,
          expectedSceneVersion: 0,
          sourceTokenId: base.tokens[fault === 'mismatched' ? 1 : 0]!.id,
          targetTokenId: base.tokens[fault === 'mismatched' ? 0 : 1]!.id
        }
      })
      if (fault === 'stale') await advanceSceneVersion(base.t, base.sceneId)
      const before = await records(base.t, base.run.id, base.campaign.id)
      // A target out of range is an overridable warning; the other faults are hard failures.
      if (fault === 'out-of-range')
        expect(await rejection(executeInRoom(base.owner.caller, { command: input }))).toMatchObject(
          { reason: 'RULE_WARNINGS', warnings: [{ code: 'TARGET_OUT_OF_RANGE' }] }
        )
      else
        await expectUnavailableRefusal(
          executeInRoom(base.owner.caller, { command: input }),
          distanceFaultCause[fault]
        )
      expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)
    },
    30000
  )

  it('pauses an Assisted distance action without mechanics and rejects changed Scene geometry', async () => {
    const base = await distanceSetup({
      phased: true,
      targetCreature: true,
      rolls: 'PROMPT'
    })
    const input = command({
      encounterId: base.run.id,
      expectedVersion: base.run.version,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      sceneContext: {
        sceneId: base.sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: base.tokens[0]!.id,
        targetTokenId: base.tokens[1]!.id
      }
    })
    const before = await records(base.t, base.run.id, base.campaign.id)
    const result = await executeInRoom(base.owner.caller, {
      command: input
    })
    expect(result.occurrence?.status).toBe('PENDING')
    const paused = await records(base.t, base.run.id, base.campaign.id)
    expect(paused.run).toEqual(before.run)
    expect(paused.actors).toEqual(before.actors)
    expect(await committedCount(base)).toBe(0)
    expect(paused.occurrences).toHaveLength(before.occurrences.length + 1)
    const pending = result.occurrence?.pending
    if (!pending || (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE'))
      throw new Error('Expected Assisted distance evidence.')
    // The Scene changes in Convex while the room holds nothing: the pending answer re-hydrates it.
    await closeRoom(base.campaign.id)
    await advanceSceneVersion(base.t, base.sceneId)
    await expectUnavailableRefusal(
      executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          correlationId: null,
          occurrenceId: result.occurrence!.occurrenceId,
          expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
          resolution:
            pending.kind === 'D20_EVIDENCE'
              ? {
                  kind: 'ENTER_DICE',
                  requestId: pending.request.requestId,
                  rawFaces: pending.request.rollMode === 'NORMAL' ? [15] : [15, 15],
                  rollMode: pending.request.rollMode
                }
              : {
                  kind: 'ENTER_INTEGER',
                  requestId: pending.request.requestId,
                  value: pending.request.max
                }
        }
      }),
      'Scene'
    )
    await closeRoom(base.campaign.id)
    const afterRejected = await records(base.t, base.run.id, base.campaign.id)
    expect(afterRejected.run).toEqual(before.run)
    expect(afterRejected.actors).toEqual(before.actors)
    expect(afterRejected.occurrences).toHaveLength(before.occurrences.length + 1)
  }, 30000)

  it('completes Assisted distance evidence atomically and replays every response once', async () => {
    const base = await distanceSetup({ rolls: 'PROMPT' })
    const input = command({
      encounterId: base.run.id,
      expectedVersion: base.run.version,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      sceneContext: {
        sceneId: base.sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: base.tokens[0]!.id,
        targetTokenId: base.tokens[1]!.id
      }
    })
    const before = await records(base.t, base.run.id, base.campaign.id)
    const issued = await executeInRoom(base.owner.caller, {
      command: input
    })
    let result = issued
    // Every d20 is a natural 20, so the critical hit rolls each damage die twice (D58).
    for (let step = 0; result.occurrence?.status === 'PENDING'; step++) {
      expect(step).toBeLessThan(6)
      const pending = result.occurrence.pending
      if (
        !pending ||
        (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      )
        throw new Error('Unexpected Assisted distance decision.')
      const retained = await records(base.t, base.run.id, base.campaign.id)
      expect(retained.run).toEqual(before.run)
      expect(retained.actors).toEqual(before.actors)
      expect(await committedCount(base)).toBe(0)
      const response: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        correlationId: null,
        occurrenceId: result.occurrence.occurrenceId,
        expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
        resolution:
          pending.kind === 'D20_EVIDENCE'
            ? {
                kind: 'ENTER_DICE',
                requestId: pending.request.requestId,
                rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
                rollMode: pending.request.rollMode
              }
            : {
                kind: 'ENTER_INTEGER',
                requestId: pending.request.requestId,
                value: pending.request.max
              }
      }
      if (pending.kind === 'ACTION_OUTCOME_EVIDENCE') {
        expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(retained)
      }
      result = await executeInRoom(base.owner.caller, {
        command: response
      })
      const after = await records(base.t, base.run.id, base.campaign.id)
      await expect(executeInRoom(base.owner.caller, { command: response })).resolves.toEqual(result)
      expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(after)
    }
    expect(result.occurrence?.status).toBe('COMPLETE')
    const settled = await records(base.t, base.run.id, base.campaign.id)
    expect(settled.run?.version).toBe(base.run.version + 1)
    expect(await committedCount(base)).toBe(1)
    // The root replays its own pending result over the settled projection.
    await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual({
      ...issued,
      projection: result.projection
    })
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
  }, 30000)

  it('refuses a completed phased action with an authorized nested forced movement before writes', async () => {
    const base = await setup({
      phased: true,
      nestedForced: true,
      targetCreature: true
    })
    const before = await records(base.t, base.run.id, base.campaign.id)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    await queueRoomRolls(base.campaign.id, { rolls: [14, 0, 0] })
    try {
      await expectUnavailableRefusal(
        executeInRoom(base.owner.caller, {
          command: input
        }),
        "A forced movement needs the source's and target's tokens on the Encounter's Scene."
      )
      // A refused action posts no roll card: the table chat was never opened.
      await expect(readRoomRollCards(base.owner.caller, base.campaign.id)).rejects.toThrow(
        'Conversation not found.'
      )
    } finally {
      await queueRoomRolls(base.campaign.id, { rolls: [] })
    }
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)
  }, 30000)

  it('commits phased TEST and OUTCOME receipts once, then replays the exact settled action', async () => {
    const base = await setup({
      charged: true,
      phased: true,
      targetCreature: true
    })
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    // The attack d20 shows 15; every later die shows its highest face.
    await queueRoomRolls(base.campaign.id, { rolls: [14], repeat: 5 })
    let result: EncounterCommandResultDto
    try {
      result = await executeInRoom(base.owner.caller, {
        command: input
      })
    } finally {
      await queueRoomRolls(base.campaign.id, { rolls: [] })
    }
    // One card per rolled step, oldest first: the attack d20, then the damage it dealt.
    expect(
      (await readRoomRollCards(base.owner.caller, base.campaign.id)).map((card) => card.source.kind)
    ).toEqual(['ATTACK', 'DAMAGE'])

    expect(result.projection.version).toBe(1)
    const settled = await records(base.t, base.run.id, base.campaign.id)
    const source = settled.actors.find((actor) => actor.id === base.actor.id)
    const target = settled.actors.find((actor) => actor.id === base.target.id)
    if (!source || !target) throw new Error('Missing phased native action settlement.')
    const sourceState = readStoredRunActor(source)
    const targetState = creatureActorState(target)
    const featureId = nativeCreature(true, false, false, true).features?.find(
      (feature) => feature.label === 'Bite'
    )?.id
    if (!featureId) throw new Error('Missing phased native action feature.')
    expect(targetState.currentHitPoints).toBe(10)
    expect(featureChargeUsed(sourceState, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(sourceState, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)

    // The TEST and OUTCOME phase receipts and the ON_HIT path are held by the room with the
    // command's receipt (D85), and no member read shows them. Their producer is covered at
    // packages/rules-runtime/src/__tests__/encounterActionExecution.test.ts:369-394 (a hit TEST then
    // OUTCOME with sealed receipts, ON_HIT path).

    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    const replayed = await records(base.t, base.run.id, base.campaign.id)
    expect(replayed).toEqual(settled)
    expect(replayed.run?.version).toBe(1)
  }, 30000)

  it('settles a self action on the source actor once', async () => {
    const base = await setup({ self: true, charged: true })
    const before = await records(base.t, base.run.id, base.campaign.id)
    const sourceBefore = before.actors.find((actor) => actor.id === base.actor.id)
    if (!sourceBefore) throw new Error('Missing self-action source actor.')
    const initial = creatureActorState(sourceBefore)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.actor.id,
      actionId: base.actionId
    })
    const acted = await executeInRoom(base.owner.caller, {
      command: input
    })
    const after = await records(base.t, base.run.id, base.campaign.id)
    const sourceAfter = after.actors.find((actor) => actor.id === base.actor.id)
    if (!sourceAfter) throw new Error('Missing settled self-action source actor.')
    const settled = creatureActorState(sourceAfter)
    expect(settled.currentHitPoints).toBe(initial.currentHitPoints - 1)
    const featureId = nativeCreature(true, true).features?.find(
      (feature) => feature.label === 'Bite'
    )?.id
    if (!featureId) throw new Error('Missing self-action feature.')
    expect(featureChargeUsed(settled, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(settled, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)

    // Command rows and rule receipts stay in the room for the Run (D85, D88); Convex holds one
    // replay-index row per room command. The checkpointed row proves the room committed this
    // command under the caller's identity and input fingerprint at the resulting version.
    await checkpointLiveRoom(base.campaign.id)
    const replayIndex = await base.t.run((ctx) =>
      ctx.db
        .query('encounterReplayIndex')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
    const indexed = replayIndex.filter(({ commandId }) => commandId === input.commandId)
    expect(indexed).toHaveLength(1)
    expect(indexed[0]).toMatchObject({
      encounterId: base.run.id,
      actorUserId: base.owner.userId,
      commandFingerprint: checksumCanonicalJson({ command: input, scope: 'ENCOUNTER' }),
      version: acted.projection.version
    })
  }, 30000)

  it('settles a charged Feature once and warns before using an exhausted source', async () => {
    const base = await setup({ charged: true })
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    const result = await executeInRoom(base.owner.caller, {
      command: input
    })
    const source = await sourceActorState(base)
    const featureId = nativeCreature(true).features?.find((feature) => feature.label === 'Bite')?.id
    if (!featureId) throw new Error('Missing charged Feature fixture.')
    expect(featureChargeUsed(source, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(source, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    // The exhausted source is written straight into Convex, so the room lets go of its copy first.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing charged source actor.')
      const actor = await readTestActor(ctx, row)
      const exhausted = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(
          { ...actor, resources: withFeatureChargeUsed(actor, featureId, 1) },
          SRD_ACTION_ALLOWANCE_DEFINITION_ID,
          0
        )
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, exhausted)
    })
    const exhausted = await rejection(
      executeInRoom(base.owner.caller, {
        command: { ...input, commandId: crypto.randomUUID(), expectedVersion: 1 }
      })
    )
    expect(exhausted).toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [
        { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough charges left: needs 1, has 0.' }
      ]
    })
  }, 30000)
  it.each(['AUTO_ROLL', 'PROMPT'] as const)(
    'creates one recurring condition effect atomically and replays its typed receipt (%s)',
    async (rolls) => {
      const base = await setup({ self: true, recurring: true, condition: true, rolls })
      const input = command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.actor.id,
        actionId: base.actionId
      })
      const result = await executeInRoom(base.owner.caller, {
        command: input
      })
      expect(result.occurrence?.status).toBe('COMPLETE')
      expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(1)
      // The receipt's one active-effect transition is the effect row above: the undo test below
      // ("deletes the effect an action created") deletes exactly that row from the receipt alone.
      await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
      expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(1)
    },
    30000
  )

  it.each([
    { face: 1, effects: 1, label: 'failed save' },
    { face: 20, effects: 0, label: 'successful save' }
  ])(
    'settles repeated-save condition effects only on $label',
    async ({ face, effects }) => {
      const base = await setup({
        directRepeatSave: true,
        targetCreature: true,
        rolls: 'PROMPT'
      })
      const input = command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId
      })
      const pending = await executeInRoom(base.owner.caller, {
        command: input
      })
      expect(pending.occurrence?.status).toBe('PENDING')
      expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(0)
      const request = pending.occurrence?.pending
      if (!pending.occurrence || !request || request.kind !== 'D20_EVIDENCE')
        throw new Error('Expected initial save evidence.')
      const response: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        correlationId: null,
        occurrenceId: pending.occurrence.occurrenceId,
        expectedOccurrenceVersion: pending.occurrence.occurrenceVersion,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: request.request.requestId,
          rawFaces: request.request.rollMode === 'NORMAL' ? [face] : [face, face],
          rollMode: request.request.rollMode
        }
      }
      const result = await executeInRoom(base.owner.caller, {
        command: response
      })
      expect(result.occurrence?.status).toBe('COMPLETE')
      expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(
        effects
      )
      await expect(executeInRoom(base.owner.caller, { command: response })).resolves.toEqual(result)
      expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(
        effects
      )
    },
    30000
  )

  it('prompts a Paralyzed target's Dexterity save with the condition that fails it, and fails it on a natural 20 (D94)', async () => {
    const base = await setup({
      directRepeatSave: true,
      targetCreature: true,
      rolls: 'PROMPT'
    })
    const paralyzed = srdSystemRecord.conditionTypes.find((value) => value.code === 'PARALYZED')
    if (!paralyzed) throw new Error('Missing Paralyzed condition fixture.')
    const conditioned = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        actorId: base.target.id,
        conditions: [paralyzed.id]
      }
    })
    const pending = await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        expectedVersion: conditioned.projection.version,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId
      })
    })
    const request = pending.occurrence?.pending
    if (!pending.occurrence || !request || request.kind !== 'D20_EVIDENCE')
      throw new Error('Expected initial save evidence.')
    expect(request.request.autoFail).toEqual([
      { conditionId: paralyzed.id, label: 'Paralyzed' }
    ])
    // A natural 20 passes a DC 10 save, but Paralyzed fails it: the failure's Frightened lands.
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: conditioned.projection.version,
        correlationId: null,
        occurrenceId: pending.occurrence.occurrenceId,
        expectedOccurrenceVersion: pending.occurrence.occurrenceVersion,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: request.request.requestId,
          rawFaces: request.request.rollMode === 'NORMAL' ? [20] : [20, 20],
          rollMode: request.request.rollMode
        }
      }
    })
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(1)
  }, 30000)

  it('refuses a failed repeated-save condition against an immune Creature target', async () => {
    const base = await setup({
      directRepeatSave: true,
      targetCreature: true,
      conditionImmune: true,
      rolls: 'PROMPT'
    })
    const frightened = srdSystemRecord.conditionTypes.find((value) => value.code === 'FRIGHTENED')
    if (!frightened) throw new Error('Missing frightened condition fixture.')
    const conditionImmunityIds = await base.owner.caller.run(async (ctx) => {
      const targets = await readMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [base.target.id]
      })
      return targets.get(base.target.id)?.conditionImmunityIds ?? []
    })
    expect(conditionImmunityIds).toContain(frightened.id)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    const pending = await executeInRoom(base.owner.caller, {
      command: input
    })
    const request = pending.occurrence?.pending
    if (!pending.occurrence || !request || request.kind !== 'D20_EVIDENCE')
      throw new Error('Expected initial save evidence.')
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        correlationId: null,
        occurrenceId: pending.occurrence.occurrenceId,
        expectedOccurrenceVersion: pending.occurrence.occurrenceVersion,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: request.request.requestId,
          rawFaces: request.request.rollMode === 'NORMAL' ? [1] : [1, 1],
          rollMode: request.request.rollMode
        }
      }
    })
    expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(0)
  }, 30000)
})

async function sourceActorState(base: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
    if (!row) throw new Error('Missing source actor.')
    return await readTestActor(ctx, row)
  })
}

function actorsWithoutCounters(value: Awaited<ReturnType<typeof records>>) {
  return value.actors.map((row) => {
    const { resources: _resources, ...actor } = readStoredRunActor(row)
    return actor
  })
}

function revert(
  base: Awaited<ReturnType<typeof setup>>,
  expectedVersion: number,
  caller = base.owner.caller
) {
  return executeInRoom(caller, {
    command: {
      type: 'REVERT_LAST_ACTION',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion
    }
  })
}

describe('Assisted soft enforcement', () => {
  it('warns on an exhausted allowance and charge, refuses a partial acknowledgement, then records the override without going negative', async () => {
    const base = await setup({ charged: true })
    const featureId = nativeCreature(true).features!.find((feature) => feature.label === 'Bite')!.id
    const first = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    await executeInRoom(base.owner.caller, { command: first })
    const again = (acknowledgedWarnings: EncounterRuleWarningCodeDto[]) =>
      executeInRoom(base.owner.caller, {
        command: {
          ...first,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          acknowledgedWarnings
        }
      })
    const before = await records(base.t, base.run.id, base.campaign.id)
    expect(await rejection(again([]))).toEqual({
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: 'This action breaks a rule. Do it anyway?',
      warnings: [
        { code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No action left this turn.' },
        { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough charges left: needs 1, has 0.' }
      ]
    })
    // A warning the acknowledgement does not cover still refuses the command.
    expect(await rejection(again(['ACTION_ECONOMY_UNAVAILABLE']))).toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [{ code: 'ACTION_ECONOMY_UNAVAILABLE' }, { code: 'RESOURCE_UNAVAILABLE' }]
    })
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)

    const result = await again(['ACTION_ECONOMY_UNAVAILABLE', 'RESOURCE_UNAVAILABLE'])
    expect(result.projection.version).toBe(2)
    const source = await sourceActorState(base)
    // Charges stop at their maximum; the allowance records the over-use.
    expect(featureChargeUsed(source, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(source, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(2)
    const timeline = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(timeline.find((entry) => entry.version === 2)).toMatchObject({
      commandType: 'RESOLVE_ACTION'
    })
    expect(
      timeline.find((entry) => entry.version === 2)?.ruleOverrides.map((warning) => warning.code)
    ).toEqual(['ACTION_ECONOMY_UNAVAILABLE', 'RESOURCE_UNAVAILABLE'])
    // The receipt records the over-use (allowance 1 -> 2, no charge spent) so the undo restores it
    // exactly: undoing the override returns the allowance to 1 and leaves the spent charge alone.
    await revert(base, 2)
    const undone = await sourceActorState(base)
    expect(encounterRuleUsageUsed(undone, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    expect(featureChargeUsed(undone, featureId)).toBe(1)
  }, 30000)

  it('treats range and target disposition as overridable warnings', async () => {
    const base = await distanceSetup()
    await replaceTargetToken(base, { x: 450, y: 450 })
    const outOfRange = command({
      encounterId: base.run.id,
      expectedVersion: base.run.version,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      sceneContext: {
        sceneId: base.sceneId,
        expectedSceneVersion: 1,
        sourceTokenId: base.tokens[0]!.id,
        targetTokenId: base.tokens[1]!.id
      }
    })
    expect(
      await rejection(executeInRoom(base.owner.caller, { command: outOfRange }))
    ).toMatchObject({ warnings: [{ code: 'TARGET_OUT_OF_RANGE' }] })
    expect(
      await rejection(
        executeInRoom(base.owner.caller, {
          command: { ...outOfRange, commandId: crypto.randomUUID(), sceneContext: null }
        })
      )
    ).toMatchObject({ warnings: [{ code: 'TARGET_RANGE_UNCHECKED' }] })
    expect(
      await rejection(
        executeInRoom(base.owner.caller, {
          command: {
            ...outOfRange,
            commandId: crypto.randomUUID(),
            target: { kind: 'ACTOR', actorId: base.actor.id },
            sceneContext: null
          }
        })
      )
    ).toMatchObject({
      warnings: [{ code: 'TARGET_DISPOSITION' }, { code: 'TARGET_RANGE_UNCHECKED' }]
    })
    const result = await executeInRoom(base.owner.caller, {
      command: { ...outOfRange, acknowledgedWarnings: ['TARGET_OUT_OF_RANGE'] }
    })
    expect(result.projection.version).toBe(base.run.version + 1)
  }, 30000)

  it('rolls a ranged attack beyond its normal range with disadvantage for "Long range" (D62)', async () => {
    // The seeded Ape's Rock: range 25/50 ft. The target stands 7 squares (35 ft.) away.
    const base = await distanceSetup({ ranged: true, rolls: 'PROMPT' })
    await replaceTargetToken(base, { x: 750, y: 50 })
    const sceneContext = {
      sceneId: base.sceneId,
      expectedSceneVersion: 1,
      sourceTokenId: base.tokens[0]!.id,
      targetTokenId: base.tokens[1]!.id
    }
    const input = command({
      encounterId: base.run.id,
      expectedVersion: base.run.version,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      sceneContext
    })
    const result = await executeInRoom(base.owner.caller, { command: input })
    expect(result.occurrence).toMatchObject({
      status: 'PENDING',
      pending: { kind: 'D20_EVIDENCE', request: { rollMode: 'DISADVANTAGE' } }
    })
    // Assisted names the reason, like any other derived roll mode.
    expect(await pendingFor(base, base.owner.caller)).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'DISADVANTAGE', derivedRollModeReasons: ['Long range'] }
    })
  }, 60000)

  it('a player-driven Bite by an Invisible attacker on a Scene rolls with advantage, named "Unseen attacker"', async () => {
    // The seeded Wolf lists no authored Senses, so its sight is definitive.
    const base = await distanceSetup({ rolls: 'PROMPT' })
    const invisible = srdSystemRecord.conditionTypes.find((value) => value.code === 'INVISIBLE')
    if (!invisible) throw new Error('Missing Invisible condition fixture.')
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    await setAutoRollDice(base.t, base.other.userId, false)
    // The player's map does not draw the target through fog, so the GM reveals it (ATTACK-17.3).
    const revealed = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        actorId: base.target.id,
        reveal: 'NAMED'
      }
    })
    const conditioned = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: revealed.projection.version,
        actorId: base.actor.id,
        conditions: [invisible.id]
      }
    })
    const granted = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: conditioned.projection.version,
        actorId: base.actor.id,
        controllerUserIds: [base.other.userId]
      }
    })
    const issued = await executeInRoom(base.other.caller, {
      command: command({
        encounterId: base.run.id,
        expectedVersion: granted.projection.version,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        sceneContext: {
          sceneId: base.sceneId,
          expectedSceneVersion: 0,
          sourceTokenId: base.tokens[0]!.id,
          targetTokenId: base.tokens[1]!.id
        }
      })
    })
    expect(issued.occurrence?.pending).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'ADVANTAGE' }
    })
    expect(await pendingFor(base, base.owner.caller)).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Unseen attacker'] }
    })
  }, 60000)

  it('a player rolls the believed mode against a Blinded target; the server holds the die, settles the true Advantage, and cards it for the table and the GM (ATTACK-10.1)', async () => {
    const base = await distanceSetup({ rolls: 'PROMPT' })
    const blinded = srdSystemRecord.conditionTypes.find((value) => value.code === 'BLINDED')
    if (!blinded) throw new Error('Missing Blinded condition fixture.')
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    await setAutoRollDice(base.t, base.other.userId, false)
    // The player's map does not draw the target through fog, so the GM reveals it (ATTACK-17.3).
    const revealed = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        actorId: base.target.id,
        reveal: 'NAMED'
      }
    })
    const conditioned = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: revealed.projection.version,
        actorId: base.target.id,
        conditions: [blinded.id]
      }
    })
    const granted = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: conditioned.projection.version,
        actorId: base.actor.id,
        controllerUserIds: [base.other.userId]
      }
    })
    const issued = await executeInRoom(base.other.caller, {
      command: command({
        encounterId: base.run.id,
        expectedVersion: granted.projection.version,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        sceneContext: {
          sceneId: base.sceneId,
          expectedSceneVersion: 0,
          sourceTokenId: base.tokens[0]!.id,
          targetTokenId: base.tokens[1]!.id
        }
      })
    })
    const prompt = issued.occurrence?.pending
    if (!issued.occurrence || prompt?.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the attack roll prompt.')
    // The player is shown what their own facts imply; the GM is shown the truth.
    expect(prompt.request).toMatchObject({ rollMode: 'NORMAL', derivedRollModeReasons: [] })
    expect(await pendingFor(base, base.other.caller)).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'NORMAL', derivedRollModeReasons: [] }
    })
    expect(await pendingFor(base, base.owner.caller)).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Unseen attacker'] }
    })

    const answer = (
      pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
      resolution: ResolveRuleOccurrenceInputDto['resolution']
    ) =>
      executeInRoom(base.other.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: pending.encounterVersion,
          correlationId: null,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          resolution
        }
      })
    // One Normal die is not enough for the true Advantage: the die is held and one more is asked.
    const held = await answer(prompt, {
      kind: 'ENTER_DICE',
      requestId: prompt.request.requestId,
      rawFaces: [9],
      rollMode: 'NORMAL'
    })
    const heldPending = held.occurrence?.pending
    if (heldPending?.kind !== 'D20_EVIDENCE') throw new Error('Expected the held d20.')
    expect(heldPending.request).toMatchObject({
      requestId: prompt.request.requestId,
      rollMode: 'NORMAL',
      heldD20: { faces: [9], caption: "Advantage: the target can't see you" }
    })
    expect(heldPending.occurrenceVersion).toBe(prompt.occurrenceVersion + 1)
    const gmHeld = await pendingFor(base, base.owner.caller)
    if (gmHeld?.kind !== 'D20_EVIDENCE') throw new Error('Expected the GM to see the held d20.')
    const gmReason = gmHeld.request.heldD20?.caption
    expect(gmReason).toEqual(expect.stringContaining("can't see"))
    expect(gmReason).not.toBe(heldPending.request.heldD20?.caption)
    expect(JSON.stringify(heldPending)).not.toContain(gmReason!)

    let step = await answer(heldPending, {
      kind: 'ENTER_DICE',
      requestId: prompt.request.requestId,
      rawFaces: [15],
      rollMode: 'NORMAL'
    })
    for (let pending = step.occurrence?.pending; pending?.kind === 'ACTION_OUTCOME_EVIDENCE';) {
      step = await answer(pending, {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: 1
      })
      pending = step.occurrence?.pending
    }
    expect(step.occurrence?.status).toBe('COMPLETE')

    await checkpointLiveRoom(base.campaign.id)
    const cards = await base.t.run(async (ctx) => ({
      table: (await ctx.db.query('campaignConversationEntryPayloads').collect()).flatMap(
        (payload) => (payload.roll?.ruleCheck?.kind === 'D20_MODE_ADJUSTED' ? [payload.roll] : [])
      ),
      gm: (
        await ctx.db
          .query('userRollHistory')
          .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', base.owner.userId))
          .collect()
      ).filter((roll) => roll.ruleCheck?.kind === 'D20_MODE_ADJUSTED')
    }))
    expect(cards.table).toHaveLength(1)
    const [table] = cards.table
    expect(table!.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      keep: 'HIGHER',
      terms: [{ rolls: [9, 15], keptRollIndex: 1 }]
    })
    expect(table!.ruleCheck).toEqual({
      kind: 'D20_MODE_ADJUSTED',
      rolledMode: { code: 'NORMAL', label: 'Normal' },
      appliedMode: { code: 'ADVANTAGE', label: 'Advantage' },
      cancelledRollIndexes: [],
      addedRollIndexes: [1],
      caption: "Advantage: the target can't see you"
    })
    expect(cards.gm).toHaveLength(1)
    const [gm] = cards.gm
    expect(gm!.id).not.toBe(table!.id)
    expect(gm!.evidence).toEqual(table!.evidence)
    expect(gm!.ruleCheck).toMatchObject({ kind: 'D20_MODE_ADJUSTED', caption: gmReason })
    expect(gm!.gmCampaignRoll?.revealedAt).toEqual(expect.any(String))
    expect(JSON.stringify(table)).not.toContain(gmReason!)
  }, 90000)

  it("shows a player the modifiers their Character believes, which are the roll prompt's own, never the true mode (ATTACK-17.1, ATTACK-10.1)", async () => {
    const base = await distanceSetup({ rolls: 'PROMPT' })
    const version = await seatPlayerControllingActor(base, { reveal: true })
    const scene = { sceneId: base.sceneId, expectedSceneVersion: 0 }
    const read = await targetModifiersFor(base, base.other.caller, version, scene)
    // The Blinded target makes the true roll Advantage ("Unseen attacker"); the player believes Normal.
    expect(read.targets).toEqual([
      {
        actorId: base.target.id,
        attack: { rollMode: 'NORMAL', rollModeLabel: 'Normal', keep: 'FIRST', reasons: [] }
      }
    ])
    const issued = await executeInRoom(base.other.caller, {
      command: command({
        encounterId: base.run.id,
        expectedVersion: version,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        sceneContext: {
          ...scene,
          sourceTokenId: base.tokens[0]!.id,
          targetTokenId: base.tokens[1]!.id
        }
      })
    })
    expect(issued.occurrence?.pending).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: {
        rollMode: read.targets[0]!.attack!.rollMode,
        derivedRollModeReasons: read.targets[0]!.attack!.reasons
      }
    })
  }, 60000)

  it('lists no creature a player cannot see and answers the same from Convex once the room lets go (ATTACK-17.3)', async () => {
    const base = await distanceSetup({ rolls: 'PROMPT' })
    const version = await seatPlayerControllingActor(base, { reveal: false })
    const scene = { sceneId: base.sceneId, expectedSceneVersion: 0 }
    // The player's map does not draw the target, so it is not theirs to read about.
    expect((await targetModifiersFor(base, base.other.caller, version, scene)).targets).toEqual([])
    const revealed = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version,
        actorId: base.target.id,
        reveal: 'NAMED'
      }
    })
    const held = await targetModifiersFor(
      base,
      base.other.caller,
      revealed.projection.version,
      scene
    )
    expect(held.targets.map(({ actorId }) => actorId)).toEqual([base.target.id])
    await closeRoom(base.campaign.id)
    expect(
      await base.other.caller.query(api.encounters.actionTargetModifiers.get, {
        encounterId: base.run.id,
        expectedVersion: revealed.projection.version,
        actorId: base.actor.id,
        actionId: base.actionId,
        scene
      })
    ).toEqual(held)
  }, 60000)

  it('reads a ranged attack beyond its normal range as Disadvantage for "Long range", and not without a Scene (ATTACK-17.1, D62)', async () => {
    // The seeded Ape's Rock: range 25/50 ft. The target stands 7 squares (35 ft.) away.
    const base = await distanceSetup({ ranged: true, rolls: 'PROMPT' })
    await replaceTargetToken(base, { x: 750, y: 50 })
    const onScene = await targetModifiersFor(base, base.owner.caller, base.run.version, {
      sceneId: base.sceneId,
      expectedSceneVersion: 1
    })
    // The Encounter's custom creature has no defense to attack, so it lists with no modifiers.
    const custom = base.run.actors.find((candidate) => candidate.kind === 'CUSTOM')
    if (!custom) throw new Error('Missing custom creature fixture.')
    expect(onScene.targets).toHaveLength(2)
    expect(onScene.targets).toContainEqual({
      actorId: base.target.id,
      attack: {
        rollMode: 'DISADVANTAGE',
        rollModeLabel: 'Disadvantage',
        keep: 'LOWER',
        reasons: ['Long range']
      }
    })
    expect(onScene.targets).toContainEqual({ actorId: custom.id, attack: null })
    const offScene = await targetModifiersFor(base, base.owner.caller, base.run.version, null)
    expect(offScene.targets).toHaveLength(2)
    expect(offScene.targets).toContainEqual({
      actorId: base.target.id,
      attack: { rollMode: 'NORMAL', rollModeLabel: 'Normal', keep: 'FIRST', reasons: [] }
    })
    expect(offScene.targets).toContainEqual({ actorId: custom.id, attack: null })
    await expect(
      targetModifiersFor(base, base.owner.caller, base.run.version, {
        sceneId: base.sceneId,
        expectedSceneVersion: 0
      })
    ).rejects.toThrow()
  }, 60000)

  it('a Paralyzed target makes an adjacent Bite roll with advantage and hit critically (D94)', async () => {
    // The seeded Wolf's Bite (+4, 2d4 + 2) at the adjacent seeded Wolf (AC 13).
    const base = await distanceSetup({ rolls: 'PROMPT' })
    const paralyzed = srdSystemRecord.conditionTypes.find((value) => value.code === 'PARALYZED')
    if (!paralyzed) throw new Error('Missing Paralyzed condition fixture.')
    const conditioned = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        actorId: base.target.id,
        conditions: [paralyzed.id]
      }
    })
    const version = conditioned.projection.version
    const issued = await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        expectedVersion: version,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        sceneContext: {
          sceneId: base.sceneId,
          expectedSceneVersion: 0,
          sourceTokenId: base.tokens[0]!.id,
          targetTokenId: base.tokens[1]!.id
        }
      })
    })
    const attack = issued.occurrence?.pending
    if (!issued.occurrence || attack?.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the attack roll prompt.')
    expect(attack.request.rollMode).toBe('ADVANTAGE')
    expect(await pendingFor(base, base.owner.caller)).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Paralyzed'] }
    })
    // A natural 10 + 4 = 14 hits AC 13; within 5 feet of the Paralyzed Wolf the hit is critical,
    // so the Bite asks for 4d4 instead of 2d4: one d4 prompt per die.
    let step = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version,
        correlationId: null,
        occurrenceId: issued.occurrence.occurrenceId,
        expectedOccurrenceVersion: issued.occurrence.occurrenceVersion,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: attack.request.requestId,
          rawFaces: [10, 10],
          rollMode: 'ADVANTAGE'
        }
      }
    })
    const damageDice: { min: number; max: number }[] = []
    for (let pending = step.occurrence?.pending; pending?.kind === 'ACTION_OUTCOME_EVIDENCE';) {
      damageDice.push({ min: pending.request.min, max: pending.request.max })
      step = await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: pending.encounterVersion,
          correlationId: null,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          resolution: { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 1 }
        }
      })
      pending = step.occurrence?.pending
    }
    expect(damageDice).toEqual(Array.from({ length: 4 }, () => ({ min: 1, max: 4 })))
  }, 60000)

  it('only warns for a ranged attack beyond its long range (D11)', async () => {
    // The seeded Ape's Rock: range 25/50 ft. The target stands 13 squares (65 ft.) away.
    const far = await distanceSetup({ ranged: true, rolls: 'PROMPT' })
    await replaceTargetToken(far, { x: 1350, y: 50 })
    expect(
      await rejection(
        executeInRoom(far.owner.caller, {
          command: command({
            encounterId: far.run.id,
            expectedVersion: far.run.version,
            actorId: far.actor.id,
            targetActorId: far.target.id,
            actionId: far.actionId,
            sceneContext: {
              sceneId: far.sceneId,
              expectedSceneVersion: 1,
              sourceTokenId: far.tokens[0]!.id,
              targetTokenId: far.tokens[1]!.id
            }
          })
        })
      )
    ).toMatchObject({ warnings: [{ code: 'TARGET_OUT_OF_RANGE' }] })
  }, 60000)

  it('never overrides hard checks', async () => {
    const base = await setup({ targetCreature: true })
    const input = {
      ...command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId
      }),
      acknowledgedWarnings: [
        'ACTION_ECONOMY_UNAVAILABLE',
        'RESOURCE_UNAVAILABLE',
        'SOURCE_NOT_EQUIPPED',
        'TARGET_DISPOSITION',
        'TARGET_OUT_OF_RANGE',
        'TARGET_RANGE_UNCHECKED'
      ] satisfies EncounterRuleWarningCodeDto[]
    }
    const before = await records(base.t, base.run.id, base.campaign.id)
    const refuse = async (changed: typeof input) =>
      (await rejection(executeInRoom(base.owner.caller, { command: changed }))).reason
    expect(
      await refuse({
        ...input,
        actorId: base.target.id,
        target: { kind: 'ACTOR', actorId: base.actor.id }
      })
    ).toBe('NOT_CURRENT_ACTOR')
    expect(await refuse({ ...input, expectedVersion: 7 })).toBe('VERSION_STALE')
    await expect(executeInRoom(base.other.caller, { command: input })).rejects.toThrow(
      'Campaign not found.'
    )
    await expectUnavailableRefusal(
      executeInRoom(base.owner.caller, {
        command: { ...input, target: { kind: 'ACTOR', actorId: crypto.randomUUID() } }
      }),
      'actor'
    )
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(before)
  }, 30000)
})

describe('GM undo of the last action', () => {
  it('restores Creature hit points, charges and the action allowance exactly, once', async () => {
    const base = await setup({ charged: true, targetCreature: true })
    const featureId = nativeCreature(true).features!.find((feature) => feature.label === 'Bite')!.id
    const before = await records(base.t, base.run.id, base.campaign.id)
    const action = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    await executeInRoom(base.owner.caller, { command: action })
    const settled = await records(base.t, base.run.id, base.campaign.id)
    const targetState = (value: Awaited<ReturnType<typeof records>>) =>
      creatureActorState(value.actors.find((actor) => actor.id === base.target.id)!)
    expect(targetState(settled).currentHitPoints).toBeLessThan(targetState(before).currentHitPoints)

    await expect(revert(base, 1, base.other.caller)).rejects.toThrow('Campaign not found.')
    const undone = await revert(base, 1)
    expect(undone.projection.version).toBe(2)
    const after = await records(base.t, base.run.id, base.campaign.id)
    // Counters return to their values; an unused counter may be stored as 0 rather than absent.
    expect(actorsWithoutCounters(after)).toEqual(actorsWithoutCounters(before))
    const source = await sourceActorState(base)
    expect(featureChargeUsed(source, featureId)).toBe(0)
    expect(encounterRuleUsageUsed(source, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
    const timeline = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(timeline[0]).toMatchObject({ commandType: 'REVERT_LAST_ACTION', version: 2 })
    // The reverting receipt's `revertedCommandId` is asserted against the room's receipt rows in
    // `apps/session-worker/test/nativeRoomActionReceipts.test.ts:342-346`.
    expect(await rejection(revert(base, 2))).toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: 'The last action was already undone.'
    })
  }, 30000)

  it('keeps the Attack action an attack opened with the settled Run, and removes it on undo', async () => {
    const base = await setup({ phased: true, targetCreature: true })
    await queueRoomRolls(base.campaign.id, { rolls: [14], repeat: 5 })
    try {
      await executeInRoom(base.owner.caller, {
        command: command({
          encounterId: base.run.id,
          actorId: base.actor.id,
          targetActorId: base.target.id,
          actionId: base.actionId
        })
      })
    } finally {
      await queueRoomRolls(base.campaign.id, { rolls: [] })
    }
    // A Creature attacks once per Attack action: the one Bite fills it.
    expect(encounterAttackActionState(await sourceActorState(base))).toMatchObject({
      kind: 'ATTACK_ACTION',
      alternatives: [{ slots: [{ count: 1, fillers: [{ kind: 'ANY_ATTACK' }] }] }],
      attacks: [{ actionId: base.actionId, attack: true, targetIds: [base.target.id] }]
    })
    await revert(base, 1)
    expect(encounterAttackActionState(await sourceActorState(base))).toBeNull()
  }, 30000)

  it('deletes the effect an action created and restores its conditions', async () => {
    const base = await setup({ self: true, recurring: true, condition: true })
    const before = await records(base.t, base.run.id, base.campaign.id)
    await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.actor.id,
        actionId: base.actionId
      })
    })
    expect((await records(base.t, base.run.id, base.campaign.id)).activeEffects).toHaveLength(1)
    await revert(base, 1)
    const after = await records(base.t, base.run.id, base.campaign.id)
    expect(after.activeEffects).toEqual([])
    expect(actorsWithoutCounters(after)).toEqual(actorsWithoutCounters(before))
    expect(
      encounterRuleUsageUsed(await sourceActorState(base), SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(0)
  }, 30000)

  it('refuses after a later Encounter command changed the Run', async () => {
    const base = await setup({ targetCreature: true })
    await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId
      })
    })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_ROUND',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        round: 2
      }
    })
    const settled = await records(base.t, base.run.id, base.campaign.id)
    expect(await rejection(revert(base, 2))).toMatchObject({ reason: 'REVERT_UNAVAILABLE' })
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
  }, 30000)

  it('refuses after the turn advanced, so a turn commit that ended grants needs no undo receipt', async () => {
    const base = await setup({ targetCreature: true })
    await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId
      })
    })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    const settled = await records(base.t, base.run.id, base.campaign.id)
    expect(await rejection(revert(base, 2))).toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: expect.stringContaining('Only an action can be undone')
    })
    expect(await records(base.t, base.run.id, base.campaign.id)).toEqual(settled)
  }, 30000)
})
