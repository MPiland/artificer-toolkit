import { z, lazySchema } from '../zod.js'
import { d20RolledAddedDieDtoSchema } from './d20AddedDice.js'
import { encounterActionPauseDtoSchema } from './encounterPause.js'
import {
  directActionTwoPhaseDtoSchema,
  validateEncounterLegendaryResistancePin
} from './ruleExecutionDirectActionPendingContexts.js'
import {
  serverRuleExecutionD20BeliefDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from './ruleExecutionEvidence.js'
import { d20WindowReactorActorId, isD20RolledCheck } from './ruleExecutionD20WindowOffer.js'
import { isDamageRollWindow } from './ruleExecutionDamageRollWindow.js'
import { validateEncounterOnHitOption } from './ruleExecutionOnHitChoice.js'
import {
  encounterSettledIncomingGateDtoSchema,
  validateEncounterReactionPin
} from './ruleExecutionReactionChoice.js'
import {
  ruleExecutionChecksumSchema,
  ruleExecutionNonNegativeIntegerSchema,
  ruleExecutionReceiptD20FaceSchema,
  ruleExecutionUuidSchema
} from './ruleExecutionPrimitives.js'
import { serverContestCheckPendingContextDtoSchema } from './ruleExecutionOptionalCombatPending.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'

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

/**
 * The child actions of the reactions chosen against a held parent, in the order they were chosen
 * (D219): a pending action, or a Scene move paused on a reaction choice. Only a child recorded here
 * is admitted while the parent is held, and each one that commits moves the parent's occurrence one
 * Run version on. `resumeOutcome` is what the committed child does to the parent it answered: the
 * mode it imposes on the parent's roll, or the stop it puts to the parent's move, and null when it
 * does neither; it is absent until the room resumes the parent after the child. `rolledDie` is the
 * die the committed child rolled against the parent's roll, with its faces, recorded by that same
 * resume: a replay of the parent reads the die from here and does not roll it again.
 */
export const encounterReactionChildrenDtoSchema = lazySchema(() =>
  z
    .array(
      z
        .strictObject({
          commandId: ruleExecutionUuidSchema,
          resumeOutcome: z.optional(
            z.nullable(
              z.discriminatedUnion('kind', [
                z.strictObject({ kind: z.literal('ROLL_MODE'), rollMode: systemCoreCodeSchema }),
                z.strictObject({ kind: z.literal('STOP') })
              ])
            )
          ),
          rolledDie: z.optional(d20RolledAddedDieDtoSchema)
        })
        .check(
          z.superRefine((child, context) => {
            if (
              child.rolledDie &&
              (child.resumeOutcome === undefined ||
                child.rolledDie.spentEffectId !== undefined ||
                child.rolledDie.spentReaction !== undefined)
            )
              context.addIssue({
                code: 'custom',
                path: ['rolledDie'],
                message:
                  'Only a child the action resumed from records its die, which the child itself spent.'
              })
          })
        )
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
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
       * The gate the action's source already passed (a ward's save, or its reaction trigger's check),
       * carried by every later pause of the action so its replay does not ask for the roll again.
       */
      passedIncomingGate: z.optional(encounterSettledIncomingGateDtoSchema),
      /** The child actions of the reactions chosen against this action (D219). */
      reactionChildren: z.optional(encounterReactionChildrenDtoSchema),
      /**
       * The level this action casts its spell at, recorded with its reaction children: a child reads
       * the cast it answers from here, not from its own command (D219). Absent for an action that
       * casts no spell.
       */
      castLevel: z.optional(ruleExecutionNonNegativeIntegerSchema),
      /**
       * The spell slot this action's cast spends when it commits, recorded with its reaction children:
       * a reaction to one of those children is offered to this action's caster against the slots the
       * cast leaves (D219). Absent for an action whose cast spends no slot.
       */
      castSlotKey: z.optional(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
      )
    })
    .check(
      z.superRefine((value, context) => {
        const { pause } = value
        for (const [path, name] of [
          ['castLevel', 'level'],
          ['castSlotKey', 'slot']
        ] as const)
          if (value[path] !== undefined && !value.reactionChildren?.length)
            context.addIssue({
              code: 'custom',
              path: [path],
              message: `Only an action that records a reaction child records its cast ${name}.`
            })
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
                // An offer made after the attack roll or its hit holds that TEST; every other is held before any.
                (pause.payload.rolled || pause.payload.hit ? !test : value.twoPhase !== null) ||
                pause.payload.reactions.some(
                  ({ reactorActorId }) => reactorActorId !== value.rollerActorId
                ) ||
                pause.payload.declinedReactorActorIds.includes(value.rollerActorId)
              )
                issue(
                  'A cast reaction offer belongs to a cast held before it executes, or to a TEST held on its rolled d20 or its hit.'
                )
              break
            case 'INCOMING_GATE':
              if (
                holdsActionD20 ||
                value.twoPhase !== null ||
                value.passedIncomingGate !== undefined ||
                (pause.payload.origin.kind === 'WARD' &&
                  pause.payload.origin.holderActorId === value.rollerActorId)
              )
                issue('An incoming gate roll belongs to an action held before it executes.')
              break
            case 'ATTACK_RETARGET':
              if (
                holdsActionD20 ||
                value.twoPhase !== null ||
                value.passedIncomingGate !== undefined ||
                pause.payload.gate.origin.holderActorId === value.rollerActorId ||
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
            case 'ROLL_WINDOW': {
              // A damage roll's window follows a SINGLE or OUTCOME phase that rolled with no d20 held (D208).
              if (isDamageRollWindow(pause.payload)) {
                if (holdsActionD20 || test)
                  issue('A damage roll window belongs to a settled phase held for its caster.')
                break
              }
              const reactor = d20WindowReactorActorId(pause.payload)
              if (holdsActionD20 || !value.twoPhase || isD20RolledCheck(pause.payload.rolled))
                issue(
                  'A d20 window belongs to a TEST or nested OUTCOME save held for the roller who holds a die.'
                )
              // A reactor's window is answered by that reactor, never by the creature that rolled.
              if (
                reactor !== null &&
                (reactor !== value.rollerActorId || value.twoPhase?.phase !== 'TEST')
              )
                issue('A reactor window belongs to an attack TEST held for that reactor.')
              break
            }
          }
        }
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
