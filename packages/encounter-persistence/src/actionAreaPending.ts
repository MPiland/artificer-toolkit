import {
  actionAreaSceneRequestDtoSchema,
  areaActionTargetOrigin,
  resolveEncounterActionInputDtoSchema,
  type ActionAreaSceneRequestDto,
  type AreaActionTargetDto,
  type ResolveEncounterActionInputDto,
  type ResolveEncounterActionTargetDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterAreaActionPendingContextDto,
  ServerAggregateChoicePendingSnapshotDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { catchEncounterAreaActorIds } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  decideEncounterAreaDamageRoll,
  encounterAreaCaughtChecksum,
  encounterAreaDamageRollWindow,
  holdEncounterAreaDamageRoll,
  holdEncounterAreaForcedMovement,
  landEncounterAreaForcedMovement,
  markEncounterAreaLegendaryResistanceDecided,
  holdEncounterAreaCollisionSaves,
  encounterAreaSaveAwaiting,
  markEncounterAreaSaveRolled,
  markEncounterAreaSaveTested,
  holdEncounterAreaRay,
  openEncounterAreaSaveWindow,
  removeEncounterAreaTargetFromSnapshot,
  resealEncounterAreaTargets
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  castPendingContinues,
  heldActionContinues,
  projectNativeActionPending,
  sameGate
} from './actionPending.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import {
  awaitsReactionChild,
  heldRootVersionAccounted,
  reactionChildrenKept
} from './reactionChildren.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

type AreaSceneContext = Extract<
  LiveSessionEncounterRulesResponse,
  { kind: 'ACTION_AREA_SCENE' }
>['context']
/** A command that reaches several creatures: a point area, or a list of chosen creatures. */
type AreaCommand = Omit<
  Extract<ResolveEncounterActionInputDto, { type: 'RESOLVE_ACTION' }>,
  'target'
> & {
  target: AreaActionTargetDto | Extract<ResolveEncounterActionTargetDto, { kind: 'ACTORS' }>
}

/** The area occurrence's own snapshot narrowed to its aggregate context. */
export function areaActionPendingContext(snapshot: ServerRuleExecutionPendingSnapshotDto) {
  return snapshot.snapshotKind === 'AGGREGATE_CHOICE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_AREA_ACTION'
    ? snapshot.applicationContext
    : null
}

/**
 * Whether the sealed area is the one the command aimed: the same origin and, if directed, direction,
 * a wall's other endpoint or a ring's outer radius.
 * A caster-centered command aims nothing; its origin is the caster's token, checked against the Scene.
 */
export function areaMatchesTarget(
  area: NonNullable<EncounterAreaActionPendingContextDto['area']>,
  target: AreaActionTargetDto
) {
  if (target.kind === 'CASTER_CENTERED')
    return area.shape.kind === 'RADIUS' || area.shape.kind === 'CUBE'
  const origin = areaActionTargetOrigin(target)
  const { shape } = area
  return (
    area.origin.x === origin.x &&
    area.origin.y === origin.y &&
    (target.kind === 'DIRECTED'
      ? 'toward' in shape &&
        shape.toward.x === target.toward.x &&
        shape.toward.y === target.toward.y
      : target.kind === 'WALL'
        ? shape.kind === 'WALL' && shape.to.x === target.to.x && shape.to.y === target.to.y
        : target.kind !== 'RING' ||
          (shape.kind === 'RING' && shape.outerRadius === target.outerRadius))
  )
}

/** The creatures the area still waits on or caught, each with its own sealed save. */
function areaTargets(context: EncounterAreaActionPendingContextDto) {
  return context.targets.map((target) => {
    const inner = target.snapshot.applicationContext
    if (inner.kind !== 'ENCOUNTER_ACTION') throw new Error('Stored area save is invalid.')
    return {
      actorId: target.actorId,
      token: target.token,
      snapshot: target.snapshot,
      context: inner,
      testedJson: target.testedJson,
      rolledJson: target.rolledJson,
      legendaryResistance: target.legendaryResistance,
      collision: target.collision
    }
  })
}

/**
 * Whether the caster of the pending area `occurrenceId` perceives `actorId`, as sealed when the area
 * opened. True for anything that is not a creature of a pending area.
 */
export async function readAreaTargetPerceivedByCaster(
  ctx: EncounterReadContext,
  occurrenceId: string,
  actorId: string
) {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
    .unique()
  const snapshot =
    occurrence?.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  const context = snapshot && areaActionPendingContext(snapshot)
  return context?.targets.find((target) => target.actorId === actorId)?.perceivedByCaster ?? true
}

/** Reads the sealed area root and checks it against its occurrence and root command. */
export async function readNativeAreaActionPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  const snapshot =
    occurrence.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  const context = snapshot && areaActionPendingContext(snapshot)
  if (!snapshot || !context || snapshot.occurrenceId !== occurrence.id)
    throw new Error('Stored Encounter area action pending snapshot mismatch.')
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.target.kind === 'ACTOR' ||
    command.commandId !== occurrence.rootCommandId ||
    command.encounterId !== occurrence.encounterId ||
    // The saves open at the Run version the reactions to the cast left (D219): one past the root
    // for each that committed while the cast was held.
    !(await heldRootVersionAccounted(ctx, {
      occurrence,
      rootExpectedVersion: command.expectedVersion,
      recorded: []
    })) ||
    checksumCanonicalJson(command) !== context.commandFingerprint
  )
    throw new Error('Stored Encounter area action root mismatch.')
  return { snapshot, context, command, targets: areaTargets(context) }
}

