import { z, lazySchema } from '../zod.js'
import { encounterActionPauseDtoSchema } from './encounterPause.js'
import {
  directActionTwoPhaseDtoSchema,
  validateEncounterLegendaryResistancePin
} from './ruleExecutionDirectActionPendingContexts.js'
import {
  serverRuleExecutionD20BeliefDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from './ruleExecutionEvidence.js'
import { isD20RolledCheck } from './ruleExecutionD20WindowOffer.js'
import { validateEncounterOnHitOption } from './ruleExecutionOnHitChoice.js'
import {
  encounterFailedCounterDtoSchema,
  validateEncounterReactionPin
} from './ruleExecutionReactionChoice.js'
import {
  ruleExecutionChecksumSchema,
  ruleExecutionReceiptD20FaceSchema,
  ruleExecutionUuidSchema
} from './ruleExecutionPrimitives.js'
import { serverContestCheckPendingContextDtoSchema } from './ruleExecutionOptionalCombatPending.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

// Explicitly typed so the pending-context declaration stays within the compiler's size limit (TS7056).
export type EncounterActionHeldD20Dto = {
  rolledMode: 'NORMAL'
  faces: [number]
  playerCaption: string | null
  gmReason: string | null
}

export const encounterActionHeldD20DtoSchema: z.ZodMiniType<EncounterActionHeldD20Dto> = lazySchema(
  () =>
    z.strictObject({
      rolledMode: z.literal('NORMAL'),
      faces: z.tuple([ruleExecutionReceiptD20FaceSchema]),
      playerCaption: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
      ),
      gmReason: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
    })
)

