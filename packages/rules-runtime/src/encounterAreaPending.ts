import { v5 as uuidv5 } from 'uuid'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  type EncounterAreaActionPendingContextDto,
  type ServerAggregateChoicePendingSnapshotDto,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  isDamageRollWindow,
  type DamageRerollCostDto,
  type DamageRollWindowPayloadDto
} from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const encounterAreaNamespace = '6f1c7a3e-5b0d-4d0a-9d52-3c7e8b1a2f64'

/**
 * The occurrence id one caught creature's sealed save runs under. Kernel request ids are built from the
 * occurrence id, so every creature of one area needs its own to keep its request ids apart.
 */
export function encounterAreaTargetOccurrenceId(areaOccurrenceId: string, actorId: string) {
  return uuidv5(`${areaOccurrenceId}:${actorId}:area-save`, encounterAreaNamespace)
}

/**
 * The entries of a list of chosen creatures, each with the occurrence its own commit runs under. A
 * creature named again (a second dart of Magic Missile) is a further entry with an occurrence of its
 * own; its first entry keeps the id it has when named once.
 */
export function encounterChosenActorEntries(areaOccurrenceId: string, actorIds: readonly string[]) {
  const named = new Map<string, number>()
  return actorIds.map((actorId) => {
    const ordinal = named.get(actorId) ?? 0
    named.set(actorId, ordinal + 1)
    return {
      actorId,
      occurrenceId:
        ordinal === 0
          ? encounterAreaTargetOccurrenceId(areaOccurrenceId, actorId)
          : uuidv5(`${areaOccurrenceId}:${actorId}:area-save:${ordinal}`, encounterAreaNamespace)
    }
  })
}

/**
 * The occurrence id the save of a creature a forced mover struck runs under (D159). The pair names
 * it, so a creature the area also caught, or that two movers struck, keeps the ids of its other entries.
 */
export function encounterCollisionSaveOccurrenceId(
  areaOccurrenceId: string,
  moverActorId: string,
  struckActorId: string
) {
  return uuidv5(
    `${areaOccurrenceId}:${moverActorId}:${struckActorId}:collision-save`,
    encounterAreaNamespace
  )
}

/** The command id a settled creature's receipt is stored under; it has no command of its own. */
export function encounterAreaTargetCommandId(targetOccurrenceId: string) {
  return uuidv5(`${targetOccurrenceId}:command`, encounterAreaNamespace)
}

type AreaContext = EncounterAreaActionPendingContextDto
type AreaTarget = AreaContext['targets'][number]

/** Seals the creatures a chosen-creature action named, whatever order they were named in. */
export function encounterChosenActorsChecksum(actorIds: readonly string[]) {
  return checksumRuleDocument({
    chosen: [...actorIds].sort((left, right) => left.localeCompare(right))
  })
}

/**
 * Seals the Scene facts that decided who the area caught: the Scene version, the picked origin and
 * shape, and each creature still caught with its token footprint. A later change to any of them, or
 * the GM removing a creature, yields a different checksum.
 */
export function encounterAreaCaughtChecksum(input: {
  scene: AreaContext['scene']
  area: AreaContext['area']
  /** Every sealed save; a creature a forced mover struck (D159) was not caught and is left out. */
  caught: readonly Pick<AreaContext['targets'][number], 'actorId' | 'token' | 'collision'>[]
}) {
  return checksumRuleDocument({
    scene: input.scene,
    area: input.area,
    caught: input.caught
      .filter(({ collision }) => collision === undefined)
      .map(({ actorId, token }) => ({ actorId, token }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId))
  })
}

/**
 * The GM takes one creature out of a pending area, with every unanswered roll aimed at it. A ray
 * already answered keeps its roll and settles with the area; a creature with no unanswered roll
 * cannot go. The checksum is sealed again over those still caught. A creature only a forced mover
 * struck (D159) was not caught, and its save stays.
 */
export function removeEncounterAreaTarget<
  Target extends Pick<AreaContext['targets'][number], 'actorId' | 'token' | 'collision'> & {
    testedJson?: string
    rolledJson?: string
  }