/**
 * Verifies a freshly planned area root before it is stored: the root belongs to the admitted
 * command, every save's sealed continuation shares it, and the Scene still catches exactly the
 * creatures it was sealed with. A list of chosen creatures seals exactly the creatures it names, each
 * one standing where the Scene says, and inside the area if it names one.
 */
export async function requireAreaActionPendingRoot(
  input: {
    snapshot: ServerRuleExecutionPendingSnapshotDto
    command: AreaCommand
    fingerprint: string
    initiatorUserId: string
    state: EncounterRunState
  },
  readAreaSceneInputs: (
    state: EncounterRunState,
    request: ActionAreaSceneRequestDto
  ) => Promise<AreaSceneContext>
) {
  const { snapshot, command, state } = input
  const { target } = command
  const context = areaActionPendingContext(snapshot)
  // The Scene the command was aimed in, and the point it picked there, if any.
  const aimed = target.kind === 'ACTORS' ? target.scene : target
  const pointed =
    target.kind === 'ACTORS'
      ? target.scene?.point
        ? ({ kind: 'POINT', ...target.scene, point: target.scene.point } as const)
        : null
      : target
  if (
    !context ||
    context.initiatorUserId !== input.initiatorUserId ||
    context.commandFingerprint !== input.fingerprint ||
    checksumCanonicalJson(JSON.parse(context.commandJson)) !== input.fingerprint ||
    context.casterActorId !== command.actorId ||
    context.scene?.sceneId !== aimed?.sceneId ||
    context.scene?.sceneVersion !== aimed?.expectedSceneVersion ||
    (pointed === null
      ? context.area !== null
      : context.area === null || !areaMatchesTarget(context.area, pointed)) ||
    snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
    !state.actorIds.includes(context.casterActorId)
  )
    throw new Error('Live Session pending area action root mismatch.')
  const targets = areaTargets(context)
  for (const sealedTarget of targets)
    if (
      !state.actorIds.includes(sealedTarget.actorId) ||
      sealedTarget.context.commandJson !== context.commandJson ||
      sealedTarget.snapshot.graph.source.gameSystemId !== state.gameSystemId ||
      sealedTarget.snapshot.deferredCleaving !== undefined ||
      sealedTarget.context.contest !== undefined
    )
      throw new Error('Live Session pending area action root mismatch.')
  // A creature the GM removed, or one the action has no effect on (immune to this source's use of
  // it, D156, or of a creature type it excludes), is still caught by the area; it is simply not tested.
  // A creature a forced mover struck (D159) was not caught, so it is not among them.
  const sealed = [
    ...targets.filter(({ collision }) => !collision).map((sealedTarget) => sealedTarget.actorId),
    ...context.removedActorIds,
    ...(context.unaffectedActorIds ?? [])
  ]
  // A creature named for several rays is sealed once for each.
  if (
    target.kind === 'ACTORS' &&
    (sealed.length !== target.actorIds.length ||
      !target.actorIds.every(
        (actorId) =>
          sealed.filter((sealedId) => sealedId === actorId).length ===
          target.actorIds.filter((namedId) => namedId === actorId).length
      ))
  )
    throw new Error('Live Session pending area action root mismatch.')
  const scene = aimed
    ? await readAreaSceneInputs(
        state,
        actionAreaSceneRequestDtoSchema.parse({
          actorId: command.actorId,
          sceneId: aimed.sceneId,
          expectedSceneVersion: aimed.expectedSceneVersion
        })
      )
    : null
  const centered = target.kind === 'CASTER_CENTERED'
  const casterToken = scene?.tokens.find((token) => token.actorId === context.casterActorId)
  if (
    centered &&
    (casterToken?.position.x !== context.area?.origin.x ||
      casterToken?.position.y !== context.area?.origin.y)
  )
    throw new Error('Live Session pending area action Scene mismatch.')
  // A point area catches everyone in it (a summon catches nobody, nor does a zone unless its cast
  // authors a save for when it appears: a creature in it is tested on entering), where a list of
  // chosen creatures only needs each of them inside it.
  const caught = new Set(
    scene &&
      context.area &&
      !context.placesSummon &&
      (!context.placesZone || context.zoneAppearSave)
      ? catchEncounterAreaActorIds({
          origin: context.area.origin,
          shape: context.area.shape,
          casterActorId: context.casterActorId,
          tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId })),
          fromCasterSpace: centered
        })
      : []
  )
  const reachesCaught =
    target.kind === 'ACTORS'
      ? context.area === null || sealed.every((actorId) => caught.has(actorId))
      : caught.size === sealed.length && sealed.every((actorId) => caught.has(actorId))
  const footprintsMatch = targets.every((sealedTarget) => {
    const token = scene?.tokens.find((candidate) => candidate.actorId === sealedTarget.actorId)
    return token === undefined
      ? sealedTarget.token === null
      : checksumCanonicalJson({
          tokenId: token.tokenId,
          position: token.position,
          width: token.width,
          height: token.height,
          rotationDegrees: token.rotationDegrees
        }) === checksumCanonicalJson(sealedTarget.token)
  })
  if (
    scene?.sceneId !== context.scene?.sceneId ||
    scene?.sceneVersion !== context.scene?.sceneVersion ||
    !footprintsMatch ||
    !reachesCaught ||
    encounterAreaCaughtChecksum({
      scene: context.scene,
      area: context.area,
      caught: targets
    }) !== context.caughtChecksum
  )
    throw new Error('Live Session pending area action Scene mismatch.')
  return context
}

