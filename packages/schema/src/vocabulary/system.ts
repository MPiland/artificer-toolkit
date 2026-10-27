import { z, lazySchema, lazySchemaParts } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { vocabularyDtoSchema } from './vocabulary.js'

const systemVocabularyFields = lazySchemaParts(() => ({
  id: z.string(),
  label: z.string(),
  description: z.optional(z.nullable(z.string())),
  rulesetCode: z.string(),
  rulesetVersion: z.string(),
  alignments: z.array(vocabularyDtoSchema),
  challengeRatings: z.array(systemChallengeRatingDtoSchema),
  conditionTypes: z.array(systemConditionTypeDtoSchema),
  creatureTypes: z.array(vocabularyDtoSchema),
  currencies: z.array(systemCurrencyDtoSchema),
  damageTypes: z.array(vocabularyDtoSchema),
  heritages: z.array(vocabularyDtoSchema),
  languages: z.array(vocabularyDtoSchema),
  lifestyles: z.array(vocabularyDtoSchema),
  magicSchools: z.array(vocabularyDtoSchema),
  passives: z.array(vocabularyDtoSchema),
  rarities: z.array(vocabularyDtoSchema),
  senses: z.array(vocabularyDtoSchema),
  skills: z.array(vocabularyDtoSchema),
  speeds: z.array(vocabularyDtoSchema),
  terrains: z.array(vocabularyDtoSchema),
  userId: z.string()
}))

/**
 * A System challenge rating: its XP, the proficiency bonus it grants, its place in the ascending
 * order, and its numeric value (1/8 is 0.125), which a level is compared against.
 */
const systemChallengeRatingDtoSchema = lazySchema(() =>
  z.extend(vocabularyDtoSchema, {
    xp: z.number().check(z.int()).check(z.gte(0)),
    proficiencyBonus: z.number().check(z.int()).check(z.gte(0)),
    rank: z.number().check(z.int()).check(z.gte(0)),
    value: z.number().check(z.gte(0))
  })
)

/**
 * A System condition. `levelled` marks a condition tracked as a level, not added or removed as a flag;
 * `unseen` marks one that hides its holder from players who cannot perceive them (D131).
 */
const systemConditionTypeDtoSchema = lazySchema(() =>
  z.extend(vocabularyDtoSchema, {
    levelled: z.optional(z.boolean()),
    unseen: z.optional(z.boolean())
  })
)

/** The definition IDs authoring and the Sheet fall back to when the user has not chosen one. */
const systemDefaultsDtoSchema = lazySchema(() =>
  z.strictObject({
    damageTypeId: z.string(),
    conditionTypeId: z.string(),
    movementTypeId: z.string()
  })
)

/** A System currency: its value in the System's smallest denomination. */
const systemCurrencyDtoSchema = lazySchema(() =>
  z.extend(vocabularyDtoSchema, { baseValue: z.number().check(z.int()).check(z.gte(1)) })
)

const abilityVocabularyDtoSchema = lazySchema(() =>
  z.extend(vocabularyDtoSchema, {
    id: z.pipe(
      postgresUuidSchema,
      z.transform((value) => value.toLowerCase())
    )
  })
)

/** Current System-owned semantic check definition. Display metadata remains non-mechanical. */
const systemCheckDefinitionDtoSchema = lazySchema(() =>
  z.extend(abilityVocabularyDtoSchema, {
    governingAbilityDefinitionId: z.nullable(
      z.pipe(
        postgresUuidSchema,
        z.transform((value) => value.toLowerCase())
      )
    )
  })
)

/** A System passive score (10 + a skill's modifier). It names its skill, or none when no skill underlies it, and the ability it uses. */
const systemPassiveDefinitionDtoSchema = lazySchema(() =>
  z.extend(vocabularyDtoSchema, {
    abilityDefinitionId: z.pipe(
      postgresUuidSchema,
      z.transform((value) => value.toLowerCase())
    ),
    skillDefinitionId: z.nullable(
      z.pipe(
        postgresUuidSchema,
        z.transform((value) => value.toLowerCase())
      )
    )
  })
)

const systemInitiativePolicyDtoSchema = lazySchema(() =>
  z.strictObject({
    defaultDefinitionId: z.pipe(
      postgresUuidSchema,
      z.transform((value) => value.toLowerCase())
    )
  })
)

/**
 * A System's cover tiers, ascending. A tier applies when at least `minBlockedLines` of the four
 * lines to a target square's corners are blocked; it adds `bonus` to AC and to saves of the abilities
 * in `saveAbilityDefinitionIds`, or blocks targeting outright. Creatures alone give at most `creatureMaxTierCode`.
 */