>(
  context: Pick<AreaContext, 'scene' | 'area' | 'removedActorIds'> & {
    targets: Target[]
  },
  actorId: string
):
  | { kind: 'NOT_CAUGHT' | 'ANSWERED' }
  | {
      kind: 'REMOVED'
      targets: Target[]
      removedActorIds: string[]
      caughtChecksum: string
    } {
  const caught = context.targets.filter(
    (target) => target.actorId === actorId && target.collision === undefined
  )
  if (caught.length === 0) return { kind: 'NOT_CAUGHT' }
  const removed = caught.filter(
    (target) => target.testedJson === undefined && target.rolledJson === undefined
  )
  if (removed.length === 0) return { kind: 'ANSWERED' }
  const targets = context.targets.filter((target) => !removed.includes(target))
  return {
    kind: 'REMOVED',
    targets,
    removedActorIds: [...context.removedActorIds, ...removed.map(() => actorId)],
    caughtChecksum: encounterAreaCaughtChecksum({
      scene: context.scene,
      area: context.area,
      caught: targets
    })
  }
}

function requireAreaContext(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  const { applicationContext } = snapshot
  if (applicationContext.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The snapshot is not a pending area action.')
  return applicationContext
}

/**
 * The area snapshot with the creature taken out, or why it cannot be. The caught set is sealed
 * again, so an answer or removal composed against the earlier set is stale.
 */
export function removeEncounterAreaTargetFromSnapshot(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  actorId: string
):
  | { kind: 'NOT_CAUGHT' | 'ANSWERED' }
  | { kind: 'REMOVED'; snapshot: ServerAggregateChoicePendingSnapshotDto } {
  const applicationContext = requireAreaContext(snapshot)
  const removal = removeEncounterAreaTarget(applicationContext, actorId)
  if (removal.kind !== 'REMOVED') return removal
  return {
    kind: 'REMOVED',
    snapshot: serverAggregateChoicePendingSnapshotDtoSchema.parse({
      ...snapshot,
      applicationContext: {
        ...applicationContext,
        targets: removal.targets,
        removedActorIds: removal.removedActorIds,
        caughtChecksum: removal.caughtChecksum
      }
    })
  }
}

/**
 * An area settles once every creature it keeps has answered its save and every Legendary Resistance
 * offer is decided. An area that keeps no creature is settled.
 */
export function encounterAreaSettled(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  return requireAreaContext(snapshot).targets.every(targetSettled)
}

const targetSettled = (target: AreaTarget) =>
  target.testedJson !== undefined &&
  (target.legendaryResistance === undefined || target.legendaryResistance.decision !== undefined)

type SaveProgress = Pick<AreaTarget, 'rolledJson' | 'testedJson' | 'snapshot'>

/** Whether a creature's roll is kept, waiting on its d20 window to settle (D168). */
const awaitingWindow = (target: SaveProgress) =>
  target.rolledJson !== undefined && target.testedJson === undefined

/** Whether the window of a creature whose roll is kept is the one open now. */
const windowOpen = (target: SaveProgress) =>
  awaitingWindow(target) &&
  target.snapshot.applicationContext.kind === 'ENCOUNTER_ACTION' &&
  target.snapshot.applicationContext.pause?.kind === 'ROLL_WINDOW'

/** Whether a creature has been neither rolled nor settled: its roller still owes the save. */
const awaitingRoll = (target: SaveProgress) =>
  target.rolledJson === undefined && target.testedJson === undefined

type SaveList = Pick<AreaContext, 'casterActorId'> & { targets: readonly SaveProgress[] }

/**
 * The offer a ray's roll is held on while a creature answers it (D219), whatever came of it: its
 * rolled d20, offered to each creature that may react to it, or its hit, offered to the creature it hit.
 */
const rayReactionOffer = (target: Pick<SaveProgress, 'snapshot'>) => {
  const context = target.snapshot.applicationContext
  return context.kind === 'ENCOUNTER_ACTION' &&
    context.pause?.kind === 'CAST_REACTION' &&
    (context.pause.payload.kind === 'ATTACK_ROLL_BY_OTHER' ||
      context.pause.payload.kind === 'HIT_BY_ATTACK')
    ? context
    : null
}

/** Whether a ray's hit is held on its caster's on-hit rider offer, whatever came of it. */
const heldOnHitOffer = (target: Pick<SaveProgress, 'snapshot'>) => {
  const context = target.snapshot.applicationContext
  return context.kind === 'ENCOUNTER_ACTION' && context.pause?.kind === 'ON_HIT'
}

/** Whether a ray is held on a choice made between its roll and its outcome: the reactions to its d20 and to its hit, then its rider. */
const heldOnHitChoice = (target: Pick<SaveProgress, 'snapshot'>) =>
  rayReactionOffer(target) !== null || heldOnHitOffer(target)

/**
 * Whether the area's caster makes the entry's roll, as for an attack roll at a creature. A ray held
 * on a reaction offer is still the caster's roll, though the creature that may react answers the offer.
 */
const casterRolls = (area: SaveList, target: SaveProgress) =>
  rayReactionOffer(target) !== null ||
  (target.snapshot.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    target.snapshot.applicationContext.rollerActorId === area.casterActorId)

/**
 * Whether an entry waits its turn: a caster makes the rolls of a list one at a time, in the order
 * the creatures were named, so a ray is rolled only once every ray before it is answered.
 */
const awaitingTurn = (area: SaveList, target: SaveProgress) =>
  casterRolls(area, target) &&
  area.targets
    .slice(0, area.targets.indexOf(target))
    .some((earlier) => casterRolls(area, earlier) && earlier.testedJson === undefined)

/**
 * What an entry of `area` waits on from its roller: its roll, the choice at its open d20 window, the
 * decision its ray is held on (a reaction to its rolled d20 or of the creature it hit, D219, then its caster's
 * on-hit rider), or nothing (settled, rolled and waiting its turn at the window, a ray behind an
 * unanswered one, or a ray whose chosen reaction is running as a child action).
 */
export const encounterAreaSaveAwaiting = (area: SaveList, target: SaveProgress) => {
  if (awaitingTurn(area, target)) return null
  if (target.testedJson === undefined && heldOnHitChoice(target))
    return rayReactionOffer(target)?.reactionChildren?.some(
      ({ resumeOutcome }) => resumeOutcome === undefined
    )
      ? null
      : 'DECISION'
  return awaitingRoll(target) ? 'ROLL' : windowOpen(target) ? 'WINDOW' : null
}

/**
 * The ray of `snapshot` that is held: on a reaction offer of its roll or its hit (D219), answered or awaiting its
 * child, or on its caster's on-hit rider offer; null if none.
 */
export function encounterAreaHeldRay(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  return (
    requireAreaContext(snapshot).targets.find(
      (target) => target.testedJson === undefined && heldOnHitChoice(target)
    ) ?? null
  )
}

/**
 * The save whose d20 window opens next, or null: windows open one at a time, once every save is
 * rolled, for the creature acting earliest in `order` (the first of a creature named twice). A
 * creature outside `order` opens after those inside it.
 */
export function nextEncounterAreaWindowRequestId(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  order: readonly string[]
) {
  const { targets } = requireAreaContext(snapshot)
  if (targets.some((target) => awaitingRoll(target) || windowOpen(target))) return null
  const rank = (target: AreaTarget) => {
    const index = order.indexOf(target.actorId)
    return index < 0 ? order.length : index
  }
  const next = targets
    .filter(awaitingWindow)
    .reduce<AreaTarget | null>(
      (earliest, target) => (earliest && rank(earliest) <= rank(target) ? earliest : target),
      null
    )
  return next?.snapshot.request.requestId ?? null
}

/**
 * Records that the roller of the save with `requestId` rolled, and holds dice that may still change
 * the roll after it. The roll is kept to open its d20 window with; the save is not settled.
 */
export function markEncounterAreaSaveRolled(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  rolledJson: string
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const rolled = applicationContext.targets.find(
    (target) => target.snapshot.request.requestId === requestId
  )
  if (!rolled || encounterAreaSaveAwaiting(applicationContext, rolled) !== 'ROLL')
    throw new Error('This area save is not awaiting a roll.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) =>
        target === rolled ? { ...target, rolledJson } : target
      )
    }
  })
}

