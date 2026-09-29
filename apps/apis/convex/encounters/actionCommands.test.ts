import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { describe, expect, it, vi } from 'vitest'
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
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
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
import { DND5E_TARGET_STATE_CHECKSUM_FACT_KEY } from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import {
  encounterRuleUsageUsed,
  featureChargeUsed,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { seededSrdCreature, srdWolf } from '../../tests/fixtures/srdCreatures'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import { loadMovementTargets } from './movementTargets'
import { executeInRoom, replayInRoom } from '../../tests/fixtures/liveSessionWorker'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'

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
  ...wolf,
  features: wolf.features?.map((feature) =>
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
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
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
    features: creature.features?.map((feature) =>
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
                                      distanceMode: 'FIXED_DISTANCE' as const,
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
  uppercaseTokens = false,
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
  uppercaseTokens?: boolean
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
  await base.t.mutation(internal.content.import.importSubjects, {
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
      actor: encounterRunActorStateSchema.parse(JSON.parse(row.stateJson)),
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
      id: uppercaseTokens ? crypto.randomUUID().toUpperCase() : crypto.randomUUID(),
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      label: index === 0 ? 'Source token' : 'Target token',
      locked: false,
      position: { x: index * 100, y: 0 },
      rotationDegrees: 0,
      vision: null,
      width: 1
    }))
    await base.t.run(async (ctx) => {
      const settings = {
        campaignId: campaign.id,
        name: 'Distance action Scene',
        ambientIllumination: 'BRIGHT' as const,
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
          ambientIllumination: { value: 'BRIGHT', version: 0 },
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

function command(
  input: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'actionId'> & {
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
    targetActorId: input.targetActorId,
    actionId: input.actionId,
    optionalCombatIntent: null,
    sceneContext: input.sceneContext ?? null
  }
}

function creatureActorState(stateJson: string) {
  const actor = encounterRunActorStateSchema.parse(JSON.parse(stateJson))
  if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character actor.')
  return actor
}

async function records(t: Awaited<ReturnType<typeof fixture>>['t'], encounterId: string) {
  return t.run(async (ctx) => ({
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
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    activeEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', encounterId)
      )
      .collect()
  }))
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
    const before = await records(base.t, base.run.id)
    let result = await executeInRoom(base.owner.caller, {
      command: input
    })
    expect(result.occurrence?.status).toBe('PENDING')
    await expect(
      replayInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    const responses: ResolveRuleOccurrenceInputDto[] = []
    while (result.occurrence?.status === 'PENDING') {
      expect(responses.length).toBeLessThan(20)
      const pending = result.occurrence.pending
      if (
        !pending ||
        (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      )
        throw new Error('Expected bounded Assisted action evidence.')
      const staged = await records(base.t, base.run.id)
      expect(staged.run).toEqual(before.run)
      expect(staged.actors).toEqual(before.actors)
      expect(staged.commands).toEqual(before.commands)
      await expect(
        base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toEqual(pending)
      await expect(
        base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toBeNull()
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
      await expect(
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
      ).rejects.toThrow()
      expect(await records(base.t, base.run.id)).toEqual(staged)
      expect(await records(base.t, base.run.id)).toEqual(staged)
      result = await executeInRoom(base.owner.caller, {
        command: response
      })
      const settledResponse = await records(base.t, base.run.id)
      // Once the action settles its decision is no longer routable, so a retry is refused stale.
      const settledAction = result.occurrence?.status !== 'PENDING'
      await expect(
        executeInRoom(base.owner.caller, {
          command: { ...response, correlationId: crypto.randomUUID() }
        })
      ).rejects.toThrow(settledAction ? 'Rule occurrence is unavailable.' : LiveSessionRouteError)
      await expect(
        executeInRoom(base.owner.caller, {
          command: { ...response, commandId: crypto.randomUUID() }
        })
      ).rejects.toThrow(
        settledAction ? 'Rule occurrence is unavailable.' : 'occurrence version is stale'
      )
      await expect(
        replayInRoom(base.owner.caller, {
          command: response
        })
      ).resolves.toEqual(result)
      expect(await records(base.t, base.run.id)).toEqual(settledResponse)
      responses.push(response)
    }
    expect(responses.length).toBeGreaterThanOrEqual(2)
    expect(result.projection.version).toBe(1)
    expect(result.occurrence?.status).toBe('COMPLETE')
    const settled = await records(base.t, base.run.id)
    const source = settled.actors.find((actor) => actor.id === base.actor.id)
    const target = settled.actors.find((actor) => actor.id === base.target.id)
    if (!source || !target) throw new Error('Missing settled action actors.')
    const featureId = nativeCreature(true, false, false, true).features?.find(
      (feature) => feature.label === 'Bite'
    )?.id
    if (!featureId) throw new Error('Missing action Feature.')
    const sourceState = encounterRunActorStateSchema.parse(JSON.parse(source.stateJson))
    expect(featureChargeUsed(sourceState, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(sourceState, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    expect(creatureActorState(target.stateJson).currentHitPoints).toBeLessThan(
      base.target.currentHitPoints!
    )
    expect(settled.commands).toHaveLength(before.commands.length + 1)
    await expect(
      replayInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    for (const response of responses)
      await expect(
        replayInRoom(base.owner.caller, {
          command: response
        })
      ).resolves.toEqual(result)
    expect(await records(base.t, base.run.id)).toEqual(settled)
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...input, expectedVersion: 1, commandId: responses[0]!.commandId }
      })
      // Refused as reused, or redacted when Convex finds the id on the answer's history first.
    ).rejects.toThrow(/Command ID was already used with different input|Live Session route request/)
    expect(await records(base.t, base.run.id)).toEqual(settled)
    const secondRun = await base.owner.caller.mutation(createRun, {
      campaignId: base.campaign.id,
      blueprintId: base.blueprint.id,
      commandId: crypto.randomUUID()
    })
    for (const run of [result.projection, secondRun]) {
      const beforeCollision = await records(base.t, run.id)
      await expect(
        executeInRoom(base.owner.caller, {
          command: {
            type: 'UPSERT_REMINDER',
            encounterId: run.id,
            expectedVersion: run.version,
            commandId: responses[0]!.commandId,
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
        // Refused as reused, or redacted when Convex finds the id on the answer's history first.
      ).rejects.toThrow(
        /Command ID was already used with different input|Live Session route request/
      )
      expect(await records(base.t, run.id)).toEqual(beforeCollision)
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
    const before = await records(base.t, base.run.id)
    const uncontrolled = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    expect(
      await rejection(executeInRoom(base.other.caller, { command: uncontrolled }))
    ).toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    expect(await records(base.t, base.run.id)).toEqual(before)
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
    const settled = await records(base.t, base.run.id)
    await expect(replayInRoom(base.other.caller, { command: input })).resolves.toEqual(result)
    expect(await rejection(executeInRoom(base.owner.caller, { command: input }))).toMatchObject({
      reason: 'COMMAND_ID_REUSED'
    })
    expect(await records(base.t, base.run.id)).toEqual(settled)
  }, 30000)

  it('settles an allowed Creature action once, replays it exactly, and rejects stale or unauthorized commands', async () => {
    const base = await setup()
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    const before = await records(base.t, base.run.id)
    expect(
      await rejection(
        executeInRoom(base.owner.caller, {
          command: command({ ...input, targetActorId: base.actor.id })
        })
      )
    ).toMatchObject({ reason: 'RULE_WARNINGS', warnings: [{ code: 'TARGET_DISPOSITION' }] })
    const result = await executeInRoom(base.owner.caller, {
      command: input
    })
    expect(result.projection.version).toBe(1)
    const settled = await records(base.t, base.run.id)
    expect(settled.run?.version).toBe(1)
    const target = settled.actors.find((actor) => actor.id === base.target.id)
    if (!target) throw new Error('Missing settled target.')
    expect(creatureActorState(target.stateJson).currentHitPoints).toBeLessThan(100)
    expect(settled.occurrences).toHaveLength(before.occurrences.length + 1)
    expect(settled.receipts).toHaveLength(before.receipts.length + 1)
    expect(settled.commands).toHaveLength(before.commands.length + 1)
    await expect(
      replayInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    expect(await records(base.t, base.run.id)).toEqual(settled)
    await expect(
      executeInRoom(base.owner.caller, {
        command: command({ ...input, commandId: crypto.randomUUID() })
      })
    ).rejects.toThrow('stale')
    await expect(
      executeInRoom(base.other.caller, {
        command: input
      })
    ).rejects.toThrow(LiveSessionRouteError)
    await base.t.run(async (ctx) => {
      const receipt = await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', base.run.id).eq('commandId', input.commandId)
        )
        .unique()
      if (!receipt) throw new Error('Missing native action receipt.')
      await ctx.db.patch(receipt._id, { resultChecksum: '0'.repeat(64) })
    })
    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).rejects.toThrow(LiveSessionRouteError)
  }, 30000)

  it.each([false, true])(
    'settles and rolls back distance actions, then replays after movement (uppercase token IDs: %s)',
    async (uppercaseTokens) => {
      const base = await distanceSetup({ uppercaseTokens })
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
      const before = await records(base.t, base.run.id)
      const random = vi
        .spyOn(rollRandom, 'nextRollInt')
        .mockImplementation((maximum) => (maximum === 20 ? 14 : maximum - 1))
      let result: EncounterCommandResultDto
      try {
        expect(await records(base.t, base.run.id)).toEqual(before)
        result = encounterCommandResultDtoSchema.parse(
          await executeInRoom(base.owner.caller, { command: input })
        )
        expect(random).toHaveBeenCalled()
      } finally {
        random.mockRestore()
      }
      const settled = await records(base.t, base.run.id)
      expect(settled.run?.version).toBe(base.run.version + 1)
      expect(settled.commands).toHaveLength(before.commands.length + 1)
      const target = creatureActorState(
        settled.actors.find((actor) => actor.id === base.target.id)!.stateJson
      )
      expect(target.currentHitPoints).toBeLessThan(base.target.currentHitPoints)
      // The seeded Bite's second hit path knocks the target prone.
      expect(target.conditions).toEqual([
        {
          conditionTypeId: srdSystemRecord.conditionTypes.find(
            (condition) => condition.code === 'PRONE'
          )?.id
        }
      ])
      await replaceTargetToken(base, { x: 450, y: 450 })
      await expect(replayInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
      expect(await records(base.t, base.run.id)).toEqual(settled)
    },
    30000
  )

  it.each(['moved', 'removed'] as const)(
    'uses live target state instead of the in-range base token when %s',
    async (change) => {
      const base = await distanceSetup()
      await replaceTargetToken(base, change === 'moved' ? { x: 450, y: 450 } : null)
      const before = await records(base.t, base.run.id)
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
      else await expect(attempt()).rejects.toThrow(LiveSessionRouteError)
      expect(await records(base.t, base.run.id)).toEqual(before)
    },
    30000
  )

  it('rejects bounded distance actions before writes for missing, mismatched, out-of-range, and stale Scene context', async () => {
    const missing = await distanceSetup()
    const missingInput = command({
      encounterId: missing.run.id,
      expectedVersion: missing.run.version,
      actorId: missing.actor.id,
      targetActorId: missing.target.id,
      actionId: missing.actionId,
      sceneContext: {
        sceneId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        sourceTokenId: missing.tokens[0]!.id,
        targetTokenId: missing.tokens[1]!.id
      }
    })
    const beforeMissing = await records(missing.t, missing.run.id)
    await expect(executeInRoom(missing.owner.caller, { command: missingInput })).rejects.toThrow()
    expect(await records(missing.t, missing.run.id)).toEqual(beforeMissing)

    const wrongBinding = await distanceSetup()
    const wrongBindingInput = command({
      encounterId: wrongBinding.run.id,
      expectedVersion: wrongBinding.run.version,
      actorId: wrongBinding.actor.id,
      targetActorId: wrongBinding.target.id,
      actionId: wrongBinding.actionId,
      sceneContext: {
        sceneId: wrongBinding.sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: wrongBinding.tokens[1]!.id,
        targetTokenId: wrongBinding.tokens[0]!.id
      }
    })
    const beforeWrongBinding = await records(wrongBinding.t, wrongBinding.run.id)
    await expect(
      executeInRoom(wrongBinding.owner.caller, {
        command: wrongBindingInput
      })
    ).rejects.toThrow()
    expect(await records(wrongBinding.t, wrongBinding.run.id)).toEqual(beforeWrongBinding)

    const outOfRange = await distanceSetup()
    await outOfRange.t.run(async (ctx) => {
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
    const outOfRangeInput = command({
      encounterId: outOfRange.run.id,
      expectedVersion: outOfRange.run.version,
      actorId: outOfRange.actor.id,
      targetActorId: outOfRange.target.id,
      actionId: outOfRange.actionId,
      sceneContext: {
        sceneId: outOfRange.sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: outOfRange.tokens[0]!.id,
        targetTokenId: outOfRange.tokens[1]!.id
      }
    })
    const beforeOutOfRange = await records(outOfRange.t, outOfRange.run.id)
    await expect(
      executeInRoom(outOfRange.owner.caller, {
        command: outOfRangeInput
      })
    ).rejects.toThrow()
    expect(await records(outOfRange.t, outOfRange.run.id)).toEqual(beforeOutOfRange)

    const stale = await distanceSetup()
    const staleInput = command({
      encounterId: stale.run.id,
      expectedVersion: stale.run.version,
      actorId: stale.actor.id,
      targetActorId: stale.target.id,
      actionId: stale.actionId,
      sceneContext: {
        sceneId: stale.sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: stale.tokens[0]!.id,
        targetTokenId: stale.tokens[1]!.id
      }
    })
    await advanceSceneVersion(stale.t, stale.sceneId)
    const beforeStale = await records(stale.t, stale.run.id)
    await expect(executeInRoom(stale.owner.caller, { command: staleInput })).rejects.toThrow()
    expect(await records(stale.t, stale.run.id)).toEqual(beforeStale)
  }, 30000)

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
    const before = await records(base.t, base.run.id)
    const result = await executeInRoom(base.owner.caller, {
      command: input
    })
    expect(result.occurrence?.status).toBe('PENDING')
    const paused = await records(base.t, base.run.id)
    expect(paused.run).toEqual(before.run)
    expect(paused.actors).toEqual(before.actors)
    expect(paused.commands).toEqual(before.commands)
    expect(paused.occurrences).toHaveLength(before.occurrences.length + 1)
    const pending = result.occurrence?.pending
    if (!pending || (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE'))
      throw new Error('Expected Assisted distance evidence.')
    await advanceSceneVersion(base.t, base.sceneId)
    await expect(
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
      })
    ).rejects.toThrow()
    const afterRejected = await records(base.t, base.run.id)
    expect(afterRejected.run).toEqual(before.run)
    expect(afterRejected.actors).toEqual(before.actors)
    expect(afterRejected.commands).toEqual(before.commands)
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
    const before = await records(base.t, base.run.id)
    let result = await executeInRoom(base.owner.caller, {
      command: input
    })
    // Every d20 is a natural 20, so the critical hit rolls each damage die twice (D58).
    for (let step = 0; result.occurrence?.status === 'PENDING'; step++) {
      expect(step).toBeLessThan(6)
      const pending = result.occurrence.pending
      if (
        !pending ||
        (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      )
        throw new Error('Unexpected Assisted distance decision.')
      const retained = await records(base.t, base.run.id)
      expect(retained.run).toEqual(before.run)
      expect(retained.actors).toEqual(before.actors)
      expect(retained.commands).toEqual(before.commands)
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
        expect(await records(base.t, base.run.id)).toEqual(retained)
      }
      result = await executeInRoom(base.owner.caller, {
        command: response
      })
      const after = await records(base.t, base.run.id)
      await expect(replayInRoom(base.owner.caller, { command: response })).resolves.toEqual(result)
      expect(await records(base.t, base.run.id)).toEqual(after)
    }
    expect(result.occurrence?.status).toBe('COMPLETE')
    const settled = await records(base.t, base.run.id)
    expect(settled.run?.version).toBe(base.run.version + 1)
    expect(settled.commands).toHaveLength(before.commands.length + 1)
    await expect(replayInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
    expect(await records(base.t, base.run.id)).toEqual(settled)
  }, 30000)

  it('refuses a completed phased action with an authorized nested forced movement before writes', async () => {
    const base = await setup({
      phased: true,
      nestedForced: true,
      targetCreature: true
    })
    const before = await records(base.t, base.run.id)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    const random = vi
      .spyOn(rollRandom, 'nextRollInt')
      .mockReturnValueOnce(14)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
    try {
      await expect(
        executeInRoom(base.owner.caller, {
          command: input
        })
      ).rejects.toThrow('Spatially interpreted actions are not available yet.')
      expect(random).toHaveBeenCalled()
    } finally {
      random.mockRestore()
    }
    expect(await records(base.t, base.run.id)).toEqual(before)
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
    const random = vi
      .spyOn(rollRandom, 'nextRollInt')
      .mockImplementation((maximum) => (maximum === 20 ? 14 : maximum - 1))
    let result: EncounterCommandResultDto
    try {
      result = encounterCommandResultDtoSchema.parse(
        await executeInRoom(base.owner.caller, {
          command: input
        })
      )
      expect(random).toHaveBeenCalled()
    } finally {
      random.mockRestore()
    }

    expect(result.projection.version).toBe(1)
    const settled = await records(base.t, base.run.id)
    const source = settled.actors.find((actor) => actor.id === base.actor.id)
    const target = settled.actors.find((actor) => actor.id === base.target.id)
    const receipt = settled.receipts.find((entry) => entry.commandId === input.commandId)
    if (!source || !target || !receipt) throw new Error('Missing phased native action settlement.')
    const sourceState = encounterRunActorStateSchema.parse(JSON.parse(source.stateJson))
    const targetState = creatureActorState(target.stateJson)
    const featureId = nativeCreature(true, false, false, true).features?.find(
      (feature) => feature.label === 'Bite'
    )?.id
    if (!featureId) throw new Error('Missing phased native action feature.')
    expect(targetState.currentHitPoints).toBe(10)
    expect(featureChargeUsed(sourceState, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(sourceState, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)

    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      stored.status !== 'COMPLETE' ||
      stored.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    ) {
      throw new Error('Expected completed phased native action receipt.')
    }
    expect(stored.phaseReceipts?.map((phase) => phase.phase)).toEqual(['TEST', 'OUTCOME'])
    expect(stored.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_HIT')
    expect(stored.applicationOutputs).toMatchObject({
      occurrenceId: receipt.occurrenceId,
      sourceActorId: base.actor.id,
      targetActorId: base.target.id
    })

    await expect(
      replayInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    const replayed = await records(base.t, base.run.id)
    expect(replayed).toEqual(settled)
    expect(replayed.run?.version).toBe(1)

    const commandRecord = replayed.commands.find((entry) => entry.commandId === input.commandId)
    const phaseReceipts = stored.phaseReceipts
    if (!commandRecord || !phaseReceipts)
      throw new Error('Missing phased native action receipt linkage.')
    const tampered = storedRuleExecutionResultDtoSchema.parse({
      ...stored,
      phaseReceipts: phaseReceipts.map((phase, index) =>
        index === 0 ? { ...phase, boundFactsChecksum: '0'.repeat(64) } : phase
      )
    })
    const tamperedChecksum = checksumRuleDocument(tampered)
    await base.t.run(async (ctx) => {
      await ctx.db.patch(receipt._id, {
        resultJson: JSON.stringify(tampered),
        resultChecksum: tamperedChecksum
      })
      await ctx.db.patch(commandRecord._id, {
        ruleResultChecksum: tamperedChecksum
      })
    })
    await expect(
      executeInRoom(base.owner.caller, {
        command: input
      })
    ).rejects.toThrow(LiveSessionRouteError)
  }, 30000)

  it('settles a self action on the source actor once', async () => {
    const base = await setup({ self: true, charged: true })
    const before = await records(base.t, base.run.id)
    const sourceBefore = before.actors.find((actor) => actor.id === base.actor.id)
    if (!sourceBefore) throw new Error('Missing self-action source actor.')
    const initial = creatureActorState(sourceBefore.stateJson)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.actor.id,
      actionId: base.actionId
    })
    await executeInRoom(base.owner.caller, {
      command: input
    })
    const after = await records(base.t, base.run.id)
    const sourceAfter = after.actors.find((actor) => actor.id === base.actor.id)
    if (!sourceAfter) throw new Error('Missing settled self-action source actor.')
    const settled = creatureActorState(sourceAfter.stateJson)
    expect(settled.currentHitPoints).toBe(initial.currentHitPoints - 1)
    const featureId = nativeCreature(true, true).features?.find(
      (feature) => feature.label === 'Bite'
    )?.id
    if (!featureId) throw new Error('Missing self-action feature.')
    expect(featureChargeUsed(settled, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(settled, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    const receipt = after.receipts.find((entry) => entry.commandId === input.commandId)
    if (!receipt) throw new Error('Missing self-action receipt.')
    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      stored.status !== 'COMPLETE' ||
      stored.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    ) {
      throw new Error('Expected completed self-action receipt.')
    }
    const transition = stored.applicationOutputs.targetTransition
    expect(
      checksumRuleDocument({
        targetActorId: base.actor.id,
        currentHitPoints: transition.before.currentHitPoints,
        temporaryHitPoints: transition.before.temporaryHitPoints,
        maximumHitPoints: transition.before.maximumHitPoints,
        scalarValues: transition.before.scalarValues,
        conditionIds: transition.before.conditionIds
      })
    ).toBe(stored.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY])
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
    const source = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing charged source actor.')
      return encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
    })
    const featureId = nativeCreature(true).features?.find((feature) => feature.label === 'Bite')?.id
    if (!featureId) throw new Error('Missing charged Feature fixture.')
    expect(featureChargeUsed(source, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(source, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    await expect(
      replayInRoom(base.owner.caller, {
        command: input
      })
    ).resolves.toEqual(result)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing charged source actor.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const exhausted = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(
          { ...actor, resources: withFeatureChargeUsed(actor, featureId, 1) },
          SRD_ACTION_ALLOWANCE_DEFINITION_ID,
          0
        )
      })
      await writeRunActor(ctx, row._id, exhausted)
    })
    const exhausted = await rejection(
      executeInRoom(base.owner.caller, {
        command: command({ ...input, commandId: crypto.randomUUID(), expectedVersion: 1 })
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
      const stored = await base.t.run(async (ctx) => {
        const effect = await ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
            q.eq('encounterId', base.run.id).eq('targetActorId', base.actor.id)
          )
          .unique()
        const receipt = await ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) =>
            q.eq('encounterId', base.run.id).eq('commandId', input.commandId)
          )
          .unique()
        return { effect, receipt }
      })
      expect(stored.effect).toBeTruthy()
      if (!stored.receipt) throw new Error('Missing native action receipt.')
      const execution = storedRuleExecutionResultDtoSchema.parse(
        JSON.parse(stored.receipt.resultJson)
      )
      if (
        execution.status !== 'COMPLETE' ||
        !execution.applicationOutputs ||
        execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      )
        throw new Error('Missing completed native action outputs.')
      expect(execution.applicationOutputs.activeEffectTransitions).toHaveLength(1)
      expect(execution.applicationOutputs.activeEffectTransitions[0]?.activeEffectId).toBe(
        stored.effect?.id
      )
      await expect(replayInRoom(base.owner.caller, { command: input })).resolves.toEqual(result)
      const replayed = await base.t.run(async (ctx) =>
        ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
            q.eq('encounterId', base.run.id).eq('targetActorId', base.actor.id)
          )
          .collect()
      )
      expect(replayed).toHaveLength(1)
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
      expect((await records(base.t, base.run.id)).activeEffects).toHaveLength(0)
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
      expect((await records(base.t, base.run.id)).activeEffects).toHaveLength(effects)
      await expect(replayInRoom(base.owner.caller, { command: response })).resolves.toEqual(result)
      expect((await records(base.t, base.run.id)).activeEffects).toHaveLength(effects)
    },
    30000
  )

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
      const targets = await loadMovementTargets(ctx, {
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
    expect((await records(base.t, base.run.id)).activeEffects).toHaveLength(0)
  }, 30000)
})

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof ConvexError)) throw new Error('Expected a domain rejection.')
  return domainRejectionErrorDataSchema.parse(error.data)
}

function sourceActorState(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
    if (!row) throw new Error('Missing source actor.')
    return encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
  })
}

function actorsWithoutCounters(value: Awaited<ReturnType<typeof records>>) {
  return value.actors.map((row) => {
    const { resources: _resources, ...actor } = encounterRunActorStateSchema.parse(
      JSON.parse(row.stateJson)
    )
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
          ...command({ ...first, commandId: crypto.randomUUID(), expectedVersion: 1 }),
          acknowledgedWarnings
        }
      })
    const before = await records(base.t, base.run.id)
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
    expect(await records(base.t, base.run.id)).toEqual(before)

    const result = await again(['ACTION_ECONOMY_UNAVAILABLE', 'RESOURCE_UNAVAILABLE'])
    expect(result.projection.version).toBe(2)
    const source = await sourceActorState(base)
    // Charges stop at their maximum; the allowance records the over-use.
    expect(featureChargeUsed(source, featureId)).toBe(1)
    expect(encounterRuleUsageUsed(source, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(2)
    const stored = await base.t.run(async (ctx) => ({
      runCommand: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId_version', (q) =>
          q.eq('encounterId', base.run.id).eq('version', 2)
        )
        .unique(),
      receipt: await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_encounterVersion', (q) =>
          q.eq('encounterId', base.run.id).eq('encounterVersion', 2)
        )
        .unique()
    }))
    if (stored.runCommand?.commandType !== 'RESOLVE_ACTION' || !stored.receipt)
      throw new Error('Missing overridden action records.')
    expect(stored.runCommand.ruleOverrides.map((warning) => warning.code)).toEqual([
      'ACTION_ECONOMY_UNAVAILABLE',
      'RESOURCE_UNAVAILABLE'
    ])
    const execution = storedRuleExecutionResultDtoSchema.parse(
      JSON.parse(stored.receipt.resultJson)
    )
    if (
      !('applicationOutputs' in execution) ||
      execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    )
      throw new Error('Expected a completed Creature action receipt.')
    expect(execution.applicationOutputs.featureResourceConsumption).toBeNull()
    expect(execution.applicationOutputs.actionEconomyTransition).toMatchObject({
      maximum: 1,
      beforeUsed: 1,
      afterUsed: 2
    })
    const timeline = await base.owner.caller.query(api.encounters.timelineReads.timeline, {
      encounterId: base.run.id,
      limit: 5
    })
    expect(timeline.entries.find((entry) => entry.version === 2)?.ruleOverrides).toEqual(
      stored.runCommand.ruleOverrides
    )
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
            targetActorId: base.actor.id,
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
    expect(
      await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toMatchObject({
      kind: 'D20_EVIDENCE',
      request: { rollMode: 'DISADVANTAGE', derivedRollModeReasons: ['Long range'] }
    })

    // Beyond its long range (13 squares, 65 ft.) the attack only warns (D11).
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
              ...sceneContext,
              sceneId: far.sceneId,
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
    const before = await records(base.t, base.run.id)
    const refuse = async (changed: typeof input) =>
      (await rejection(executeInRoom(base.owner.caller, { command: changed }))).reason
    expect(await refuse({ ...input, actorId: base.target.id, targetActorId: base.actor.id })).toBe(
      'NOT_CURRENT_ACTOR'
    )
    expect(await refuse({ ...input, expectedVersion: 7 })).toBe('VERSION_STALE')
    await expect(executeInRoom(base.other.caller, { command: input })).rejects.toThrow(
      LiveSessionRouteError
    )
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...input, targetActorId: crypto.randomUUID() }
      })
    ).rejects.toThrow()
    expect(await records(base.t, base.run.id)).toEqual(before)
  }, 30000)
})

