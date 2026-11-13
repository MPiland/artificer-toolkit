import { z, lazySchema, lazySchemaParts } from '../zod.js'
import {
  encounterLegendaryResistanceOfferDtoSchema,
  type EncounterLegendaryResistanceOfferDto
} from './ruleExecutionDirectActionPendingContexts.js'
import {
  d20WindowPausePayloadDtoSchema,
  type D20WindowPausePayloadDto
} from './ruleExecutionD20WindowOffer.js'
import {
  damageRollWindowPayloadDtoSchema,
  type DamageRollWindowPayloadDto
} from './ruleExecutionDamageRollWindow.js'
import {
  encounterForcedMovementOfferDtoSchema,
  type EncounterForcedMovementOfferDto
} from './ruleExecutionForcedMovementChoice.js'
import {
  encounterOnHitOfferDtoSchema,
  type EncounterOnHitOfferDto
} from './ruleExecutionOnHitChoice.js'
import {
  encounterAttackRetargetOfferDtoSchema,
  encounterCastReactionOfferDtoSchema,
  encounterIncomingGateOfferDtoSchema,
  type EncounterAttackRetargetOfferDto,
  type EncounterCastReactionOfferDto,
  type EncounterIncomingGateOfferDto
} from './ruleExecutionReactionChoice.js'

/**
 * The one thing a paused occurrence waits on before it may go on (ADR 0039 decision 3): its kind and
 * what was offered. Every pending choice shares the sealed-choice lifecycle; the incoming gate is the
 * one member that waits on a d20 rather than a choice.
 */
export type EncounterPauseDto =
  | { kind: 'LEGENDARY_RESISTANCE'; payload: EncounterLegendaryResistanceOfferDto }
  | { kind: 'CAST_REACTION'; payload: EncounterCastReactionOfferDto }
  | { kind: 'INCOMING_GATE'; payload: EncounterIncomingGateOfferDto }
  | { kind: 'ATTACK_RETARGET'; payload: EncounterAttackRetargetOfferDto }
  | { kind: 'ON_HIT'; payload: EncounterOnHitOfferDto }
  | { kind: 'FORCED_MOVEMENT'; payload: EncounterForcedMovementOfferDto }
  | { kind: 'ROLL_WINDOW'; payload: D20WindowPausePayloadDto }

/**
 * The pauses an Encounter action holds: its TEST's d20 window, the window its damage roll extends it
 * to (D208), and every choice it offers.
 */
export type EncounterActionPauseDto =
  | Exclude<EncounterPauseDto, { kind: 'ROLL_WINDOW' }>
  | { kind: 'ROLL_WINDOW'; payload: D20WindowPausePayloadDto | DamageRollWindowPayloadDto }

export type EncounterPauseKind = EncounterPauseDto['kind']

/** The payload a pause of one kind carries. */
export type EncounterPausePayload<Kind extends EncounterPauseKind> = Extract<
  EncounterPauseDto,
  { kind: Kind }
>['payload']

const pauseVariant = <const Kind extends EncounterPauseKind>(
  kind: Kind,
  payload: z.ZodMiniType<EncounterPausePayload<Kind>>
) => z.strictObject({ kind: z.literal(kind), payload })

/** Every pause kind with its payload, defined once; each pending context takes the members it holds. */
export const encounterPauseVariants = lazySchemaParts(() => ({
  LEGENDARY_RESISTANCE: pauseVariant(
    'LEGENDARY_RESISTANCE',
    encounterLegendaryResistanceOfferDtoSchema
  ),
  CAST_REACTION: pauseVariant('CAST_REACTION', encounterCastReactionOfferDtoSchema),
  INCOMING_GATE: pauseVariant('INCOMING_GATE', encounterIncomingGateOfferDtoSchema),
  ATTACK_RETARGET: pauseVariant('ATTACK_RETARGET', encounterAttackRetargetOfferDtoSchema),
  ON_HIT: pauseVariant('ON_HIT', encounterOnHitOfferDtoSchema),
  FORCED_MOVEMENT: pauseVariant('FORCED_MOVEMENT', encounterForcedMovementOfferDtoSchema),
  ROLL_WINDOW: pauseVariant('ROLL_WINDOW', d20WindowPausePayloadDtoSchema)
}))

// Explicitly typed so the pending-context declaration stays within the compiler's size limit (TS7056).
export const encounterActionPauseDtoSchema: z.ZodMiniType<EncounterActionPauseDto> = lazySchema(
  () => {
    const variants = encounterPauseVariants()
    return z.discriminatedUnion('kind', [
      variants.LEGENDARY_RESISTANCE,
      variants.CAST_REACTION,
      variants.INCOMING_GATE,
      variants.ATTACK_RETARGET,
      variants.ON_HIT,
      variants.FORCED_MOVEMENT,
      z.strictObject({
        kind: z.literal('ROLL_WINDOW'),
        payload: z.union([d20WindowPausePayloadDtoSchema, damageRollWindowPayloadDtoSchema])
      })
    ])
  }
)