/**
 * The area holding what `next` opens once the saves settle, if anything: the caster's damage window
 * (D208) that the answer settling an area opens first, the push pick (D157) that the settling answer
 * or the damage window's answer may open and each landing the next one, or, once every mover landed,
 * the saves of the creatures they struck (D159).
 */
function withOpenedHold(
  area: ServerAggregateChoicePendingSnapshotDto,
  next: ServerRuleExecutionPendingSnapshotDto
) {
  const opened = areaActionPendingContext(next)
  const damageRoll = opened?.damageRoll
  if (damageRoll?.window && !areaActionPendingContext(area)?.damageRoll)
    return holdEncounterAreaDamageRoll(area, damageRoll.rolls, damageRoll.window)
  const struck = opened?.targets.filter(({ collision }) => collision) ?? []
  if (
    struck.length > 0 &&
    !areaActionPendingContext(area)?.targets.some(({ collision }) => collision)
  )
    return holdEncounterAreaCollisionSaves(area, struck, opened?.forcedMovement?.rays)
  const pick = opened?.forcedMovement?.pick
  return pick ? holdEncounterAreaForcedMovement(area, pick, opened.forcedMovement?.rays) : area
}

type SealedAreaTarget = EncounterAreaActionPendingContextDto['targets'][number]

/**
 * The reaction offer a ray's own snapshot holds its roll on, if it holds one: of its aim at its
 * creature, made before its d20 to each creature that may react to it (D217), of its rolled d20,
 * made to each of those in turn, or of its hit, made to the creature it hit (D219).
 */
const reactionOfferOf = (target: SealedAreaTarget | undefined) => {
  const context = target?.snapshot.applicationContext
  const offer =
    context?.kind === 'ENCOUNTER_ACTION' && context.pause?.kind === 'CAST_REACTION'
      ? context.pause.payload
      : null
  return offer?.kind === 'ATTACK_ON_OTHER' || offer?.rolled || offer?.hit ? offer : null
}

type RayReactionOffer = ReturnType<typeof reactionOfferOf>

/** Whether a ray's reaction offer is of its aim: made before its d20, so it keeps no roll. */
const aimOffer = (offer: RayReactionOffer) => offer != null && !offer.rolled && !offer.hit

/** Whether a ray is held on the first offer of its aim: nobody heard yet, no child recorded. */
const heldOnFreshAim = (target: SealedAreaTarget) => {
  const offer = reactionOfferOf(target)
  const context = target.snapshot.applicationContext
  return (
    target.testedJson === undefined &&
    aimOffer(offer) &&
    offer?.declinedReactorActorIds.length === 0 &&
    context.kind === 'ENCOUNTER_ACTION' &&
    context.reactionChildren === undefined
  )
}

/** What a ray's reaction offer keeps of its roll: the rolled d20 or the hit. */
const keptRollOf = (offer: RayReactionOffer) => [offer?.rolled ?? null, offer?.hit ?? null]

/** The faces of the d20 a ray's reaction offer keeps. */
const keptFacesOf = (offer: RayReactionOffer) =>
  offer?.hit?.originalD20.rawFaces ?? offer?.rolled?.test.d20.rawFaces ?? null

/** Whether a ray still waits at a reaction offer its roll raised. */
const heldOnHitReaction = (target: SealedAreaTarget) =>
  target.testedJson === undefined && reactionOfferOf(target) !== null

/** The on-hit rider offer a ray's own snapshot holds its hit on, if it holds one. */
const onHitOfferOf = (target: SealedAreaTarget | undefined) => {
  const context = target?.snapshot.applicationContext
  return context?.kind === 'ENCOUNTER_ACTION' && context.pause?.kind === 'ON_HIT'
    ? context.pause.payload
    : null
}

/** Whether a ray still waits at the on-hit rider offer its hit raised. */
const heldOnHitRider = (target: SealedAreaTarget) =>
  target.testedJson === undefined && onHitOfferOf(target) !== null

/** Whether a ray still waits at an offer its hit raised: its creature's reaction, then its caster's rider. */
const heldOnHit = (target: SealedAreaTarget) => heldOnHitReaction(target) || heldOnHitRider(target)

/** The incoming gate a ray's own snapshot holds its caster's roll on, if it holds one. */
const gateOfferOf = (target: SealedAreaTarget | undefined) => {
  const context = target?.snapshot.applicationContext
  return context?.kind === 'ENCOUNTER_ACTION' && context.pause?.kind === 'INCOMING_GATE'
    ? context.pause.payload
    : null
}

/**
 * Whether a ray that waited its turn is now held on the gate of its creature: the same ray, about
 * creatures that stand as they did, which had passed no gate and was held on nothing.
 */
