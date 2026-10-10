import {
  actionAreaSceneRequestDtoSchema,
  resolveEncounterActionInputDtoSchema,
  type ActionAreaSceneRequestDto,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  EncounterAreaActionPendingContextDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { catchEncounterAreaActorIds } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  encounterAreaCaughtChecksum,
  markEncounterAreaLegendaryResistanceDecided,
  markEncounterAreaSaveTested
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
type AreaCommand = Omit<
  Extract<ResolveEncounterActionInputDto, { type: 'RESOLVE_ACTION' }>,
  'target'
> & {
  target: Extract<ResolveEncounterActionInputDto['target'], { kind: 'POINT' }>
}

/** The area occurrence's own snapshot narrowed to its aggregate context. */
export function areaActionPendingContext(snapshot: ServerRuleExecutionPendingSnapshotDto) {
  return snapshot.snapshotKind === 'AGGREGATE_CHOICE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_AREA_ACTION'
    ? snapshot.applicationContext
    : null
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
      legendaryResistance: target.legendaryResistance
    }
  })
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
    command.target.kind !== 'POINT' ||
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
 * creatures it was sealed with.
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
  const context = areaActionPendingContext(snapshot)
  if (
    !context ||
    context.initiatorUserId !== input.initiatorUserId ||
    context.commandFingerprint !== input.fingerprint ||
    checksumCanonicalJson(JSON.parse(context.commandJson)) !== input.fingerprint ||
    context.casterActorId !== command.actorId ||
    context.scene.sceneId !== command.target.sceneId ||
    context.scene.sceneVersion !== command.target.expectedSceneVersion ||
    context.area.origin.x !== command.target.point.x ||
    context.area.origin.y !== command.target.point.y ||
    snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
    !state.actorIds.includes(context.casterActorId)
  )
    throw new Error('Live Session pending area action root mismatch.')
  const targets = areaTargets(context)
  for (const target of targets)
    if (
      !state.actorIds.includes(target.actorId) ||
      target.context.commandJson !== context.commandJson ||
      target.snapshot.graph.source.gameSystemId !== state.gameSystemId ||
      target.snapshot.deferredCleaving !== undefined ||
      target.context.contest !== undefined
    )
      throw new Error('Live Session pending area action root mismatch.')
  const scene = await readAreaSceneInputs(
    state,
    actionAreaSceneRequestDtoSchema.parse({
      actorId: command.actorId,
      sceneId: command.target.sceneId,
      expectedSceneVersion: command.target.expectedSceneVersion
    })
  )
  const caught = catchEncounterAreaActorIds({
    origin: context.area.origin,
    shape: context.area.shape,
    tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId }))
  })
  // A creature the GM removed is still caught by the Scene; it is simply no longer tested.
  const sealed = [...targets.map((target) => target.actorId), ...context.removedActorIds]
  const footprintsMatch = targets.every((target) => {
    const token = scene.tokens.find((candidate) => candidate.actorId === target.actorId)
    return (
      token !== undefined &&
      checksumCanonicalJson({
        tokenId: token.tokenId,
        position: token.position,
        width: token.width,
        height: token.height,
        rotationDegrees: token.rotationDegrees
      }) === checksumCanonicalJson(target.token)
    )
  })
  if (
    scene.sceneId !== context.scene.sceneId ||
    scene.sceneVersion !== context.scene.sceneVersion ||
    !footprintsMatch ||
    caught.length !== sealed.length ||
    !caught.every((actorId) => sealed.includes(actorId)) ||
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
 * Verifies the area snapshot a save answer stores: it is the stored area with exactly the answered
 * creature's save marked tested, with the Legendary Resistance it offered and not yet decided, and
 * nothing else changed.
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
        markEncounterAreaSaveTested(
          input.stored,
          input.requestId,
          answered.testedJson,
          answered.legendaryResistance
        )
      )
  )
    throw new Error('Live Session pending area answer mismatch.')
}

/**
 * Verifies the area snapshot a Legendary Resistance decision stores: it is the stored area with
 * exactly that creature's offer decided, and nothing else changed.
 */
export function requireAreaActionLegendaryResistance(input: {
  stored: ServerRuleExecutionPendingSnapshotDto
  next: ServerRuleExecutionPendingSnapshotDto
  actorId: string
}) {
  const decided = areaActionPendingContext(input.next)?.targets.find(
    (target) => target.actorId === input.actorId
  )?.legendaryResistance
  if (
    decided?.decision === undefined ||
    input.stored.snapshotKind !== 'AGGREGATE_CHOICE' ||
    checksumCanonicalJson(input.next) !==
      checksumCanonicalJson(
        markEncounterAreaLegendaryResistanceDecided(input.stored, input.actorId, decided)
      )
  )
    throw new Error('Live Session pending area decision mismatch.')
}

/**
 * What one viewer reads of an area. The GM reads every unanswered save and every undecided Legendary
 * Resistance choice; a player reads only those of the creatures they control, each save with what that
 * creature's own facts imply. Nobody else learns a choice exists. Null when the viewer has neither.
 */
export function projectNativeAreaActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pending: Pick<Awaited<ReturnType<typeof readNativeAreaActionPending>>, 'context' | 'targets'>,
  viewer: { isOwner: boolean; controlledActorIds: ReadonlySet<string> },
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto | null {
  const answers = (actorId: string) => viewer.isOwner || viewer.controlledActorIds.has(actorId)
  const legendaryResistance = pending.targets.flatMap((target) =>
    target.legendaryResistance && !target.legendaryResistance.decision && answers(target.actorId)
      ? [{ actorId: target.actorId, optionId: target.legendaryResistance.resistance.useOptionId }]
      : []
  )
  const saves = pending.targets.flatMap((target) => {
    if (target.testedJson !== undefined) return []
    if (!answers(target.actorId)) return []
    const summary = projectNativeActionPending(
      occurrence,
      { snapshot: target.snapshot, context: target.context },
      viewer.isOwner,
      reasons
    )
    if (summary.kind !== 'D20_EVIDENCE') throw new Error('Stored area save evidence is invalid.')
    return [{ actorId: target.actorId, request: summary.request }]
  })
  return saves.length === 0 && legendaryResistance.length === 0
    ? null
    : {
        kind: 'AREA_SAVES',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        casterActorId: pending.context.casterActorId,
        caughtChecksum: pending.context.caughtChecksum,
        saves,
        legendaryResistance,
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL', 'AREA_LEGENDARY_RESISTANCE']
      }
}
