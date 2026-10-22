import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules'
import type {
  CampaignSceneState,
  SceneGrid,
  ScenePoint,
  SceneToken
} from '@artificer-toolkit/shared/vtt'

import type { EncounterAttackAgainstContributor } from './encounterActiveGrants.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import { encounterConcealmentOf, isConcealedFrom } from './encounterConcealment.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
  ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
  encounterRuleContributorSource
} from './encounterRollModeReasons.js'
import {
  mergeCanonicalD20Contributors,
  type EncounterRelationshipD20Contributor
} from './encounterRelationshipActionFacts.js'
import {
  resolveEncounterActorPairPerception,
  type EncounterPerceptionActor
} from './encounterTurnEffectPerception.js'

/** Whether one actor sees another, by its structured Senses (a Character's or a Creature's). */
export type EncounterAttackSight = 'SEES' | 'UNSEEN'

export type EncounterAttackPerception = {
  targetSeesAttacker: EncounterAttackSight
  attackerSeesTarget: EncounterAttackSight
  /** The System labels of the Senses that let the target see the attacker; empty unless it SEES. */
  targetSenseLabels: readonly string[]
  /** The System labels of the Senses that let the attacker see the target; empty unless it SEES. */
  attackerSenseLabels: readonly string[]
  /**
   * The System Sense definitions that let the attacker see the target; empty unless it SEES. The
   * attacker knows its own Senses, so its believed perception names them too.
   */
  attackerSenseDefinitionIds: readonly string[]
}

/**
 * Whether the attacker (the acting creature) sees the target, or the target sees the attacker:
 * the one reading of sight that targeting and zones share.
 */
export function encounterSightHolds(
  perception: Pick<EncounterAttackPerception, 'attackerSeesTarget' | 'targetSeesAttacker'>,
  direction: 'ACTOR_SEES_TARGET' | 'TARGET_SEES_ACTOR'
): boolean {
  return (
    (direction === 'ACTOR_SEES_TARGET'
      ? perception.attackerSeesTarget
      : perception.targetSeesAttacker) === 'SEES'
  )
}

/** Who rolls the d20 the perception is believed for: an attack's attacker or a save's target. */
export type EncounterPerceptionRoller = 'ATTACKER' | 'TARGET'

type AttackPerceptionActor = EncounterPerceptionActor & Pick<MovementTarget, 'conditionDefinitions'>

type AttackPerceptionLoaders = Pick<
  Parameters<typeof resolveEncounterActorPairPerception>[0],
  'gameSystemId' | 'loadDefinition' | 'loadSystem'
>

/** The perception Scene of an attack: its tokens, effective grid, and spatial effects. */
export type EncounterAttackPerceptionPlacement = {
  scene: Pick<
    CampaignSceneState,
    | 'ambientIllumination'
    | 'barriers'
    | 'darknessZones'
    | 'doorStates'
    | 'grid'
    | 'lights'
    | 'tokens'
  >
  sceneGrid: SceneGrid
  attackerToken: SceneToken
  targetToken: SceneToken
  spatialEffects: readonly EncounterSpatialRuleEffectRecord[]
}

/**
 * Whether one observer sees one subject, and by which System Senses (ordinary sight is none).
 * `believed` decides only on the facts the observer's roller knows, so it labels no Senses; the
 * observer's own qualifying Sense definitions are still named.
 */
async function resolveAttackSight(
  input: AttackPerceptionLoaders & {
    observer: AttackPerceptionActor
    subject: AttackPerceptionActor
    placement: Parameters<typeof resolveEncounterActorPairPerception>[0]['placement']
    believed: boolean
  }
): Promise<{
  sight: EncounterAttackSight
  senseLabels: readonly string[]
  senseDefinitionIds: readonly string[]
}> {
  const { observer, subject } = input
  // A concealed subject is unseen by the observers its concealment still hides it from (ATTACK-10.T1).
  // On a Scene an observer that really sees the subject has noticed it, so the Scene decides; without
  // one (the neutral environment, where everyone sees everyone) the persisted observer set decides.
  // `believed` knows which observers failed to notice no better than its roller does (D100), so it
  // treats the subject as hidden from every observer the concealment could have fooled.
  if (
    input.believed
      ? encounterConcealmentOf(subject.activeEffects) !== null &&
        encounterActorRelationship(subject.actor.disposition, observer.actor.disposition) !==
          'ALLIED'
      : input.placement === null && isConcealedFrom(subject.activeEffects, observer.actor.id)
  )
    return { sight: 'UNSEEN', senseLabels: [], senseDefinitionIds: [] }
  const result = await resolveEncounterActorPairPerception({
    gameSystemId: input.gameSystemId,
    requirement: 'SEE',
    observer,
    subject,
    observerConditionDefinitions: observer.conditionDefinitions,
    subjectConditionDefinitions: subject.conditionDefinitions,
    placement: input.placement,
    loadDefinition: input.loadDefinition,
    loadSystem: input.loadSystem
  })
  if (!result.satisfied) return { sight: 'UNSEEN', senseLabels: [], senseDefinitionIds: [] }
  const qualifying = new Set(result.qualifying.map((identity) => identity.definitionId))
  if (qualifying.size === 0) return { sight: 'SEES', senseLabels: [], senseDefinitionIds: [] }
  const senses = (await input.loadSystem()).senses.filter((sense) => qualifying.has(sense.id))
  return {
    sight: 'SEES',
    senseDefinitionIds: senses.map((sense) => sense.id).sort(),
    senseLabels: input.believed
      ? []
      : senses.map((sense) => sense.label).sort((left, right) => left.localeCompare(right))
  }
}