const heldOnFreshGate = (before: SealedAreaTarget | undefined, after: SealedAreaTarget) => {
  const previous = before?.snapshot.applicationContext
  const context = after.snapshot.applicationContext
  return (
    gateOfferOf(after) !== null &&
    before?.testedJson === undefined &&
    after.testedJson === undefined &&
    previous?.kind === 'ENCOUNTER_ACTION' &&
    context.kind === 'ENCOUNTER_ACTION' &&
    previous.pause === undefined &&
    previous.passedIncomingGate === undefined &&
    before?.snapshot.occurrenceId === after.snapshot.occurrenceId &&
    context.currentnessChecksum === previous.currentnessChecksum
  )
}

/**
 * Whether a ray that waited its turn is now sealed for its caster's roll past the gate of its
 * creature, which a roll made for its caster passed: the same ray, about creatures that stand as
 * they did, which had passed no gate and was held on nothing.
 */
const sealedPastFreshGate = (
  before: SealedAreaTarget,
  after: SealedAreaTarget,
  casterActorId: string
) => {
  const previous = before.snapshot.applicationContext
  const context = after.snapshot.applicationContext
  return (
    before.testedJson === undefined &&
    after.testedJson === undefined &&
    previous.kind === 'ENCOUNTER_ACTION' &&
    context.kind === 'ENCOUNTER_ACTION' &&
    previous.pause === undefined &&
    previous.passedIncomingGate === undefined &&
    context.pause === undefined &&
    context.passedIncomingGate !== undefined &&
    context.rollerActorId === casterActorId &&
    context.currentnessChecksum === previous.currentnessChecksum &&
    after.snapshot.occurrenceId === before.snapshot.occurrenceId
  )
}

/** The list with the ray at `index` sealed again on `snapshot`, every other entry as it was. */
const resealAreaRay = (
  area: ServerAggregateChoicePendingSnapshotDto,
  index: number,
  snapshot: SealedAreaTarget['snapshot']
) =>
  resealEncounterAreaTargets(
    area,
    (areaActionPendingContext(area)?.targets ?? []).map((target, at) =>
      at === index ? snapshot : target.snapshot
    )
  )

/**
 * The list once the rays from `from` on took the turn an answered ray handed them, as `next` stores
 * them: each ray its caster's auto-rolled gate lost is answered by that roll and hands the turn on,
 * and the first ray not lost is held on its gate or on the first offer of its aim (D217), or sealed
 * again past the gate it passed. A ray that waits as it was sealed, and every ray behind it, is untouched.
 */
function withRaysBehindOpened(
  area: ServerAggregateChoicePendingSnapshotDto,
  stored: EncounterAreaActionPendingContextDto,
  next: EncounterAreaActionPendingContextDto,
  from: number
) {
  for (let index = from; index < next.targets.length; index += 1) {
    const sealed = stored.targets[index]!
    const opened = next.targets[index]!
    const requestId = sealed.snapshot.request.requestId
    if (sealed.testedJson !== undefined) return area
    if (opened.lost && opened.testedJson !== undefined) {
      area = markEncounterAreaSaveTested(area, requestId, {
        testedJson: opened.testedJson,
        lost: opened.lost
      })
      continue
    }
    if (heldOnFreshGate(sealed, opened) || heldOnFreshAim(opened))
      return holdEncounterAreaRay(area, requestId, opened.snapshot)
    return sealedPastFreshGate(sealed, opened, stored.casterActorId)
      ? resealAreaRay(area, index, opened.snapshot)
      : area
  }
  return area
}

/** A sealed ray without what its own steps write: its snapshot, its answer and what that answer rolled and decided. */
const rayIdentity = ({
  snapshot,
  testedJson: _testedJson,
  rolls: _rolls,
  testBindingJson: _testBindingJson,
  onHit: _onHit,
  lost: _lost,
  ...identity
}: SealedAreaTarget) => ({ ...identity, occurrenceId: snapshot.occurrenceId })

/**
 * Verifies the list a caster's roll of a ray's incoming gate stores. A failed roll loses the ray: it
 * is answered by that roll alone, on the gate it was offered, and the rays behind it go on in order,
 * each lost at its own gate or held on it or on the first offer of its aim. A passed roll seals the
 * ray again with the gate it passed, for its caster's attack roll or on the first offer of its aim,
 * about creatures that stand as they did. Nothing else of the list changes.
 */
function requireAreaActionRayGate(
  input: Parameters<typeof requireAreaActionAnswer>[0] & { at: number }
) {
  const stored = areaActionPendingContext(input.stored)
  const next = areaActionPendingContext(input.next)
  const before = stored?.targets[input.at]
  const after = next?.targets[input.at]
  const gate = gateOfferOf(before)
  const previous = before?.snapshot.applicationContext
  const context = after?.snapshot.applicationContext
  const kind = input.response?.resolution.kind
  const mismatch = () => new Error('Live Session pending area answer mismatch.')
  if (
    !stored ||
    !next ||
    !before ||
    !after ||
    !gate ||
    previous?.kind !== 'ENCOUNTER_ACTION' ||
    context?.kind !== 'ENCOUNTER_ACTION' ||
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE' ||
    stored.targets.length !== next.targets.length ||
    (kind !== 'ENTER_DICE' && kind !== 'SYSTEM_ROLL')
  )
    throw mismatch()
  const settled = after.lost?.gate ?? context.passedIncomingGate
  if (
    !settled ||
    !sameGate(gate, settled) ||
    settled.dc !== gate.dc ||
    settled.checkDefinitionId !== gate.checkDefinitionId
  )
    throw mismatch()
  let area: ServerAggregateChoicePendingSnapshotDto
  if (after.lost) {
    if (after.testedJson === undefined) throw mismatch()
    area = markEncounterAreaSaveTested(input.stored, input.requestId, {
      testedJson: after.testedJson,
      lost: after.lost
    })
    area = withRaysBehindOpened(area, stored, next, input.at + 1)
  } else {
    if (
      before.testedJson !== undefined ||
      after.testedJson !== undefined ||
      !castPendingContinues(previous, input.response, context) ||
      context.currentnessChecksum !== previous.currentnessChecksum ||
      !(context.pause === undefined
        ? context.rollerActorId === stored.casterActorId
        : heldOnFreshAim(after))
    )
      throw mismatch()
    area = resealAreaRay(input.stored, input.at, after.snapshot)
  }
  if (checksumCanonicalJson(input.next) !== checksumCanonicalJson(withOpenedHold(area, input.next)))
    throw mismatch()
}