const systemCoverRulesDtoSchema = lazySchema(() =>
  z
    .strictObject({
      tiers: z
        .array(
          z.strictObject({
            code: z.string().check(z.minLength(1)),
            label: z.string().check(z.minLength(1)),
            minBlockedLines: z.number().check(z.int()).check(z.gte(1)).check(z.lte(4)),
            bonus: z.number().check(z.int()).check(z.gte(0)),
            blocksTargeting: z.boolean()
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(4)),
      creatureMaxTierCode: z.nullable(z.string()),
      /** The abilities whose saving throws a tier's bonus adds to; every other save ignores cover. */
      saveAbilityDefinitionIds: z.array(postgresUuidSchema).check(z.maxLength(6))
    })
    .check(
      z.superRefine((rules, context) => {
        for (const [index, tier] of rules.tiers.entries()) {
          if (index > 0 && tier.minBlockedLines <= rules.tiers[index - 1]!.minBlockedLines) {
            context.addIssue({
              code: 'custom',
              path: ['tiers', index, 'minBlockedLines'],
              message: 'Cover tiers must ascend by blocked lines.'
            })
          }
        }
        if (
          rules.creatureMaxTierCode !== null &&
          !rules.tiers.some((tier) => tier.code === rules.creatureMaxTierCode)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['creatureMaxTierCode'],
            message: 'The creature cover cap must name one of the cover tiers.'
          })
        }
      })
    )
)

/** A System document: UUID-backed abilities, check definitions and passives. */
export const systemAuthoredDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ...systemVocabularyFields(),
      schemaVersion: z.literal(4),
      abilities: z.array(abilityVocabularyDtoSchema).check(z.maxLength(500)),
      skills: z.array(systemCheckDefinitionDtoSchema),
      passives: z.array(systemPassiveDefinitionDtoSchema),
      initiativePolicy: z.optional(systemInitiativePolicyDtoSchema),
      defaults: z.optional(systemDefaultsDtoSchema),
      cover: z.optional(systemCoverRulesDtoSchema),
      /** The passive that notices a concealed zone (MOVE-3.5); without it no zone is noticed. */
      zoneSpotPassiveDefinitionId: z.optional(postgresUuidSchema)
    })
    .check(
      z.superRefine((document, context) => {
        const { defaults } = document
        if (defaults) {
          const lists = [
            ['damageTypeId', document.damageTypes],
            ['conditionTypeId', document.conditionTypes],
            ['movementTypeId', document.speeds]
          ] as const
          for (const [key, list] of lists) {
            if (!list.some((entry) => entry.id === defaults[key])) {
              context.addIssue({
                code: 'custom',
                path: ['defaults', key],
                message: 'System defaults must reference a definition in the same System document.'
              })
            }
          }
        }
        const abilityIds = new Set<string>()
        const abilityCodes = new Set<string>()
        for (const [index, ability] of document.abilities.entries()) {
          if (abilityIds.has(ability.id)) {
            context.addIssue({
              code: 'custom',
              path: ['abilities', index, 'id'],
              message: 'System ability definition IDs must be unique.'
            })
          }
          if (abilityCodes.has(ability.code)) {
            context.addIssue({
              code: 'custom',
              path: ['abilities', index, 'code'],
              message: 'System ability codes must be unique.'
            })
          }
          abilityIds.add(ability.id)
          abilityCodes.add(ability.code)
        }
        const checkIds = new Set<string>()
        const checkCodes = new Set<string>()
        for (const [index, check] of document.skills.entries()) {
          if (checkIds.has(check.id)) {
            context.addIssue({
              code: 'custom',
              path: ['skills', index, 'id'],
              message: 'System check definition IDs must be unique.'
            })
          }
          if (checkCodes.has(check.code)) {
            context.addIssue({
              code: 'custom',
              path: ['skills', index, 'code'],
              message: 'System check definition codes must be unique.'
            })
          }
          if (
            check.governingAbilityDefinitionId !== null &&
            !abilityIds.has(check.governingAbilityDefinitionId)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['skills', index, 'governingAbilityDefinitionId'],
              message:
                'System check definitions must reference an ability in the same System document.'
            })
          }
          checkIds.add(check.id)
          checkCodes.add(check.code)
        }
        for (const [index, passive] of document.passives.entries()) {
          if (!abilityIds.has(passive.abilityDefinitionId)) {
            context.addIssue({
              code: 'custom',
              path: ['passives', index, 'abilityDefinitionId'],
              message:
                'System passive definitions must reference an ability in the same System document.'
            })
          }
          if (passive.skillDefinitionId && !checkIds.has(passive.skillDefinitionId)) {
            context.addIssue({
              code: 'custom',
              path: ['passives', index, 'skillDefinitionId'],
              message:
                'System passive definitions must reference a skill in the same System document.'
            })
          }
        }
        if (
          document.zoneSpotPassiveDefinitionId &&
          !document.passives.some(({ id }) => id === document.zoneSpotPassiveDefinitionId)
        )
          context.addIssue({
            code: 'custom',
            path: ['zoneSpotPassiveDefinitionId'],
            message: 'The zone spot passive must be a passive in the same System document.'
          })
      })
    )
)

export type SystemAuthoredDto = z.infer<typeof systemAuthoredDtoSchema>