/** Resolves both directions of sight between an attacker and its target (SRD unseen attacker/target). */
export async function resolveEncounterAttackPerception(
  input: AttackPerceptionLoaders & {
    attacker: AttackPerceptionActor
    target: AttackPerceptionActor
    /** Null outside a Scene: conditions and Senses still decide on the neutral environment. */
    placement: EncounterAttackPerceptionPlacement | null
  }
): Promise<EncounterAttackPerception> {
  const { placement } = input
  const [target, attacker] = await Promise.all([
    resolveAttackSight({
      ...input,
      observer: input.target,
      subject: input.attacker,
      placement: placement && {
        ...placement,
        observerToken: placement.targetToken,
        subjectToken: placement.attackerToken
      },
      believed: false
    }),
    resolveAttackSight({
      ...input,
      observer: input.attacker,
      subject: input.target,
      placement: placement && {
        ...placement,
        observerToken: placement.attackerToken,
        subjectToken: placement.targetToken
      },
      believed: false
    })
  ])
  return {
    targetSeesAttacker: target.sight,
    attackerSeesTarget: attacker.sight,
    targetSenseLabels: target.senseLabels,
    attackerSenseLabels: attacker.senseLabels,
    attackerSenseDefinitionIds: attacker.senseDefinitionIds
  }
}

/**
 * Whether an observer sees a point on the Scene (an area's chosen origin), by the same perception
 * rules as a creature: the observer's conditions and Senses, and the Scene's lighting, darkness,
 * barriers and spatial effects at the point. The point is a subject with no conditions, effects or
 * extent. Without a placement the neutral environment applies (D94), so only the observer's
 * conditions can stop it seeing.
 */
export async function resolveEncounterPointSight(
  input: AttackPerceptionLoaders & {
    observer: AttackPerceptionActor
    point: ScenePoint
    placement:
      | (Omit<EncounterAttackPerceptionPlacement, 'attackerToken' | 'targetToken'> & {
          observerToken: SceneToken
        })
      | null
  }
): Promise<EncounterAttackSight> {
  const { placement } = input
  return (
    await resolveAttackSight({
      ...input,
      subject: strippedAttackActor(input.observer),
      placement: placement && {
        ...placement,
        subjectToken: { ...placement.observerToken, position: input.point, width: 0, height: 0 }
      },
      believed: false
    })
  ).sight
}

/**
 * The observers that see a subject now on a Scene, each by its own placement. A concealment check
 * never hides its roller from these (SRD: you can't hide from a creature that sees you clearly).
 */
export async function resolveEncounterObserversSeeing(
  input: AttackPerceptionLoaders & {
    subject: AttackPerceptionActor
    observers: readonly {
      observer: AttackPerceptionActor
      placement: NonNullable<Parameters<typeof resolveEncounterActorPairPerception>[0]['placement']>
    }[]
  }
): Promise<ReadonlySet<string>> {
  const sights = await Promise.all(
    input.observers.map(({ observer, placement }) =>
      resolveAttackSight({ ...input, observer, placement, believed: false })
    )
  )
  return new Set(
    input.observers.flatMap(({ observer }, index) =>
      sights[index]?.sight === 'SEES' ? [observer.actor.id] : []
    )
  )
}

/** An actor as a roller who knows nothing of it sees it: no Senses, effects or conditions. */
const strippedAttackActor = (actor: AttackPerceptionActor): AttackPerceptionActor => ({
  ...actor,
  activeEffects: [],
  perceptionSenses: [],
  conditionDefinitions: []
})