/** Native action ownership; the command JSON is parsed by its owning command schema on every read. */
export const encounterActionPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_ACTION'),
      schemaVersion: z.literal(1),
      commandJson: z.string(),
      commandFingerprint: ruleExecutionChecksumSchema,
      initiatorUserId: ruleExecutionUuidSchema,
      /**
       * The actor whose roll the pending request is. Its controllers (and the GM) see and answer it;
       * the initiator answers only for actors they control (ADR 0034 decision 3).
       */
      rollerActorId: ruleExecutionUuidSchema,
      currentnessChecksum: ruleExecutionChecksumSchema,
      d20Policy: z.nullable(serverRuleExecutionD20PolicyDtoSchema),
      twoPhase: z.nullable(directActionTwoPhaseDtoSchema),
      /** Disarm keeps the original action owner while each contest participant responds. */
      contest: z.optional(z.lazy(() => serverContestCheckPendingContextDtoSchema)),
      /**
       * Whether a contest's request is one of its two checks, a won outcome's dice (D173), or the
       * destination its settled outcome's forced movement owes its source (D157).
       */
      contestPhase: z.optional(z.enum(['CHECKS', 'OUTCOME', 'DESTINATION'])),
      /** The mode the roller's own facts imply, shown at the roll prompt (ATTACK-10.1). */
      d20Belief: z.optional(serverRuleExecutionD20BeliefDtoSchema),
      /** The d20 a roller already entered while the server waits for one more to settle the true mode. */
      heldD20: z.optional(encounterActionHeldD20DtoSchema),
      /**
       * What the snapshot's continuation waits on, when it is a choice or a d20 other than the action's
       * own (ADR 0039 decision 3). Its requirements of the rest of the context are checked per kind below.
       */
      pause: z.optional(encounterActionPauseDtoSchema),
      /**
       * The ward effect whose save the attacker already passed, carried by every later pause of the action
       * so its replay does not ask for the save again.
       */
      passedIncomingGate: z.optional(ruleExecutionUuidSchema),
      /**
       * The counters reactors attempted and failed against this cast, carried by every pending of the
       * cast to its terminal commit, which spends them with the cast (D127).
       */
      failedCounters: z.optional(
        z.array(encounterFailedCounterDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      )
    })
    .check(
      z.superRefine((value, context) => {
        const { pause } = value
        if (!value.contest !== !value.contestPhase)
          context.addIssue({
            code: 'custom',
            path: ['contestPhase'],
            message: 'Only a pending contest names its phase.'
          })
        if (
          (value.contestPhase === 'DESTINATION') !==
          (!!value.contest && pause?.kind === 'FORCED_MOVEMENT')
        )
          context.addIssue({
            code: 'custom',
            path: ['contestPhase'],
            message: "A contest's destination phase holds its forced-movement pick."
          })
        if (pause) {
          const issue = (message: string) =>
            context.addIssue({ code: 'custom', path: ['pause'], message })
          // A pause's continuation is the pause itself: it holds no d20 of the action's own.
          const holdsActionD20 = value.d20Policy !== null || !!value.contest || !!value.heldD20
          const test = value.twoPhase?.phase === 'TEST'
          switch (pause.kind) {
            case 'LEGENDARY_RESISTANCE':
              validateEncounterLegendaryResistancePin(pause.payload.resistance, context, [
                'pause',
                'payload',
                'resistance'
              ])
              if (
                holdsActionD20 ||
                !test ||
                value.rollerActorId !== pause.payload.resistance.targetActorId
              )
                issue(
                  'A Legendary Resistance offer belongs to a TEST held for the resisting creature.'
                )
              break
            case 'REACTION':
              for (const [index, reaction] of pause.payload.reactions.entries())
                validateEncounterReactionPin(reaction, context, [
                  'pause',
                  'payload',
                  'reactions',
                  index
                ])
              if (
                holdsActionD20 ||
                !test ||
                pause.payload.reactions.some(
                  ({ reactorActorId }) => reactorActorId !== value.rollerActorId
                )
              )
                issue('A reaction offer belongs to a TEST held for the reacting creature.')
              break
            case 'CAST_REACTION':
              for (const [index, reaction] of pause.payload.reactions.entries())
                validateEncounterReactionPin(reaction, context, [
                  'pause',
                  'payload',
                  'reactions',
                  index
                ])
              if (
                holdsActionD20 ||
                value.twoPhase !== null ||
                pause.payload.reactions.some(
                  ({ reactorActorId }) => reactorActorId !== value.rollerActorId
                ) ||
                pause.payload.declinedReactorActorIds.includes(value.rollerActorId) ||
                (pause.payload.check !== undefined && pause.payload.reactions.length !== 1)
              )
                issue('A cast reaction offer belongs to a cast held before it executes.')
              break
            case 'INCOMING_GATE':
              if (
                holdsActionD20 ||
                value.twoPhase !== null ||
                value.passedIncomingGate !== undefined ||
                pause.payload.holderActorId === value.rollerActorId
              )
                issue('An incoming gate save belongs to an action held before it executes.')
              break
            case 'ATTACK_RETARGET':
              if (
                holdsActionD20 ||
                value.twoPhase !== null ||
                value.passedIncomingGate !== undefined ||
                value.failedCounters !== undefined ||
                pause.payload.gate.holderActorId === value.rollerActorId ||
                pause.payload.options.some(
                  ({ targetActorId }) => targetActorId === value.rollerActorId
                )
              )
                issue('A retarget offer belongs to an action a ward stopped before it executed.')
              break
            case 'ON_HIT':
              for (const [index, option] of pause.payload.options.entries())
                validateEncounterOnHitOption(option, pause.payload.testExecutionChecksum, context, [
                  'pause',
                  'payload',
                  'options',
                  index
                ])
              if (holdsActionD20 || !test)
                issue('An on-hit offer belongs to a TEST held for the attacker.')
              break
            case 'FORCED_MOVEMENT':
              // A won contest's settled outcome holds its pick with both checks already rolled.
              if (
                (value.contestPhase === 'DESTINATION'
                  ? value.d20Policy !== null || !!value.heldD20
                  : holdsActionD20) ||
                test
              )
                issue(
                  'A forced-movement destination belongs to a settled action held for its source.'
                )
              break
            case 'D20_WINDOW':
              if (holdsActionD20 || !value.twoPhase || isD20RolledCheck(pause.payload.rolled))
                issue(
                  'A d20 window belongs to a TEST or nested OUTCOME save held for the roller who holds a die.'
                )
              break
          }
        }
        const castReaction = pause?.kind === 'CAST_REACTION' ? pause.payload : undefined
        const chain = castReaction?.chain?.counters ?? []
        const failedReactors = (value.failedCounters ?? []).map(
          ({ reaction }) => reaction.reactorActorId
        )
        const chainReactors = chain.map(({ reaction }) => reaction.reactorActorId)
        const usedReactors = [...failedReactors, ...chainReactors]
        if (
          new Set(usedReactors).size !== usedReactors.length ||
          (castReaction && usedReactors.includes(value.rollerActorId)) ||
          chain.some(
            ({ againstActorId }, index) => index > 0 && againstActorId !== chainReactors[index - 1]
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['failedCounters'],
            message:
              'Each reactor uses one counter in a cast, is not offered it again, and each standing counter answers the one before it.'
          })
        if (value.heldD20 && value.d20Policy === null && !value.contest)
          context.addIssue({
            code: 'custom',
            path: ['heldD20'],
            message: 'A held d20 needs the d20 policy it completes.'
          })
        if (
          value.contest &&
          ((value.contest.origin.kind === 'OPTIONAL_COMBAT' &&
            value.contest.origin.actionKind !== 'DISARM') ||
            value.d20Policy !== null ||
            value.twoPhase !== null)
        )
          context.addIssue({
            code: 'custom',
            path: ['contest'],
            message: 'Direct contest evidence cannot also retain ordinary action phases.'
          })
      })
    )
)