/**
 * Verifies the list a ray's step stores when that step is about an offer its roll raised: the
 * reaction of each creature that may react to its aim before its d20 (D217), of each that may react
 * to its rolled d20, then of the creature it hit (D219), then its caster's on-hit rider. A ray that
 * leaves its aim's offers is sealed again for its caster's roll, which may be made in the same step. The ray's roll raised an offer; the creature asked declined, so the ray
 * is answered with the d20 the offer kept; it chose a reaction, so the ray stays held and records that
 * reaction's child; or the room resumed from the committed child, so the ray is answered and the
 * child's outcome is written. A decline or a resume of a rolled d20's offer may instead leave the ray
 * held on the next creature's offer of that d20 or on the offer of the hit it made, and a decline or
 * a resume may leave it held on its rider offer, for the same d20. The caster's answer to the
 * rider offer answers the ray and keeps the decision with it, on the offer as it was sealed. Nothing
 * else of the list changes but this: a ray answered before keeps its answer, its decision and, once
 * written, the facts it was rolled against; after a ray left its offers the rays behind may be
 * answered, the next of them held on its own hit; and only the resume, which follows a committed
 * child, seals the rays again to the creatures as that child left them.
 */
function requireAreaActionRayHit(
  input: Parameters<typeof requireAreaActionAnswer>[0] & { at: number }
) {
  const stored = areaActionPendingContext(input.stored)
  const next = areaActionPendingContext(input.next)
  const { at, resume, response } = input
  const mismatch = () => new Error('Live Session pending area answer mismatch.')
  const before = stored?.targets[at]
  const after = next?.targets[at]
  const previous = before?.snapshot.applicationContext
  const context = after?.snapshot.applicationContext
  if (
    !stored ||
    !next ||
    !before ||
    !after ||
    previous?.kind !== 'ENCOUNTER_ACTION' ||
    context?.kind !== 'ENCOUNTER_ACTION' ||
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE' ||
    input.next.snapshotKind !== 'AGGREGATE_CHOICE' ||
    stored.targets.length !== next.targets.length ||
    checksumCanonicalJson({ ...input.stored, applicationContext: { ...stored, targets: [] } }) !==
      checksumCanonicalJson({ ...input.next, applicationContext: { ...next, targets: [] } }) ||
    stored.targets.some(
      (target, index) =>
        checksumCanonicalJson(rayIdentity(target)) !==
        checksumCanonicalJson(rayIdentity(next.targets[index]!))
    ) ||
    next.targets.filter(heldOnHit).length > 1
  )
    throw mismatch()
  const resumed = !response && awaitsReactionChild(previous)
  const offer = reactionOfferOf(before)
  const kind = response?.resolution.kind
  const held = heldOnHitReaction(after)
  const riderOffer = onHitOfferOf(before)
  const riderHeld = heldOnHitRider(after) ? onHitOfferOf(after) : null
  const aimed = aimOffer(offer)
  // The ray's own step: its roll raises an offer, a decline or the resume leaves the reaction offer
  // (for the rider offer, if the hit raises one), a chosen reaction stays on it with its child
  // recorded, and the caster's decision leaves the rider offer.
  if (riderOffer) {
    if (
      before.testedJson !== undefined ||
      after.testedJson === undefined ||
      checksumCanonicalJson(after.snapshot) !== checksumCanonicalJson(before.snapshot) ||
      after.onHit?.testExecutionChecksum !== riderOffer.testExecutionChecksum ||
      (kind === 'OPTION' ? 'USE' : kind === 'DECLINE' ? 'DECLINE' : null) !== after.onHit.selection
    )
      throw mismatch()
  } else if (after.onHit) throw mismatch()
  else if (!offer) {
    // The ray's roll raised the offer. The children its aim recorded before that roll stay as they
    // resolved, and the roll is past its aim.
    if (
      !(held || riderHeld) ||
      before.testedJson !== undefined ||
      !reactionChildrenKept(previous, context) ||
      awaitsReactionChild(context) ||
      aimOffer(reactionOfferOf(after))
    )
      throw mismatch()
  } else if (riderHeld) {
    // The ray left its reaction offer for its rider offer: by a decline, on the hit as it was
    // tested (a rolled d20 is tested only once everyone was heard), or by the resume, on the same
    // d20 tested against the creature as the child left it. An offer of its aim kept no d20.
    if (
      before.testedJson !== undefined ||
      !reactionChildrenKept(previous, context) ||
      awaitsReactionChild(context) ||
      (!aimed &&
        checksumCanonicalJson(riderHeld.testD20.rawFaces) !==
          checksumCanonicalJson(keptFacesOf(offer))) ||
      (!resumed &&
        (kind !== 'DECLINE' ||
          awaitsReactionChild(previous) ||
          (offer.hit !== undefined &&
            riderHeld.testExecutionChecksum !== offer.hit.originalExecutionChecksum)))
    )
      throw mismatch()
  } else if (
    before.testedJson !== undefined ||
    !reactionChildrenKept(previous, context) ||
    (held
      ? // The ray stays held as one attack would (`castPendingContinues`): on the same offer with the
        // chosen reaction's child recorded, or, a rolled d20 left by a decline or the resume, on the
        // next creature's offer of it or on the offer of the hit that same d20 made.
        !heldActionContinues({
          resume,
          response,
          occurrenceId: input.next.occurrenceId,
          next: context,
          endpointActorIds: [stored.casterActorId, before.actorId]
        }) ||
        // An offer of the ray's aim kept no d20: the roll made past it holds the one it rolled.
        (!aimed &&
          checksumCanonicalJson(keptFacesOf(reactionOfferOf(after))) !==
            checksumCanonicalJson(keptFacesOf(offer)))
      : checksumCanonicalJson(keptRollOf(reactionOfferOf(after))) !==
          checksumCanonicalJson(keptRollOf(offer)) ||
        awaitsReactionChild(context) ||
        // A ray past its aim's offers is sealed again for its caster's roll, on the creatures as
        // they stood unless a child changed them.
        (aimed &&
          (context.pause !== undefined || context.rollerActorId !== stored.casterActorId)) ||
        (resumed
          ? false
          : kind !== 'DECLINE' ||
            awaitsReactionChild(previous) ||
            (aimed
              ? context.currentnessChecksum !== previous.currentnessChecksum
              : checksumCanonicalJson(after.snapshot) !== checksumCanonicalJson(before.snapshot))))
  )
    throw mismatch()
  for (const [index, target] of stored.targets.entries()) {
    const sealed = next.targets[index]!
    if (index === at) continue
    const answeredBefore = target.testedJson !== undefined
    if (
      // An answer is written once, with what it rolled and what its caster decided at its rider offer;
      // a ray answered behind this one never passed such an offer.
      checksumCanonicalJson(
        answeredBefore
          ? [sealed.testedJson, sealed.rolls ?? null, sealed.onHit ?? null, sealed.lost ?? null]
          : (sealed.onHit ?? null)
      ) !==
        checksumCanonicalJson(
          answeredBefore
            ? [target.testedJson, target.rolls ?? null, target.onHit ?? null, target.lost ?? null]
            : null
        ) ||
      // So are the facts a ray was rolled against, and only when a reaction is chosen.
      (target.testBindingJson !== undefined
        ? sealed.testBindingJson !== target.testBindingJson
        : sealed.testBindingJson !== undefined &&
          !(answeredBefore && offer && held && kind === 'OPTION')) ||
      // Only the rays behind a ray that left its offers go on, in order, the next of them held on
      // an offer nobody answered yet.
      (!answeredBefore &&
        (sealed.testedJson !== undefined || heldOnHit(sealed)) &&
        (index < at ||
          heldOnHit(after) ||
          (aimOffer(reactionOfferOf(sealed)) && !heldOnFreshAim(sealed)))) ||
      // Only the resume seals a ray again; the ray whose turn comes may be held on its gate.
      (!resumed &&
        (answeredBefore || (sealed.testedJson === undefined && !heldOnHit(sealed))) &&
        !(
          index > at &&
          after.testedJson !== undefined &&
          (heldOnFreshGate(target, sealed) ||
            sealedPastFreshGate(target, sealed, stored.casterActorId))
        ) &&
        checksumCanonicalJson(sealed.snapshot) !== checksumCanonicalJson(target.snapshot))
    )
      throw mismatch()
  }
}

