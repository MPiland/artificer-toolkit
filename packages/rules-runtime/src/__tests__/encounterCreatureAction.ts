import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  type AttackOccasionCode
} from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import {
  SRD_ABILITIES,
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { compileDnd5eCreatureRuleFacts } from '../systems/dnd5e/creatureRuleFacts.js'
import { withFeatureChargeUsed } from '../encounterActorState.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import {
  planNativeEncounterActionMechanics,
  type NativeEncounterActionMechanicsInput
} from '../encounterActionMechanicsPlan.js'
import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import {
  resolveEncounterAttackPerception,
  resolveEncounterBelievedAttackPerception
} from '../encounterAttackPerception.js'
import type { EncounterAttackAgainstContributor } from '../encounterActiveGrants.js'
import { discoverEncounterFeatureActionCapabilities } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { buildMovementTarget, type CharacterMovementFacts } from '../encounterMovementTargets.js'
import { DND5E_DAMAGE_PROPOSAL_OPERATION_KEY } from '../systems/dnd5e/effectActionContracts.js'
import {
  currentConditionDefinition,
  srdConditionDefinitionSource
} from './srdConditionDefinitions.js'

export type CreatureFeature = NonNullable<CreatureAuthored['features']>[number]
type ActionCharacterFacts = NonNullable<
  NativeEncounterActionMechanicsInput['prepared']['sourceFacts']['characterFacts']
>

const ENCOUNTER_ID = '00000000-0000-4000-8000-00000000e001'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000e002'
const SIDE_ID = '00000000-0000-4000-8000-00000000e003'
const TIMESTAMP = '2026-09-26T00:00:00.000Z'
const SETTLING_USER_ID = '00000000-0000-4000-8000-00000000e004'

export function srdAbilityId(code: (typeof SRD_ABILITIES)[number]['code']) {
  const ability = SRD_ABILITIES.find((entry) => entry.code === code)
  if (!ability) throw new Error(`SRD ability "${code}" is missing.`)
  return ability.id
}

export function srdConditionId(code: string) {
  const condition = SRD_CONDITION_TYPES.find((entry) => entry.code === code)
  if (!condition) throw new Error(`SRD condition "${code}" is missing.`)
  return condition.id
}

export function srdDamageTypeId(code: string) {
  const damageType = SRD_DAMAGE_TYPES.find((entry) => entry.code === code)
  if (!damageType) throw new Error(`SRD damage type "${code}" is missing.`)
  return damageType.id
}

export const QUILL_VOLLEY_ID = '00000000-0000-4000-8000-00000000c001'
export const QUILL_VOLLEY_CHARGE_ID = '00000000-0000-4000-8000-00000000c002'

/**
 * "Quill Volley": a charged single-target Action dealing a fixed 3 piercing damage. With
 * `rangeFeet` it is a +5 ranged weapon attack at that range (3 damage on a hit); otherwise it
 * simply happens to any target.
 */