/**
 * Opens the d20 window of the rolled save with `requestId`: the save is paused on `window`, which
 * freezes the roll that was kept. No other window is open.
 */
export function openEncounterAreaSaveWindow(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  window: AreaTarget['snapshot']
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const rolled = applicationContext.targets.find(
    (target) => target.snapshot.request.requestId === requestId
  )
  if (
    !rolled ||
    !awaitingWindow(rolled) ||
    applicationContext.targets.some(windowOpen) ||
    window.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    window.applicationContext.pause?.kind !== 'ROLL_WINDOW'
  )
    throw new Error('This area save has no d20 window to open.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) =>
        target === rolled ? { ...target, snapshot: window } : target
      )
    }
  })
}

/**
 * Holds the ray with `requestId` on `hold`, an offer its roll raised: the ray stays unanswered while
 * each creature that may react to its d20, then the creature it hit, answers a reaction offer (D219),
 * then while its caster answers the on-hit
 * rider offer. The same ray is held again as the reaction offer records the child action of the
 * reaction chosen from it, and as the resume from that child resolves it. Every other entry stays
 * exactly as sealed, except that a chosen reaction keeps, with each answered ray in `testBindings`
 * (by occurrence), the facts its roll was made against: the child action is about to change them,
 * and that roll replays against the creature as it stood.
 */
