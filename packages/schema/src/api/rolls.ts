import { z, lazySchema } from '../zod.js'
import { d20FoldedBonusesDtoSchema } from '../shared/d20FoldedBonuses.js'
import {
  rollModeKeepSchema,
  systemCoreCodeEntrySchema,
  systemCoreCodeSchema
} from '../shared/systemCoreCode.js'
import {
  parseRollExpression,
  parseStandaloneDiceConfiguration
} from '@artificer-toolkit/shared/rolls'

export const rollSourceDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum([
      'MANUAL',
      'ABILITY_CHECK',
      'SAVING_THROW',
      'SKILL_CHECK',
      'INITIATIVE',
      'ATTACK',
      'DAMAGE',
      'HEALING',
      'HIT_DIE',
      'DEATH_SAVE',
      'RECHARGE',
      'TABLE'
    ]),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
  })
)

export const executeRollInputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      characterId: z.string().check(z.minLength(1)),
      expression: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
      rollMode: z.optional(systemCoreCodeSchema),
      source: rollSourceDtoSchema
    })
    .check(
      z.superRefine(({ expression }, context) => {
        try {
          parseRollExpression(expression)
        } catch (error) {
          context.addIssue({
            code: 'custom',
            path: ['expression'],
            message: error instanceof Error ? error.message : 'Invalid roll expression.'
          })
        }
      })
    )
)

export const standaloneDiceConfigurationDtoSchema = lazySchema(() =>
  z
    .string()
    .check(z.trim())
    .check(z.minLength(1))
    .check(z.maxLength(80))
    .check(
      z.superRefine((configuration, context) => {
        try {
          parseStandaloneDiceConfiguration(configuration)
        } catch (error) {
          context.addIssue({
            code: 'custom',
            message: error instanceof Error ? error.message : 'Invalid dice configuration.'
          })
        }
      })
    )
)

export const executeDiceConfigurationInputDtoSchema = lazySchema(() =>
  z.strictObject({
    configuration: standaloneDiceConfigurationDtoSchema
  })
)

const rollTermEvidenceDtoSchema = lazySchema(() =>
  z.object({
    count: z.number().check(z.int()).check(z.positive()),
    die: z.union([
      z.literal(4),
      z.literal(6),
      z.literal(8),
      z.literal(10),
      z.literal(12),
      z.literal(20),
      z.literal(100)
    ]),
    modifier: z.optional(z.number().check(z.int())),
    rolls: z.array(z.number().check(z.int()).check(z.positive())),
    rollSequences: z.optional(
      z.array(z.array(z.number().check(z.int()).check(z.positive())).check(z.minLength(1)))
    ),
    subtotal: z.number().check(z.int()),
    keptRollIndex: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    keptRollIndexes: z.optional(z.array(z.number().check(z.int()).check(z.nonnegative()))),
    /** A die a rule subtracts from a d20 test (D156: Bane's d4); its subtotal is negative. */
    subtracted: z.optional(z.literal(true))
  })
)

const rollTransformDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('NONE') }),
    z.object({ kind: z.literal('HALF') }),
    z.object({ kind: z.literal('DOUBLE') }),
    z.object({ kind: z.literal('MULTIPLY'), value: z.number().check(z.int()).check(z.positive()) })
  ])
)

export const rollEvidenceDtoSchema = lazySchema(() =>
  z.object({
    terms: z.array(rollTermEvidenceDtoSchema).check(z.maxLength(10)),
    modifier: z.number().check(z.int()),
    /** The System roll-mode code and its label; present only for a System-governed d20 roll. */
    mode: z.optional(systemCoreCodeSchema),
    modeLabel: z.optional(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))),
    /** Which face the roll counts: the one rolled (FIRST), or the higher or lower of two. */
    keep: rollModeKeepSchema,
    subtotal: z.number().check(z.int()),
    transform: rollTransformDtoSchema,
    total: z.number().check(z.int())
  })
)

export const rollResultDtoSchema = lazySchema(() =>
  z.object({
    id: z.string(),
    normalizedExpression: z.string(),
    evidence: rollEvidenceDtoSchema
  })
)

const ruleCheckLabelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
)

/**
 * What an automatic rule roll checked, beside its dice. One member per rule kind; a log entry names
 * the actor, the trigger, the target number and the outcome.
 */