/**
 * The sight the roller of an attack believes before the server applies the true mode (ATTACK-10.1):
 * the attacker as it is, the target as a stranger, on the neutral environment. The target sees the
 * attacker through System baseline sight alone; the attacker sees the target through its own Senses,
 * conditions and effects. Scene lighting, the target's Senses and the target's conditions are not
 * inputs, and the answer is never undecided. A save is rolled by the target, who knows its own
 * conditions and Senses (ATTACK-10.5), so there the target sees the attacker as it is.
 */
export async function resolveEncounterBelievedAttackPerception(
  input: AttackPerceptionLoaders & {
    attacker: AttackPerceptionActor
    target: AttackPerceptionActor
    /** Who rolls the d20; the attacker unless omitted. */
    roller?: EncounterPerceptionRoller
  }
): Promise<EncounterAttackPerception> {
  const [target, attacker] = await Promise.all([
    resolveAttackSight({
      ...input,
      observer: input.roller === 'TARGET' ? input.target : strippedAttackActor(input.target),
      subject: input.attacker,
      placement: null,
      believed: true
    }),
    resolveAttackSight({
      ...input,
      observer: input.attacker,
      subject: strippedAttackActor(input.target),
      placement: null,
      believed: true
    })
  ])
  return {
    targetSeesAttacker: target.sight,
    attackerSeesTarget: attacker.sight,
    targetSenseLabels: [],
    attackerSenseLabels: [],
    attackerSenseDefinitionIds: attacker.senseDefinitionIds
  }
}

/** The attack-roll contributors the SRD gives unseen attackers (advantage) and unseen targets (disadvantage). */
export function encounterAttackPerceptionContributors(
  perception: EncounterAttackPerception
): readonly EncounterRelationshipD20Contributor[] {
  return [
    ...(perception.targetSeesAttacker === 'UNSEEN'
      ? [
          {
            sourceId: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
            grantId: null,
            domainKey: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
            influence: 'ADVANTAGE' as const,
            source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_ATTACKER)
          }
        ]
      : []),
    ...(perception.attackerSeesTarget === 'UNSEEN'
      ? [
          {
            sourceId: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
            grantId: null,
            domainKey: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
            influence: 'DISADVANTAGE' as const,
            source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_TARGET)
          }
        ]
      : [])
  ]
}

/**
 * Every attack-roll contributor that sight decides: the target's `ATTACKS_AGAINST` contributors
 * (Dodge), those that require the target to see the attacker holding only while it can, those
 * that exempt Senses dropped for an attacker seeing the target through one (Blur), and the unseen
 * attacker/target contributors. A grant that suppresses an influence (Elusive's advantage) and
 * holds drops every contributor of that influence among them. True and believed perception build theirs with this one rule.
 */
export function encounterAttackSightContributors(input: {
  perception: EncounterAttackPerception
  attacksAgainst: readonly SightDecidedAttackAgainst[]
}): readonly EncounterRelationshipD20Contributor[] {
  const { perception } = input
  const held = input.attacksAgainst.filter((entry) => attackAgainstHolds(entry, perception))
  const contributors = mergeCanonicalD20Contributors(
    held.flatMap(({ contributor }) => (contributor ? [contributor] : [])),
    encounterAttackPerceptionContributors(perception)
  )
  const suppressed = held.flatMap(({ suppressedInfluence }) =>
    suppressedInfluence === null ? [] : [suppressedInfluence]
  )
  return contributors.filter(({ influence }) => !suppressed.includes(influence))
}

type SightDecidedAttackAgainst = Pick<
  EncounterAttackAgainstContributor,
  | 'requiresHolderSeesAttacker'
  | 'exemptAttackerSenseDefinitionIds'
  | 'contributor'
  | 'suppressedInfluence'
>

/**
 * Whether a target's attacks-against grant holds for an attack as the target perceives it: one that
 * requires the target to see the attacker holds only while it can, and none holds for an attacker
 * seeing the target through a Sense it exempts. Without perception, every grant holds.
 */
export function attackAgainstHolds(
  entry: Omit<SightDecidedAttackAgainst, 'contributor' | 'suppressedInfluence'>,
  perception: EncounterAttackPerception | null
): boolean {
  return (
    perception === null ||
    ((!entry.requiresHolderSeesAttacker || perception.targetSeesAttacker !== 'UNSEEN') &&
      !entry.exemptAttackerSenseDefinitionIds.some((senseId) =>
        perception.attackerSenseDefinitionIds.includes(senseId)
      ))
  )
}