/**
 * Verifies the area snapshot a save answer stores: it is the stored area with exactly the answered
 * creature's save marked tested (or, for a roll a held die could still change, rolled), with the
 * Legendary Resistance it offered and not yet decided, and nothing else changed but the d20 window
 * it may open on the next rolled save and the push pick it may open.
 */
export function requireAreaActionAnswer(input: {
  stored: ServerRuleExecutionPendingSnapshotDto
  next: ServerRuleExecutionPendingSnapshotDto
  requestId: string
  /** The pending list the step continues, and the answer that takes it; the room's resume carries none. */
  resume: NonNullable<Parameters<typeof heldActionContinues>[0]['resume']>
  response: { resolution: { kind: string } } | null | undefined
}) {
  const stored = areaActionPendingContext(input.stored)
  const next = areaActionPendingContext(input.next)
  // The caster's answer to the area's damage window (D208) closes it with the dice it rerolled and the
  // cost it paid, and may open the push pick or the struck creatures' saves.
  if (
    stored &&
    input.stored.snapshotKind === 'AGGREGATE_CHOICE' &&
    encounterAreaDamageRollWindow(stored)?.window.request.requestId === input.requestId
  ) {
    const decided = next?.damageRoll
    if (
      !decided ||
      decided.window ||
      checksumCanonicalJson(input.next) !==
        checksumCanonicalJson(
          withOpenedHold(
            decideEncounterAreaDamageRoll(input.stored, decided.rolls, decided.reroll ?? null),
            input.next
          )
        )
    )
      throw new Error('Live Session pending area damage roll mismatch.')
    return
  }
  const at =
    stored?.targets.findIndex((target) => target.snapshot.request.requestId === input.requestId) ??
    -1
  if (gateOfferOf(stored?.targets[at])) return requireAreaActionRayGate({ ...input, at })
  if (
    reactionOfferOf(stored?.targets[at]) ||
    onHitOfferOf(stored?.targets[at]) ||
    (next?.targets[at] && heldOnHit(next.targets[at]))
  )
    return requireAreaActionRayHit({ ...input, at })
  // An answer that opens the next d20 window swaps that save's snapshot, so the answered creature is
  // found by its place in the stored area.
  const answered =
    next?.targets[
      stored?.targets.findIndex(
        (target) => target.snapshot.request.requestId === input.requestId
      ) ?? -1
    ]
  if (
    !stored ||
    !next ||
    !answered ||
    answered.legendaryResistance?.decision !== undefined ||
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE'
  )
    throw new Error('Live Session pending area answer mismatch.')
  const settled =
    answered.testedJson !== undefined
      ? // A caster's answered ray hands the turn to the rays behind it.
        withRaysBehindOpened(
          markEncounterAreaSaveTested(input.stored, input.requestId, {
            ...answered,
            testedJson: answered.testedJson
          }),
          stored,
          next,
          at + 1
        )
      : answered.rolledJson !== undefined
        ? markEncounterAreaSaveRolled(input.stored, input.requestId, answered.rolledJson)
        : null
  const settledTargets = settled && areaActionPendingContext(settled)?.targets
  const opened = settledTargets
    ? next.targets.findIndex(
        (target, index) =>
          settledTargets[index] !== undefined &&
          checksumCanonicalJson(target.snapshot) !==
            checksumCanonicalJson(settledTargets[index].snapshot)
      )
    : -1
  if (
    !settled ||
    !settledTargets ||
    checksumCanonicalJson(input.next) !==
      checksumCanonicalJson(
        withOpenedHold(
          opened < 0
            ? settled
            : openEncounterAreaSaveWindow(
                settled,
                settledTargets[opened]!.snapshot.request.requestId,
                next.targets[opened]!.snapshot
              ),
          input.next
        )
      )
  )
    throw new Error('Live Session pending area answer mismatch.')
}