export function holdEncounterAreaRay(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  hold: AreaTarget['snapshot'],
  testBindings: ReadonlyMap<string, string> = new Map()
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const held = applicationContext.targets.find(
    (target) => target.snapshot.request.requestId === requestId
  )
  if (
    !held ||
    held.testedJson !== undefined ||
    held.rolledJson !== undefined ||
    !casterRolls(applicationContext, held) ||
    awaitingTurn(applicationContext, held) ||
    hold.occurrenceId !== held.snapshot.occurrenceId ||
    !heldOnHitChoice({ snapshot: hold }) ||
    // A hit is offered its rider once its reaction is past, never the other way round.
    (heldOnHitOffer(held) && !heldOnHitOffer({ snapshot: hold }))
  )
    throw new Error('This ray has no hit to hold.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) => {
        if (target === held) return { ...target, snapshot: hold }
        const testBindingJson =
          target.testedJson === undefined || target.testBindingJson !== undefined
            ? undefined
            : testBindings.get(target.snapshot.occurrenceId)
        return testBindingJson === undefined ? target : { ...target, testBindingJson }
      })
    }
  })
}

/**
 * Seals every entry again once a reaction's child action changed the Run under the pending list
 * (D219): each entry keeps its place, its occurrence and its answer, and takes the sealed roll
 * prepared against the creatures as that child left them.
 */
export function resealEncounterAreaTargets(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  sealed: readonly AreaTarget['snapshot'][]
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  if (
    sealed.length !== applicationContext.targets.length ||
    applicationContext.targets.some(
      (target, index) => target.snapshot.occurrenceId !== sealed[index]!.occurrenceId
    )
  )
    throw new Error('A pending list is sealed again entry for entry.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target, index) => ({
        ...target,
        snapshot: sealed[index]!
      }))
    }
  })
}

/**
 * Records that the roller of the roll with `requestId` answered it, keeping what settles the area
 * without rolling again: the answer, the dice a save's TEST rolled after the d20 or a ray's whole
 * roll tape with what its caster decided at its on-hit offer, and the Legendary Resistance offered
 * if the save failed. The other rolls, the caught set and its checksum stay exactly as sealed.
 */
export function markEncounterAreaSaveTested(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  {
    testedJson,
    legendaryResistance,
    testDice,
    rolls,
    onHit
  }: { testedJson: string } & Pick<
    AreaTarget,
    'legendaryResistance' | 'testDice' | 'rolls' | 'onHit'
  >
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const answered = applicationContext.targets.find(
    (target) => target.snapshot.request.requestId === requestId
  )
  if (!answered || answered.testedJson !== undefined || awaitingTurn(applicationContext, answered))
    throw new Error('This area save is not awaiting an answer.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) =>
        target === answered
          ? {
              ...target,
              testedJson,
              ...(testDice?.length ? { testDice } : {}),
              ...(rolls?.length ? { rolls } : {}),
              ...(onHit ? { onHit } : {}),
              ...(legendaryResistance ? { legendaryResistance } : {})
            }
          : target
      )
    }
  })
}

/**
 * Records one creature's Legendary Resistance decision on its offer; every other target, the caught
 * set and its checksum stay exactly as sealed. A creature decides once.
 */
export function markEncounterAreaLegendaryResistanceDecided(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  actorId: string,
  decided: NonNullable<AreaTarget['legendaryResistance']>
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  // A creature a mover struck is caught twice; its choices are decided in the order they were offered.
  const offered = applicationContext.targets.find(
    (target) =>
      target.actorId === actorId &&
      target.legendaryResistance &&
      !target.legendaryResistance.decision
  )
  if (!offered)
    throw new Error('This creature has no Legendary Resistance choice awaiting a decision.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: applicationContext.targets.map((target) =>
        target === offered ? { ...target, legendaryResistance: decided } : target
      )
    }
  })
}

