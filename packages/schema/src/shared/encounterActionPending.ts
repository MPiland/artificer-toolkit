import { z, lazySchema } from '../zod.js'
import {
  directActionTwoPhaseDtoSchema,
  encounterLegendaryResistanceOfferDtoSchema,
  validateEncounterLegendaryResistancePin
} from './ruleExecutionDirectActionPendingContexts.js'
import {
  serverRuleExecutionD20BeliefDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from './ruleExecutionEvidence.js'
import {
  encounterOnHitOfferDtoSchema,
  validateEncounterOnHitOption
} from './ruleExecutionOnHitChoice.js'
import {
  encounterCastReactionOfferDtoSchema,
  encounterFailedCounterDtoSchema,
  encounterReactionOfferDtoSchema,
  validateEncounterReactionPin
} from './ruleExecutionReactionChoice.js'
import {
  ruleExecutionChecksumSchema,
  ruleExecutionReceiptD20FaceSchema,
  ruleExecutionUuidSchema
} from './ruleExecutionPrimitives.js'
import { serverContestCheckPendingContextDtoSchema } from './ruleExecutionOptionalCombatPending.js'
import { encounterForcedMovementOfferDtoSchema } from './ruleExecutionForcedMovementChoice.js'
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
      /** The mode the roller's own facts imply, shown at the roll prompt (ATTACK-10.1). */
      d20Belief: z.optional(serverRuleExecutionD20BeliefDtoSchema),
      /** The d20 a roller already entered while the server waits for one more to settle the true mode. */
      heldD20: z.optional(encounterActionHeldD20DtoSchema),
      /**
       * Set while the target's failed save waits on its Legendary Resistance choice. The snapshot's
       * continuation is that choice; the TEST stays unsettled until the answer.
       */
      legendaryResistance: z.optional(encounterLegendaryResistanceOfferDtoSchema),
      /**
       * Set while a hit attack waits on its target's reaction decision. The snapshot's continuation is
       * that choice; the TEST stays unsettled until the answer.
       */
      reactionChoice: z.optional(encounterReactionOfferDtoSchema),
      /**
       * Set while a cast waits, before it executes, on a creature's chance to counter it. The roller is
       * that creature; the snapshot's continuation is its sealed reaction choice. No cast state is held:
       * the cast replays from the command, and the declined reactors keep the replay deterministic.
       */
      castReaction: z.optional(encounterCastReactionOfferDtoSchema),
      /**
       * The counters reactors attempted and failed against this cast, carried by every pending of the
       * cast to its terminal commit, which spends them with the cast (D127).
       */
      failedCounters: z.optional(
        z.array(encounterFailedCounterDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      /**
       * Set while a hit waits on its attacker's choice to add an optional on-hit rider, after any
       * reaction to the hit has settled. The snapshot's continuation is that choice; the TEST stays
       * unsettled until the answer.
       */
      onHitChoice: z.optional(encounterOnHitOfferDtoSchema),
      /**
       * Set while a settled action waits on its source's choice of where a push leaves a creature
       * (D157). The roller is the source; the snapshot's continuation is that choice, and the settled
       * OUTCOME's phase stays in `twoPhase` so the answer commits the action unchanged.
       */
      forcedMovementDestination: z.optional(encounterForcedMovementOfferDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (value.legendaryResistance) {
          validateEncounterLegendaryResistancePin(value.legendaryResistance.resistance, context, [
            'legendaryResistance',
            'resistance'
          ])
          if (
            value.twoPhase?.phase !== 'TEST' ||
            value.rollerActorId !== value.legendaryResistance.resistance.targetActorId ||
            value.d20Policy !== null ||
            value.contest ||
            value.heldD20
          )
            context.addIssue({
              code: 'custom',
              path: ['legendaryResistance'],
              message:
                'A Legendary Resistance offer belongs to a TEST held for the resisting creature.'
            })
        }
        if (value.reactionChoice) {
          for (const [index, reaction] of value.reactionChoice.reactions.entries())
            validateEncounterReactionPin(reaction, context, ['reactionChoice', 'reactions', index])
          if (
            value.legendaryResistance ||
            value.twoPhase?.phase !== 'TEST' ||
            value.reactionChoice.reactions.some(
              ({ reactorActorId }) => reactorActorId !== value.rollerActorId
            ) ||
            value.d20Policy !== null ||
            value.contest ||
            value.heldD20
          )
            context.addIssue({
              code: 'custom',
              path: ['reactionChoice'],
              message: 'A reaction offer belongs to a TEST held for the reacting creature.'
            })
        }
        if (value.castReaction) {
          for (const [index, reaction] of value.castReaction.reactions.entries())
            validateEncounterReactionPin(reaction, context, ['castReaction', 'reactions', index])
          if (
            value.legendaryResistance ||
            value.reactionChoice ||
            value.onHitChoice ||
            value.twoPhase !== null ||
            value.d20Policy !== null ||
            value.contest ||
            value.heldD20 ||
            value.castReaction.reactions.some(
              ({ reactorActorId }) => reactorActorId !== value.rollerActorId
            ) ||
            value.castReaction.declinedReactorActorIds.includes(value.rollerActorId) ||
            (value.castReaction.check !== undefined && value.castReaction.reactions.length !== 1)
          )
            context.addIssue({
              code: 'custom',
              path: ['castReaction'],
              message: 'A cast reaction offer belongs to a cast held before it executes.'
            })
        }
        const chain = value.castReaction?.chain?.counters ?? []
        const failedReactors = (value.failedCounters ?? []).map(
          ({ reaction }) => reaction.reactorActorId
        )
        const chainReactors = chain.map(({ reaction }) => reaction.reactorActorId)
        const usedReactors = [...failedReactors, ...chainReactors]
        if (
          new Set(usedReactors).size !== usedReactors.length ||
          (value.castReaction && usedReactors.includes(value.rollerActorId)) ||
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
        if (value.onHitChoice) {
          for (const [index, option] of value.onHitChoice.options.entries())
            validateEncounterOnHitOption(option, value.onHitChoice.testExecutionChecksum, context, [
              'onHitChoice',
              'options',
              index
            ])
          if (
            value.legendaryResistance ||
            value.reactionChoice ||
            value.castReaction ||
            value.twoPhase?.phase !== 'TEST' ||
            value.d20Policy !== null ||
            value.contest ||
            value.heldD20
          )
            context.addIssue({
              code: 'custom',
              path: ['onHitChoice'],
              message: 'An on-hit offer belongs to a TEST held for the attacker.'
            })
        }
        if (
          value.forcedMovementDestination &&
          (value.legendaryResistance ||
            value.reactionChoice ||
            value.castReaction ||
            value.onHitChoice ||
            value.twoPhase?.phase === 'TEST' ||
            value.d20Policy !== null ||
            value.contest ||
            value.heldD20)
        )
          context.addIssue({
            code: 'custom',
            path: ['forcedMovementDestination'],
            message:
              'A forced-movement destination belongs to a settled action held for its source.'
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