/**
 * Verifies the area snapshot a Legendary Resistance decision stores: it is the stored area with
 * exactly that creature's offer decided, and nothing else changed but the push pick it may open.
 */
export function requireAreaActionLegendaryResistance(input: {
  stored: ServerRuleExecutionPendingSnapshotDto
  next: ServerRuleExecutionPendingSnapshotDto
  actorId: string
}) {
  // The entry decided is the first of the creature's offers the stored area still waits on.
  const decided = areaActionPendingContext(input.next)?.targets[
    areaActionPendingContext(input.stored)?.targets.findIndex(
      (target) =>
        target.actorId === input.actorId &&
        target.legendaryResistance &&
        !target.legendaryResistance.decision
    ) ?? -1
  ]?.legendaryResistance
  if (
    decided?.decision === undefined ||
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE' ||
    checksumCanonicalJson(input.next) !==
      checksumCanonicalJson(
        withOpenedHold(
          markEncounterAreaLegendaryResistanceDecided(input.stored, input.actorId, decided),
          input.next
        )
      )
  )
    throw new Error('Live Session pending area decision mismatch.')
}

/**
 * Verifies the area snapshot a push pick's answer stores (D157): it is the stored area with that
 * creature landed on the offered square, holding the next pick it opens, and nothing else changed.
 */
export function requireAreaActionForcedMovement(input: {
  stored: ServerRuleExecutionPendingSnapshotDto
  next: ServerRuleExecutionPendingSnapshotDto
  requestId: string
  position: { x: number; y: number }
}) {
  if (
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE' ||
    checksumCanonicalJson(input.next) !==
      checksumCanonicalJson(
        withOpenedHold(
          landEncounterAreaForcedMovement(input.stored, input.requestId, input.position),
          input.next
        )
      )
  )
    throw new Error('Live Session pending area destination mismatch.')
}

/**
 * Verifies the area snapshot a GM removal that settles the area commits with: it is the stored area
 * with exactly that creature taken out, and nothing else changed.
 */
export function requireAreaActionRemoval(input: {
  stored: ServerAggregateChoicePendingSnapshotDto
  next: ServerRuleExecutionPendingSnapshotDto
  actorId: string
}) {
  const removal = removeEncounterAreaTargetFromSnapshot(input.stored, input.actorId)
  if (
    removal.kind !== 'REMOVED' ||
    checksumCanonicalJson(input.next) !== checksumCanonicalJson(removal.snapshot)
  )
    throw new Error('Live Session pending area removal mismatch.')
}

/**
 * What one viewer reads of an area. The GM reads every unanswered save and every undecided Legendary
 * Resistance choice; a player reads only those of the creatures they control, each save with what that
 * creature's own facts imply. Nobody else learns a choice exists. Null when the viewer has neither.
 * The caught-set seal is the GM's alone, and a caster the players cannot see is named only to the GM
 * and the caster's own controller, so neither lets a player infer a hidden creature. Before the area
 * resolves, the GM reads every caught creature and the caster's controller reads those the caster
 * perceived when it opened (sealed on the occurrence); nobody else reads a caught list.
 */