type ForcedMovementPick = NonNullable<NonNullable<AreaContext['forcedMovement']>['pick']>

const sealedRays = <Ray>(rays: readonly Ray[] | undefined) => (rays?.length ? { rays } : {})

/**
 * The settled area holding the push pick it owes next (D157), after the landings picked so far. The
 * request is named for the creature, which is picked once.
 */
export function holdEncounterAreaForcedMovement(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  pick: Pick<ForcedMovementPick, 'targetActorId' | 'positions'>,
  rays?: NonNullable<NonNullable<AreaContext['forcedMovement']>['rays']>
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  if (!encounterAreaSettled(snapshot) || applicationContext.forcedMovement?.pick)
    throw new Error('Only a settled area with no pick open holds a push pick.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      forcedMovement: {
        landed: applicationContext.forcedMovement?.landed ?? [],
        // The first hold seals the rays; a later hold keeps them.
        ...sealedRays(applicationContext.forcedMovement?.rays ?? rays),
        pick: {
          requestId: `forced-movement:${pick.targetActorId}`,
          targetActorId: pick.targetActorId,
          positions: pick.positions
        }
      }
    }
  })
}

type AreaDamageRoll = NonNullable<AreaContext['damageRoll']>

/**
 * The settled area holding its one shared damage roll for the caster's window (D208): the frozen
 * roll tape every creature's outcome replays and the window opened on it. It opens before any push
 * pick, once.
 */
export function holdEncounterAreaDamageRoll(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  rolls: AreaDamageRoll['rolls'],
  window: ServerKernelRuleExecutionPendingSnapshotDto
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  if (
    !encounterAreaSettled(snapshot) ||
    applicationContext.damageRoll ||
    applicationContext.forcedMovement
  )
    throw new Error('Only a settled area with no damage roll or push held holds a damage roll.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: { ...applicationContext, damageRoll: { rolls, window } }
  })
}

/** The damage window an area holds open, with the roll it froze (D208). */
export function encounterAreaDamageRollWindow(applicationContext: AreaContext) {
  const window = applicationContext.damageRoll?.window
  const context = window?.applicationContext
  const pause = context?.kind === 'ENCOUNTER_ACTION' ? context.pause : undefined
  return window && pause?.kind === 'ROLL_WINDOW' && isDamageRollWindow(pause.payload)
    ? { window, payload: pause.payload }
    : null
}

/**
 * The area's roll tape once its caster rerolled some damage dice (D208): each die is found on the
 * tape by its place among the frozen roll's evidence, and its new face is kept on the tape's
 * zero-based scale.
 */
export function rerolledEncounterAreaRolls(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  rerolled: readonly { requestId: string; value: number }[]
): AreaDamageRoll['rolls'] {
  const applicationContext = requireAreaContext(snapshot)
  const open = encounterAreaDamageRollWindow(applicationContext)
  const rolls = applicationContext.damageRoll?.rolls
  if (!open || !rolls) throw new Error('The area holds no damage roll window.')
  const evidence = areaRollEvidence(open.payload, rolls)
  return rolls.map((roll, index) => {
    const { requestId, value } = evidence[index]!
    const face = rerolled.find((die) => die.requestId === requestId)?.value
    if (face === undefined) return roll
    const rerolledValue = face - (value - roll.value)
    if (rerolledValue < 0 || rerolledValue >= roll.maximum)
      throw new Error('A rerolled area damage die is outside its roll.')
    return { maximum: roll.maximum, value: rerolledValue }
  })
}

const areaRollEvidence = (payload: DamageRollWindowPayloadDto, rolls: AreaDamageRoll['rolls']) => {
  const evidence = payload.damage.execution.evidence.trace.flatMap(({ evidence }) =>
    evidence ? [evidence] : []
  )
  if (evidence.length !== rolls.length)
    throw new Error('The area damage roll window evidence is stale.')
  return evidence
}

/**
 * The area once its caster answered the damage window (D208): the window is closed, the tape keeps
 * the rerolled dice and the cost they paid. Only dice the window offered may change, at most as many
 * as the paid option allows, and a decline changes none.
 */