export const rollRuleCheckDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CONCENTRATION'),
      actorId: z.string().check(z.uuid()),
      actorLabel: ruleCheckLabelSchema,
      damage: z.strictObject({
        amount: z.number().check(z.int()).check(z.positive()),
        typeLabel: z.nullable(ruleCheckLabelSchema)
      }),
      /** The spell, action or turn effect that dealt the damage; null when it has no name. */
      sourceLabel: z.nullable(ruleCheckLabelSchema),
      dc: z.number().check(z.int()).check(z.positive()),
      faces: z
        .array(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
        .check(z.minLength(1))
        .check(z.maxLength(2)),
      modifier: z.number().check(z.int()),
      total: z.number().check(z.int()),
      outcome: z.enum(['KEPT', 'LOST'])
    }),
    /**
     * A d20 the server settled in another mode than the one rolled for (ATTACK-10.1). The record's
     * d20 term lists every die, rolled then added; the indexes point into that list.
     */
    z.strictObject({
      kind: z.literal('D20_MODE_ADJUSTED'),
      rolledMode: systemCoreCodeEntrySchema,
      appliedMode: systemCoreCodeEntrySchema,
      cancelledRollIndexes: z.array(z.number().check(z.int()).check(z.gte(0)).check(z.lte(2))),
      addedRollIndexes: z.array(z.number().check(z.int()).check(z.gte(0)).check(z.lte(2))),
      caption: z.nullable(ruleCheckLabelSchema)
    }),
    /**
     * A d20 check a floor raised (Glibness's 15): the d20 term's subtotal is the floor, its rolls
     * keep the face rolled, and the record's total counts the floor.
     */
    z.strictObject({
      kind: z.literal('D20_MINIMUM_ROLL'),
      amount: z.number().check(z.int()).check(z.gte(2)).check(z.lte(20)),
      /** The source that gave the floor; "Unseen source" for a hidden one. */
      label: ruleCheckLabelSchema
    }),
    /**
     * A saving throw a condition made fail without counting the roll (D94): the d20 term shows the
     * dice as rolled, and the conditions are why the save failed whatever they show.
     */
    z.strictObject({
      kind: z.literal('SAVE_AUTO_FAIL'),
      labels: z.array(ruleCheckLabelSchema).check(z.minLength(1)).check(z.maxLength(32))
    })
  ])
)

export const rollRecordDtoSchema = lazySchema(() =>
  z.extend(rollResultDtoSchema, {
    characterId: z.nullable(z.string()),
    characterLabel: z.string(),
    source: rollSourceDtoSchema,
    ruleset: z.object({
      systemId: z.string(),
      code: z.string(),
      version: z.string()
    }),
    createdAt: z.string(),
    /** Present when a rule rolled automatically or settled a prompted roll. */
    ruleCheck: z.optional(rollRuleCheckDtoSchema),
    foldedBonuses: z.optional(d20FoldedBonusesDtoSchema)
  })
)

/**
 * Who sees a GM roll (Q14, D83): a PRIVATE roll shows players nothing, not even that it happened,
 * until the GM reveals it. The GM's roll controls and stored preference share this vocabulary.
 */
export const rollVisibilityDtoSchema = lazySchema(() => z.enum(['PUBLIC', 'PRIVATE']))

/** The two logged, non-retractable reveals of a private roll. */
export const rollRevealModeDtoSchema = lazySchema(() => z.enum(['FULL', 'NOTICE']))

/**
 * Binds a GM-retained roll to its Campaign. `creature` names the Encounter actor that rolled, so a
 * "Show that I rolled" notice can name it only while players can see it; null for a manual roll.
 * It records when each reveal posted, so each mode happens once and a FULL reveal may still follow
 * a NOTICE.
 */
export const gmCampaignRollDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: z.string(),
    creature: z.nullable(z.strictObject({ encounterId: z.string(), actorId: z.string() })),
    revealedAt: z.nullable(z.string()),
    noticedAt: z.nullable(z.string())
  })
)

export const rollHistoryEntryDtoSchema = lazySchema(() =>
  z.extend(rollRecordDtoSchema, { gmCampaignRoll: z.nullable(gmCampaignRollDtoSchema) })
)

export const rollHistoryResponseDtoSchema = lazySchema(() =>
  z.array(rollHistoryEntryDtoSchema).check(z.maxLength(20))
)

export const rollIdInputDtoSchema = lazySchema(() =>
  z.strictObject({
    id: z.pipe(
      z.uuid(),
      z.transform((value) => value.toLowerCase())
    )
  })
)

export type RollSourceDto = z.infer<typeof rollSourceDtoSchema>
export type ExecuteRollInputDto = z.infer<typeof executeRollInputDtoSchema>
export type ExecuteDiceConfigurationInputDto = z.infer<
  typeof executeDiceConfigurationInputDtoSchema
>
export type RollEvidenceDto = z.infer<typeof rollEvidenceDtoSchema>
export type RollResultDto = z.infer<typeof rollResultDtoSchema>
export type RollRuleCheckDto = z.infer<typeof rollRuleCheckDtoSchema>
export type RollRecordDto = z.infer<typeof rollRecordDtoSchema>
export type RollVisibilityDto = z.infer<typeof rollVisibilityDtoSchema>
export type RollRevealModeDto = z.infer<typeof rollRevealModeDtoSchema>
export type GmCampaignRollDto = z.infer<typeof gmCampaignRollDtoSchema>
export type RollHistoryEntryDto = z.infer<typeof rollHistoryEntryDtoSchema>
export type RollHistoryResponseDto = z.infer<typeof rollHistoryResponseDtoSchema>
export type RollIdInputDto = z.infer<typeof rollIdInputDtoSchema>