describe('GM undo of the last action', () => {
  it('restores Creature hit points, charges and the action allowance exactly, once', async () => {
    const base = await setup({ charged: true, targetCreature: true })
    const featureId = nativeCreature(true).features!.find((feature) => feature.label === 'Bite')!.id
    const before = await records(base.t, base.run.id)
    const action = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId
    })
    await executeInRoom(base.owner.caller, { command: action })
    const settled = await records(base.t, base.run.id)
    const targetState = (value: Awaited<ReturnType<typeof records>>) =>
      creatureActorState(value.actors.find((actor) => actor.id === base.target.id)!.stateJson)
    expect(targetState(settled).currentHitPoints).toBeLessThan(targetState(before).currentHitPoints)

    await expect(revert(base, 1, base.other.caller)).rejects.toThrow(LiveSessionRouteError)
    const undone = await revert(base, 1)
    expect(undone.projection.version).toBe(2)
    const after = await records(base.t, base.run.id)
    // Counters return to their values; an unused counter may be stored as 0 rather than absent.
    expect(actorsWithoutCounters(after)).toEqual(actorsWithoutCounters(before))
    const source = await sourceActorState(base)
    expect(featureChargeUsed(source, featureId)).toBe(0)
    expect(encounterRuleUsageUsed(source, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
    expect(after.commands.find((entry) => entry.version === 2)).toMatchObject({
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: action.commandId
    })
    const timeline = await base.owner.caller.query(api.encounters.timelineReads.timeline, {
      encounterId: base.run.id,
      limit: 5
    })
    expect(timeline.entries[0]).toMatchObject({ commandType: 'REVERT_LAST_ACTION', version: 2 })
    expect(await rejection(revert(base, 2))).toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: 'The last action was already undone.'
    })
  }, 30000)

  it('deletes the effect an action created and restores its conditions', async () => {
    const base = await setup({ self: true, recurring: true, condition: true })
    const before = await records(base.t, base.run.id)
    await executeInRoom(base.owner.caller, {
      command: command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.actor.id,
        actionId: base.actionId
      })
    })
    expect((await records(base.t, base.run.id)).activeEffects).toHaveLength(1)
    await revert(base, 1)
    const after = await records(base.t, base.run.id)
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
    const settled = await records(base.t, base.run.id)
    expect(await rejection(revert(base, 2))).toMatchObject({ reason: 'REVERT_UNAVAILABLE' })
    expect(await records(base.t, base.run.id)).toEqual(settled)
  }, 30000)
})