export function decideEncounterAreaDamageRoll(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  rolls: AreaDamageRoll['rolls'],
  reroll: DamageRerollCostDto | null
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const open = encounterAreaDamageRollWindow(applicationContext)
  const frozen = applicationContext.damageRoll?.rolls
  if (!open || !frozen || rolls.length !== frozen.length)
    throw new Error('The area damage roll decision is stale.')
  const evidence = areaRollEvidence(open.payload, frozen)
  const offered = new Set(open.payload.damage.dice.map(({ requestId }) => requestId))
  const changed = rolls.flatMap((roll, index) =>
    roll.maximum !== frozen[index]!.maximum
      ? [null]
      : roll.value === frozen[index]!.value
        ? []
        : [evidence[index]!.requestId]
  )
  const option = reroll
    ? open.payload.offer.options.find(
        ({ modifierId, poolId, cost }) =>
          modifierId === reroll.modifierId && poolId === reroll.poolId && cost === reroll.cost
      )
    : null
  if (
    option === undefined ||
    changed.length > (option?.maxDice ?? 0) ||
    changed.some((requestId) => requestId === null || !offered.has(requestId))
  )
    throw new Error('The area damage reroll was not offered.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      damageRoll: { rolls, ...(reroll ? { reroll } : {}) }
    }
  })
}

/**
 * Whether every creature the area caught has answered its save and decided its Legendary Resistance
 * offer. The saves of creatures a forced mover struck (D159) are opened after this, so they are left out.
 */
export function encounterAreaCaughtSettled(snapshot: ServerAggregateChoicePendingSnapshotDto) {
  return requireAreaContext(snapshot)
    .targets.filter(({ collision }) => !collision)
    .every(targetSettled)
}

/**
 * The settled area holding the saves of the creatures its forced movers struck (D159), after the
 * movers landed. The landings so far and the rays stay as sealed; the first hold seals the rays.
 */
export function holdEncounterAreaCollisionSaves(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  struck: readonly AreaTarget[],
  rays?: NonNullable<NonNullable<AreaContext['forcedMovement']>['rays']>
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  if (
    !encounterAreaSettled(snapshot) ||
    applicationContext.forcedMovement?.pick ||
    applicationContext.targets.some(({ collision }) => collision) ||
    struck.some(({ collision }) => !collision)
  )
    throw new Error(
      'Only a settled area with no pick or collision save open holds collision saves.'
    )
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      targets: [...applicationContext.targets, ...struck],
      forcedMovement: {
        landed: applicationContext.forcedMovement?.landed ?? [],
        ...sealedRays(applicationContext.forcedMovement?.rays ?? rays)
      }
    }
  })
}

/** The area with its open push pick answered: the creature lands on `position`, one it offered. */
export function landEncounterAreaForcedMovement(
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  requestId: string,
  position: { x: number; y: number }
): ServerAggregateChoicePendingSnapshotDto {
  const applicationContext = requireAreaContext(snapshot)
  const { pick, landed = [], rays } = applicationContext.forcedMovement ?? {}
  if (
    pick?.requestId !== requestId ||
    !pick.positions.some(({ x, y }) => x === position.x && y === position.y)
  )
    throw new Error('This forced-movement destination is not on offer.')
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    ...snapshot,
    applicationContext: {
      ...applicationContext,
      forcedMovement: {
        landed: [...landed, { targetActorId: pick.targetActorId, position }],
        ...sealedRays(rays)
      }
    }
  })
}
/** The pending occurrence of a point-area action: one sealed save per caught creature. */
export function buildEncounterAreaPendingSnapshot(
  input: Omit<AreaContext, 'kind' | 'schemaVersion' | 'caughtChecksum' | 'removedActorIds'> & {
    occurrenceId: string
    optionalCombatSnapshotChecksum: string | null | undefined
  }
): ServerAggregateChoicePendingSnapshotDto {
  const { occurrenceId, optionalCombatSnapshotChecksum, ...context } = input
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId,
    optionalCombatSnapshotChecksum,
    applicationContext: {
      ...context,
      kind: 'ENCOUNTER_AREA_ACTION',
      schemaVersion: 1,
      caughtChecksum: encounterAreaCaughtChecksum({
        ...context,
        caught: context.targets
      }),
      removedActorIds: []
    }
  })
}