export function quillVolley(input: {
  charges: number
  cost: number
  rangeFeet?: number
}): CreatureFeature {
  const rangeId = '00000000-0000-4000-8000-00000000c004'
  return {
    id: QUILL_VOLLEY_ID,
    label: 'Quill Volley',
    description: 'Fixture: a charged single-target action.',
    order: 1,
    charges: {
      id: QUILL_VOLLEY_CHARGE_ID,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: input.charges
    },
    ...(input.rangeFeet === undefined
      ? {}
      : {
          rollDefinitions: [
            {
              id: '00000000-0000-4000-8000-00000000c008',
              label: 'Quill Volley attack',
              kind: 'ATTACK' as const,
              expression: { count: 1, die: 20, modifier: 5 },
              rollMode: 'NORMAL' as const,
              chargeCost: null,
              order: 1
            }
          ]
        }),
    effects: [
      {
        id: '00000000-0000-4000-8000-00000000c003',
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode:
            input.rangeFeet === undefined ? TRIGGER.ACTIVATED : TRIGGER.RANGED_WEAPON_ATTACK,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range:
            input.rangeFeet === undefined
              ? { id: rangeId, rangeKind: RANGE_KIND.UNLIMITED }
              : {
                  id: rangeId,
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: input.rangeFeet,
                  unit: 'FEET'
                },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
          resourceUse: { chargeId: QUILL_VOLLEY_CHARGE_ID, cost: input.cost }
        },
        paths: [
          {
            id: '00000000-0000-4000-8000-00000000c005',
            order: 1,
            pathCode: input.rangeFeet === undefined ? PATH_CODE.ON_USE : PATH_CODE.ON_HIT,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: '00000000-0000-4000-8000-00000000c006',
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: '00000000-0000-4000-8000-00000000c007',
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: srdDamageTypeId('PIERCING'),
                  valueKind: 'FIXED',
                  scalingKind: 'NONE',
                  amount: 3
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

/** The SRD System vocabulary pinned the way a published snapshot is. */
function srdVocabularySnapshot() {
  const identity = {
    snapshotId: '00000000-0000-4000-8000-00000000e005',
    systemId: srdSystemRecord.id,
    snapshotVersion: 1,
    schemaVersion: 1,
    document: srdSystemRecord
  }
  return systemVocabularySnapshotSchema.parse({
    ...identity,
    checksum: checksumRuleDocument(identity)
  })
}

/**
 * A Wolf stat block (DEX 15, 11 HP) carrying the given Features in place of its own. A `statBlock`
 * replaces the Wolf and has its rule facts compiled by the product's Creature fact compiler.
 */
export function creatureActor(input: {
  id: string
  label: string
  statBlock?: CreatureAuthored
  features: readonly CreatureFeature[]
  disposition?: EncounterRunActorState['disposition']
  conditionIds?: readonly string[]
  conditionImmunityIds?: readonly string[]
  damageResistanceIds?: readonly string[]
  damageVulnerabilityIds?: readonly string[]
  qualifiedDamageDefenses?: NonNullable<CreatureAuthored['qualifiedDamageDefenses']>
  featureChargesUsed?: Readonly<Record<string, number>>
  hitPoints?: number
}): EncounterRunActorState {
  const sourceId = crypto.randomUUID()
  const base = input.statBlock ?? wolf
  const hitPoints = input.hitPoints ?? base.hitPoints
  const payload = {
    ...base,
    id: sourceId,
    label: input.label,
    hitPoints,
    damageVulnerabilities: [...(input.damageVulnerabilityIds ?? [])],
    damageResistances: [...(input.damageResistanceIds ?? [])],
    damageImmunities: [],
    qualifiedDamageDefenses: [...(input.qualifiedDamageDefenses ?? [])],
    conditionImmunities: [...(input.conditionImmunityIds ?? [])],
    features: [...input.features]
  }
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: input.label,
    sourceId,
    sourceRevision: 1,
    public: true,
    controllerUserIds: [],
    disposition: input.disposition ?? 'HOSTILE',
    initiative: null,
    manualOrder: null,
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: input.id,
    gmNotes: null,
    sideId: SIDE_ID,
    currentHitPoints: hitPoints,
    maxHitPoints: hitPoints,
    tempHitPoints: 0,
    defeated: false,
    form: null,
    absence: null,
    conditions: [...(input.conditionIds ?? [])],
    resources: Object.entries(input.featureChargesUsed ?? {}).reduce<Record<string, unknown>>(
      (resources, [featureId, used]) => withFeatureChargeUsed({ resources }, featureId, used),
      {}
    ),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    snapshot: {
      kind: 'CREATURE',
      id: sourceId,
      label: input.label,
      systemId: SRD_SYSTEM_ID,
      sourceRevision: 1,
      sourceVersionId: crypto.randomUUID(),
      sourceChecksum: 'a'.repeat(64),
      maxHitPoints: hitPoints,
      payload,
      ruleFacts: input.statBlock
        ? compileDnd5eCreatureRuleFacts({
            creature: input.statBlock,
            vocabulary: srdVocabularySnapshot()
          })
        : {
            gameSystemId: SRD_SYSTEM_ID,
            vocabularySnapshotId: '00000000-0000-4000-8000-00000000e005',
            vocabularySnapshotVersion: 1,
            vocabularySnapshotChecksum: 'b'.repeat(64),
            abilityScores: Object.fromEntries(
              SRD_ABILITIES.map(({ id, code }) => [id, wolf.abilityScores[code]])
            ),
            checkTotals: {},
            saveProficiencyBonuses: {},
            resourceAbilityScores: wolf.abilityScores,
            initiativeAbilityDefinitionId: srdAbilityId('DEXTERITY'),
            modifiers: []
          }
    }
  })
}

/**
 * The exact discovered action id of a Creature actor's Feature; `effectId` picks one of its options
 * (a Dryad's Shillelagh club), which the GM selects rather than the runtime inferring it.
 */
export function featureActionId(
  actor: EncounterRunActorState,
  featureId: string,
  effectId?: string
) {
  const capability = discoverEncounterFeatureActionCapabilities({
    spells: new Map(),
    actor,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  }).find(
    (candidate) =>
      candidate.ownerFeatureId === featureId &&
      (effectId === undefined || candidate.effectId === effectId)
  )
  if (!capability) throw new Error('The Feature has no discovered action.')
  return capability.actionId
}

/** An Assisted Encounter Run of the given actors and their current movement-target facts. */
export function creatureEncounter<
  TCharacterFacts extends CharacterMovementFacts = ActionCharacterFacts
>(
  actors: readonly EncounterRunActorState[],
  automationMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED',
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]> = new Map()
) {
  const state = encounterRunStateSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID,
    blueprintId: '00000000-0000-4000-8000-00000000e006',
    blueprintVersion: 1,
    blueprintChecksum: 'c'.repeat(64),
    name: 'Rules fixture',
    status: 'ACTIVE',
    automationMode,
    healthDisplayDefault: 'HIDDEN',
    version: 3,
    round: 1,
    turnSequence: 1,
    currentActorId: actors[0]?.id ?? null,
    actorIds: actors.map((actor) => actor.id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot: { schemaVersion: 1, gameSystemId: SRD_SYSTEM_ID, definitions: [] },
    optionalCombatSnapshotChecksum: checksumCanonicalJson({ definitions: [] }),
    sides: [{ id: SIDE_ID, label: 'Enemies', sortOrder: 0 }],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
  const movementTargets = new Map(
    actors.map((actor) => [
      actor.id,
      buildMovementTarget<TCharacterFacts>({
        actor,
        activeEffects: [...(activeEffectsByActorId.get(actor.id) ?? [])],
        gameSystemId: SRD_SYSTEM_ID,
        campaignId: CAMPAIGN_ID,
        characterFacts: null
      })
    ])
  )
  return { state, movementTargets }
}

/** The real perception loaders over the SRD System and its Sense definitions. */
export function srdAttackPerceptionLoaders() {
  return {
    gameSystemId: SRD_SYSTEM_ID,
    loadDefinition: async (id: string) => {
      const sense = SRD_SENSE_DEFINITIONS.find((value) => value.id === id)
      if (!sense) throw new Error(`Unexpected definition ${id}.`)
      return {
        definitionFamilyKey: 'sense',
        gameSystemId: SRD_SYSTEM_ID,
        current: currentConditionDefinition({
          id: sense.id,
          definitionFamilyKey: 'sense',
          label: sense.label,
          document: sense.document
        })
      }
    },
    loadSystem: async () => srdSystemRecord
  }
}

/**
 * Prepares a Creature-to-Creature action through the real preparation path; no persistence. Like
 * the room, it pins each actor's SRD condition definitions first (D94).
 */
export async function prepareCreatureAction(input: {
  actor: EncounterRunActorState
  target: EncounterRunActorState
  featureId: string
  /** The Effect of the feature option the GM picks, when the feature has several. */
  effectId?: string
  overridable: boolean
  targetActiveEffects?: readonly ActiveRuleEffectRecord[]
  actorActiveEffects?: readonly ActiveRuleEffectRecord[]
  /** Resolves sight between the actors on the real perception rules (no Scene), as the room does. */
  attackPerception?: boolean
  /** Gives the target unlimited Blindsight, so it senses an unseen attacker. */
  targetBlindsight?: boolean
  /** What a Dodge on the target would give attacks against it, as the room's defense sets it. */
  targetAttacksAgainst?: readonly EncounterAttackAgainstContributor[]
  /** The once-per-turn uses the attacker has spent this turn, as the room reads its turn record. */
  turnUses?: readonly string[]
  /** The occasion the attack is made on, as a movement reaction sets it. */
  attackOccasion?: AttackOccasionCode
  /** How far the attacker closed on the target in a straight line this turn, as the room's Scene reads it. */
  closedFeet?: number
}) {
  const actors = input.actor.id === input.target.id ? [input.actor] : [input.actor, input.target]
  const encounter = creatureEncounter(
    actors,
    'ASSISTED',
    new Map([
      [input.actor.id, input.actorActiveEffects ?? []],
      [input.target.id, input.targetActiveEffects ?? []]
    ])
  )
  const { state } = encounter
  const { closedFeet } = input
  const movementTargets = new Map(
    await Promise.all(
      [...encounter.movementTargets].map(
        async ([id, target]) =>
          [
            id,
            {
              ...(await withEncounterConditionMechanics({
                target,
                gameSystemId: SRD_SYSTEM_ID,
                definitions: srdConditionDefinitionSource()
              })),
              ...(id === input.target.id && input.targetAttacksAgainst
                ? { attackAgainstContributors: input.targetAttacksAgainst }
                : {})
            }
          ] as const
      )
    )
  )
  return prepareEncounterActionMechanics<ActionCharacterFacts>({
    state,
    actor: input.actor,
    target: input.target,
    actors,
    actionId: featureActionId(input.actor, input.featureId, input.effectId),
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: input.overridable,
    movementTargets,
    loadTurnUses: async () => input.turnUses ?? [],
    ...(input.attackOccasion ? { attackOccasion: input.attackOccasion } : {}),
    ...(closedFeet === undefined ? {} : { loadMoveToward: async () => ({ closedFeet }) }),
    ...(input.attackPerception
      ? {
          loadAttackPerception: async ({ sourceFacts, targetFacts }) => ({
            actual: await resolveEncounterAttackPerception({
              ...srdAttackPerceptionLoaders(),
              attacker: sourceFacts,
              target: input.targetBlindsight
                ? {
                    ...targetFacts,
                    perceptionSenses: [
                      {
                        senseDefinitionId: SRD_BLINDSIGHT_SENSE_ID,
                        range: { id: 'sense-range', rangeKind: 'UNLIMITED' as const }
                      }
                    ]
                  }
                : targetFacts,
              placement: null
            }),
            believed: await resolveEncounterBelievedAttackPerception({
              ...srdAttackPerceptionLoaders(),
              attacker: sourceFacts,
              target: targetFacts
            })
          })
        }
      : {}),
    loadSource: async (source) =>
      resolveEncounterActionSource({ spells: new Map(), ...source, system: srdSystemRecord }),
    loadRelationshipFacts: async () => []
  })
}

type PreparedCreatureAction = Awaited<ReturnType<typeof prepareCreatureAction>>

/**
 * Executes the prepared action with every roll taken from `rolls` (each a 0-based die face, so a
 * natural 11 is 10), then plans its mechanics exactly as the room settles them.
 */
export async function settleCreatureAction(input: {
  prepared: PreparedCreatureAction
  rolls: readonly number[]
  binding?: PreparedCreatureAction['binding']
}) {
  const { prepared } = input
  const queue = [...input.rolls]
  const occurrenceId = '00000000-0000-4000-8000-00000000e007'
  const commandId = '00000000-0000-4000-8000-00000000e008'
  const execution = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId,
    binding: input.binding ?? prepared.binding,
    afterTest: async () => undefined,
    random: (maxExclusive) => {
      const value = queue.shift()
      if (value === undefined || value < 0 || value >= maxExclusive)
        throw new Error(`Unexpected random call (max ${maxExclusive}).`)
      return value
    }
  })
  if (queue.length !== 0) throw new Error(`${queue.length} scripted rolls were not used.`)
  const mechanics = planNativeEncounterActionMechanics(
    {
      prepared,
      encounterId: prepared.state.id,
      expectedEncounterVersion: prepared.state.version,
      occurrenceId,
      sourceCommandId: commandId,
      commandId,
      occurredAt: TIMESTAMP,
      applications: execution.applications
    },
    SETTLING_USER_ID
  )
  return { execution, mechanics }
}

/**
 * The damage dice an action's final phase rolled, as die sizes in request order: the attack's hit
 * damage dice and, separately, the damage dice of a saving throw the hit forces. Each dice group
 * shares its node-id prefix with the proposal it feeds, so other dice (a Strength drain) are left out.
 */
export function outcomeDice(execution: Awaited<ReturnType<typeof executeNativeActionGraphs>>) {
  const { trace } = execution.execution.evidence
  const hitPrefixes = new Set(
    trace.flatMap((entry) =>
      entry.operation.key === DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
        ? [entry.nodeId.replace(/proposal-[a-z_]+$/, '')]
        : []
    )
  )
  const faces = (prefixes: ReadonlySet<string>) =>
    trace.flatMap((entry) => {
      const prefix = /^(.*)die-\d+$/.exec(entry.nodeId)?.[1]
      return entry.operation.key === 'evidence.integer-range' &&
        prefix !== undefined &&
        prefixes.has(prefix)
        ? [`d${String(entry.inputs.max)}`]
        : []
    })
  return { hit: faces(hitPrefixes), save: faces(new Set(['nested-save-'])) }
}