export function projectNativeAreaActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pending: Pick<
    Awaited<ReturnType<typeof readNativeAreaActionPending>>,
    'context' | 'targets' | 'command'
  >,
  viewer: {
    isOwner: boolean
    controlledActorIds: ReadonlySet<string>
    /** The Run's actors: their labels, and which the GM has not hidden from the players (D62). */
    actors: readonly Pick<EncounterRunActorState, 'id' | 'label' | 'public'>[]
  },
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto | null {
  const answers = (actorId: string) => viewer.isOwner || viewer.controlledActorIds.has(actorId)
  const casterId = pending.context.casterActorId
  // Once every save settled, an open damage window (D208) is the area's one decision, its caster's.
  const damageWindow = pending.context.damageRoll?.window
  if (damageWindow) {
    const context = damageWindow.applicationContext
    if (context.kind !== 'ENCOUNTER_ACTION')
      throw new Error('Stored area damage window is invalid.')
    return answers(casterId)
      ? projectNativeActionPending(
          occurrence,
          { snapshot: damageWindow, context, command: pending.command },
          viewer.isOwner,
          reasons
        )
      : null
  }
  // Once every save settled, an open push pick (D157) is the area's one decision, its source's.
  const pick = pending.context.forcedMovement?.pick
  if (pick)
    return answers(casterId)
      ? {
          kind: 'FORCED_MOVEMENT_DESTINATION',
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          encounterVersion: occurrence.expectedEncounterVersion,
          sourceActorId: casterId,
          targetActorId: pick.targetActorId,
          requestId: pick.requestId,
          positions: pick.positions,
          allowedResponses: ['FORCED_MOVEMENT']
        }
      : null
  // A ray held on an offer its hit raised is the list's one decision: its creature's reaction (D219),
  // then its caster's on-hit rider.
  const heldRay = pending.targets.find(
    (target) =>
      encounterAreaSaveAwaiting({ casterActorId: casterId, targets: pending.targets }, target) ===
      'DECISION'
  )
  if (heldRay)
    return answers(heldRay.context.rollerActorId)
      ? projectNativeActionPending(
          occurrence,
          { snapshot: heldRay.snapshot, context: heldRay.context, command: pending.command },
          viewer.isOwner,
          reasons
        )
      : null
  const caught =
    viewer.isOwner || viewer.controlledActorIds.has(casterId)
      ? pending.context.targets.flatMap((target) => {
          const actor = viewer.actors.find((candidate) => candidate.id === target.actorId)
          return actor && !target.collision && (viewer.isOwner || target.perceivedByCaster)
            ? [actor.label]
            : []
        })
      : []
  const legendaryResistance = pending.targets.flatMap((target) =>
    target.legendaryResistance && !target.legendaryResistance.decision && answers(target.actorId)
      ? [
          {
            actorId: target.actorId,
            optionId: target.legendaryResistance.resistance.useOptionId
          }
        ]
      : []
  )
  // A save waits on its roll, or, once rolled, on the d20 window the earliest creature has open. A
  // caster's rays wait one at a time, so only the next of them is read.
  const area = { casterActorId: casterId, targets: pending.targets }
  const answerable = pending.targets.flatMap((target) => {
    const awaiting = encounterAreaSaveAwaiting(area, target)
    const rollerActorId = target.context.rollerActorId
    if (!awaiting || !answers(rollerActorId)) return []
    return [
      {
        awaiting,
        actorId: rollerActorId,
        targetActorId: target.actorId,
        summary: projectNativeActionPending(
          occurrence,
          { snapshot: target.snapshot, context: target.context, command: pending.command },
          viewer.isOwner,
          reasons
        )
      }
    ]
  })
  const saves = answerable.flatMap(({ awaiting, actorId, targetActorId, summary }) => {
    if (awaiting !== 'ROLL') return []
    if (summary.kind !== 'D20_EVIDENCE') throw new Error('Stored area save evidence is invalid.')
    return [{ actorId, targetActorId, request: summary.request }]
  })
  const windows = answerable.flatMap(({ awaiting, actorId, targetActorId, summary }) => {
    if (awaiting !== 'WINDOW') return []
    if (summary.kind !== 'ROLL_WINDOW') throw new Error('Stored area save window is invalid.')
    const { requestId, d20, options } = summary
    return [{ actorId, targetActorId, requestId, d20, options }]
  })
  return saves.length === 0 &&
    windows.length === 0 &&
    legendaryResistance.length === 0 &&
    caught.length === 0
    ? null
    : {
        kind: 'AREA_SAVES',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        casterActorId:
          answers(casterId) || viewer.actors.some((actor) => actor.id === casterId && actor.public)
            ? casterId
            : null,
        caughtChecksum: viewer.isOwner ? pending.context.caughtChecksum : null,
        caught,
        saves,
        windows,
        legendaryResistance,
        allowedResponses: [
          'ENTER_DICE',
          'SYSTEM_ROLL',
          'ROLL_WINDOW_DECLINE',
          'ROLL_WINDOW_USE',
          'AREA_LEGENDARY_RESISTANCE'
        ]
      }
}
