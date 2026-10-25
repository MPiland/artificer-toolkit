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
  encounterAreaCaughtChecksum,
  holdEncounterAreaForcedMovement,
  landEncounterAreaForcedMovement,
  markEncounterAreaLegendaryResistanceDecided,
  holdEncounterAreaCollisionSaves,
  markEncounterAreaSaveTested,
  removeEncounterAreaTargetFromSnapshot
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectNativeActionPending } from './actionPending.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
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
    command.expectedVersion !== occurrence.expectedEncounterVersion ||
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
 * The area holding what `next` opens once the saves settle, if anything: the push pick (D157) that
 * the answer settling an area may open first and each landing the next one, or, once every mover
 * landed, the saves of the creatures they struck (D159).
 */
function withOpenedHold(
  area: ServerAggregateChoicePendingSnapshotDto,
  next: ServerRuleExecutionPendingSnapshotDto
) {
  const opened = areaActionPendingContext(next)
  const struck = opened?.targets.filter(({ collision }) => collision) ?? []
  if (
    struck.length > 0 &&
    !areaActionPendingContext(area)?.targets.some(({ collision }) => collision)
  )
    return holdEncounterAreaCollisionSaves(area, struck, opened?.forcedMovement?.rays)
  const pick = opened?.forcedMovement?.pick
  return pick ? holdEncounterAreaForcedMovement(area, pick, opened.forcedMovement?.rays) : area
}

/**
 * Verifies the area snapshot a save answer stores: it is the stored area with exactly the answered
 * creature's save marked tested, with the Legendary Resistance it offered and not yet decided, and
 * nothing else changed but the push pick it may open.
 */
export function requireAreaActionAnswer(input: {
  stored: ServerRuleExecutionPendingSnapshotDto
  next: ServerRuleExecutionPendingSnapshotDto
  requestId: string
}) {
  const answered = areaActionPendingContext(input.next)?.targets.find(
    (target) => target.snapshot.request.requestId === input.requestId
  )
  if (
    answered?.testedJson === undefined ||
    answered.legendaryResistance?.decision !== undefined ||
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE' ||
    checksumCanonicalJson(input.next) !==
      checksumCanonicalJson(
        withOpenedHold(
          markEncounterAreaSaveTested(
            input.stored,
            input.requestId,
            answered.testedJson,
            answered.legendaryResistance
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
  pending: Pick<Awaited<ReturnType<typeof readNativeAreaActionPending>>, 'context' | 'targets'>,
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
  const saves = pending.targets.flatMap((target) => {
    if (target.testedJson !== undefined) return []
    const rollerActorId = target.context.rollerActorId
    if (!answers(rollerActorId)) return []
    const summary = projectNativeActionPending(
      occurrence,
      { snapshot: target.snapshot, context: target.context },
      viewer.isOwner,
      reasons
    )
    if (summary.kind !== 'D20_EVIDENCE') throw new Error('Stored area save evidence is invalid.')
    return [{ actorId: rollerActorId, targetActorId: target.actorId, request: summary.request }]
  })
  return saves.length === 0 && legendaryResistance.length === 0 && caught.length === 0
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
        legendaryResistance,
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL', 'AREA_LEGENDARY_RESISTANCE']
      }
}
