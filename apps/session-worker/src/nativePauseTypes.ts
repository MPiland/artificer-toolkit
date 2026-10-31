import type { EncounterSealedChoiceSelection } from '@artificer-toolkit/rules-runtime/encounterSealedChoice'
import type {
  pendingSnapshotContinuation,
  restoreEncounterActionPending
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import type {
  EncounterEvidenceAnswer,
  withEncounterAppRoll
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import type { resolveNativeActionLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterActionLegendaryResistance'
import type { resolveNativeActionOnHit } from '@artificer-toolkit/rules-runtime/encounterActionOnHit'
import type { resolveNativeActionReaction } from '@artificer-toolkit/rules-runtime/encounterActionReaction'
import type { onHitCandidates } from '@artificer-toolkit/rules-runtime/character/characterOnHitCosts'
import type {
  EncounterActionPauseDto,
  EncounterPausePayload
} from '@artificer-toolkit/schema/shared/encounterPause'
import type { EncounterD20WindowSelection } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { NativeCurrentReaction } from './nativePauseReaction.js'
import type { NativeCastReactionAnswer } from './nativeEncounterCastReaction.js'
import type { NativeIncomingGateAnswer } from './nativeEncounterIncomingGate.js'

export type NativePauseKind = EncounterActionPauseDto['kind']
export type NativePauseOf<Kind extends NativePauseKind> = Extract<
  EncounterActionPauseDto,
  { kind: Kind }
>

/** The response's resolution once an app roll has settled with the faces Convex recorded for it. */
export type NativePauseResolution = ReturnType<typeof withEncounterAppRoll>
export type NativePauseDice = Extract<NativePauseResolution, { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }>

/** A sealed choice answered: the offer it was made against and the option taken. */
export type NativeSealedChoiceAnswer<Kind extends NativePauseKind> = {
  offer: EncounterPausePayload<Kind>
  selection: EncounterSealedChoiceSelection
}

export type NativeForcedMovementAnswer = {
  offer: EncounterPausePayload<'FORCED_MOVEMENT'>
  continuation: ReturnType<typeof pendingSnapshotContinuation>
  outcomePhase: ReturnType<typeof restoreEncounterActionPending>['twoPhase']
  position: Extract<NativePauseResolution, { kind: 'FORCED_MOVEMENT' }>['position']
}

/** A d20 window answered: the roll it froze, the choice that held it, and the die spent or declined. */
export type NativeD20WindowAnswer = {
  offer: EncounterPausePayload<'D20_WINDOW'>
  continuation: ReturnType<typeof pendingSnapshotContinuation>
  selection: EncounterD20WindowSelection
}

/** The answer a response carries: its own evidence when nothing is paused, else the paused kind's. */
export type NativePauseAnswer =
  | { kind: 'EVIDENCE'; answer: EncounterEvidenceAnswer }
  | { kind: 'D20_WINDOW'; answer: NativeD20WindowAnswer }
  | { kind: 'LEGENDARY_RESISTANCE'; answer: NativeSealedChoiceAnswer<'LEGENDARY_RESISTANCE'> }
  | { kind: 'REACTION'; answer: NativeSealedChoiceAnswer<'REACTION'> }
  | { kind: 'CAST_REACTION'; answer: NativeCastReactionAnswer }
  | { kind: 'INCOMING_GATE'; answer: NativeIncomingGateAnswer }
  | { kind: 'ATTACK_RETARGET'; answer: NativeSealedChoiceAnswer<'ATTACK_RETARGET'> }
  | { kind: 'ON_HIT'; answer: NativeSealedChoiceAnswer<'ON_HIT'> }
  | { kind: 'FORCED_MOVEMENT'; answer: NativeForcedMovementAnswer }

export type NativePauseReadInput<Kind extends NativePauseKind> = {
  pause: NativePauseOf<Kind>
  snapshot: Parameters<typeof pendingSnapshotContinuation>[0]
  resolution: NativePauseResolution
  /** The decline or option a choice's answer names; null for any other resolution. */
  decision: EncounterSealedChoiceSelection | null
  /** A d20 pause's answer: its own die, sealed to the request it was offered for. */
  dice: NativePauseDice | null
}

/** The action as the planner prepared it, which a settled answer continues. */
export type NativePauseSettleContext = {
  actionSource: Omit<
    Parameters<typeof resolveNativeActionReaction>[0],
    'offer' | 'selection' | 'candidate' | 'targetStateChecksum' | 'adjustedBinding'
  >
  currentResistance: () => Promise<
    Pick<
      Parameters<typeof resolveNativeActionLegendaryResistance>[0],
      'candidate' | 'currentFeatureResource' | 'targetStateChecksum'
    >
  >
  currentReaction: (
    used: boolean,
    answering: string,
    critical: boolean
  ) => Promise<NativeCurrentReaction>
  onHitNow: ReturnType<typeof onHitCandidates>
}

/** What a held on-hit offer keeps of the reaction its hit answered. */
export type NativeHeldReaction = {
  reaction: NonNullable<EncounterPausePayload<'ON_HIT'>['reaction']>
  testExecution: EncounterPausePayload<'ON_HIT'>['testExecution']
  testRollEvidence: EncounterPausePayload<'ON_HIT'>['testD20']
}

/** What a settled answer leaves the planner: the execution it continued and the records it made. */
export type NativePauseSettlement = {
  execution: Awaited<ReturnType<typeof advanceNativeActionGraphs>>
  resistance?: Awaited<ReturnType<typeof resolveNativeActionLegendaryResistance>>['resistance']
  reaction?: NativeCurrentReaction & Awaited<ReturnType<typeof resolveNativeActionReaction>>
  onHit?: Awaited<ReturnType<typeof resolveNativeActionOnHit>>
  heldReaction?: NativeHeldReaction | null
  heldReactionNow?: NativeCurrentReaction | null
}

/** Method syntax keeps the table's per-kind handlers assignable to the union-kind handler that dispatches. */
export type NativePauseHandler<Kind extends NativePauseKind> = {
  read(input: NativePauseReadInput<Kind>): Extract<NativePauseAnswer, { kind: Kind }>
  settle?(
    answer: Extract<NativePauseAnswer, { kind: Kind }>['answer'],
    context: NativePauseSettleContext
  ): Promise<NativePauseSettlement>
}
