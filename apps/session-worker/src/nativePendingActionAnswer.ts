import {
  resolveEncounterActionInputDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterActionResume } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readNativePauseAnswer } from './nativePauseHandlers.js'
import type { NativePauseAnswer } from './nativePauseTypes.js'

type AreaAnswer<Kind extends ResolveRuleOccurrenceInputDto['resolution']['kind']> = Extract<
  ResolveRuleOccurrenceInputDto['resolution'],
  { kind: Kind }
>

/**
 * Reads what a response answers on the pending ordinary action it names: an area creature's
 * Legendary Resistance decision, an area's push pick, or the answer to the pause the action holds.
 * The response must match the stored root command and the evidence the action waits on.
 */
export function readNativePendingActionAnswer(input: {
  response: ResolveRuleOccurrenceInputDto
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto | null
  areaSnapshot: { occurrenceId: string } | null
  appRoll: Parameters<typeof withEncounterAppRoll>[1]
  fingerprint: string
}) {
  const { response, snapshot, areaSnapshot } = input
  if (!snapshot || snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
    throw new Error('The pending action snapshot is unavailable.')
  let areaDecision: AreaAnswer<'AREA_LEGENDARY_RESISTANCE'> | null = null
  let areaLanding: AreaAnswer<'FORCED_MOVEMENT'> | null = null
  let pauseAnswer: NativePauseAnswer | null = null
  // An app roll settles with the faces Convex recorded for it, never client-supplied values.
  const resolution = withEncounterAppRoll(response.resolution, input.appRoll)
  if (resolution.kind === 'AREA_LEGENDARY_RESISTANCE') areaDecision = resolution
  // An area's push pick is the area's own, never its pushed creature's save (D157).
  else if (areaSnapshot && resolution.kind === 'FORCED_MOVEMENT') areaLanding = resolution
  else {
    pauseAnswer = readNativePauseAnswer({
      pause: snapshot.applicationContext.pause,
      snapshot,
      resolution
    })
  }
  const context = snapshot.applicationContext
  const root = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
  if (
    // An area save is sealed under its own occurrence id; the answer names the area's.
    (areaSnapshot ?? snapshot).occurrenceId !== response.occurrenceId ||
    context.commandFingerprint !== input.fingerprint ||
    checksumCanonicalJson(root) !== input.fingerprint ||
    (pauseAnswer?.kind === 'EVIDENCE' &&
      (snapshot.request.requestId !== pauseAnswer.answer.requestId ||
        (context.d20Policy === null && pauseAnswer.answer.kind === 'ENTER_DICE') ||
        (context.d20Policy !== null && pauseAnswer.answer.kind === 'ENTER_INTEGER')))
  )
    throw new Error('The pending action evidence is invalid.')
  // Contests (Disarm) and deferred Cleaving have their own planners; their evidence never
  // routes here.
  if (context.contest || snapshot.deferredCleaving || root.optionalCombatIntent != null)
    throw new Error('The pending action is not an ordinary action.')
  return { areaDecision, areaLanding, pauseAnswer }
}

/**
 * The reaction offer the room resumes a pending action from, once the child action of the reaction
 * chosen at it committed (D219): its moment, who was offered it and who declined before. The action must be an
 * ordinary action still held at that offer, whether it is at one creature, a chosen list or an area.
 */
export function readNativeResumedReactionOffer(input: {
  resume: LiveSessionEncounterActionResume
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto | null
  /** The ray list whose held ray the snapshot is, when the resumed action is one. */
  areaSnapshot: { occurrenceId: string } | null
  fingerprint: string
}) {
  const { resume, snapshot } = input
  const context = snapshot?.applicationContext
  if (
    context?.kind !== 'ENCOUNTER_ACTION' ||
    (input.areaSnapshot ?? snapshot)?.occurrenceId !== resume.occurrenceId ||
    context.commandFingerprint !== input.fingerprint ||
    context.pause?.kind !== 'CAST_REACTION' ||
    context.contest ||
    snapshot.deferredCleaving
  )
    throw new Error('The pending action evidence is invalid.')
  return {
    kind: context.pause.payload.kind,
    reactorActorId: context.rollerActorId,
    declinedReactorActorIds: context.pause.payload.declinedReactorActorIds
  }
}
