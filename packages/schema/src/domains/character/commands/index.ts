import { z } from 'zod'

/* ──────────────────────────────────────────────
 * Shared primitives
 * ────────────────────────────────────────────── */

const contentRefSchema = z.object({
  contentId: z.string().min(1),
  contentVersionId: z.string().optional(),
  systemId: z.string().min(1),
})

/** Common envelope fields present on every command. */
const commandEnvelopeSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  /**
   * The stream_version the client last observed.
   * The lifecycle service rejects the command with 409 if this doesn't match.
   * createCharacter commands use expectedVersion: 0.
   */
  expectedVersion: z.number().int().min(0),
})

/* ──────────────────────────────────────────────
 * Command schemas
 * ────────────────────────────────────────────── */

export const createCharacterCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('CREATE_CHARACTER'),
  name: z.string().min(1).max(100),
  systemId: z.string().min(1),
})

export const assignAbilityScoresCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('ASSIGN_ABILITY_SCORES'),
  method: z.enum(['STANDARD_ARRAY', 'POINT_BUY', 'MANUAL_ROLLED']),
  /** Ability code → assigned score */
  assignments: z.record(z.string(), z.number().int().min(1).max(30)),
  /** Full dice history — required when method is MANUAL_ROLLED */
  rolls: z.array(z.object({
    rollGroupId: z.string(),
    dice: z.array(z.number().int().min(1)),
    dropped: z.array(z.number().int().min(1)),
    total: z.number().int(),
  })).optional(),
})

export const gainClassLevelCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('GAIN_CLASS_LEVEL'),
  classRef: contentRefSchema,
  subclassRef: contentRefSchema.optional(),
})

export const applyHitPointsCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('APPLY_HIT_POINTS'),
  classRef: contentRefSchema,
  classLevel: z.number().int().min(1).max(20),
  method: z.enum(['ROLLED', 'AVERAGE', 'MAXIMUM']),
  /** Die result — required when method is ROLLED */
  roll: z.number().int().optional(),
})

export const makeFeatureSelectionCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('MAKE_FEATURE_SELECTION'),
  featureId: z.string().min(1),
  choiceKey: z.string().min(1),
  selectedOptionRefs: z.array(contentRefSchema).min(1),
  atLevel: z.number().int().min(1),
})

export const chooseFeatCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('CHOOSE_FEAT'),
  featRef: contentRefSchema,
  sourceFeatureId: z.string().min(1),
})

export const updateSpellSelectionCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('UPDATE_SPELL_SELECTION'),
  classRef: contentRefSchema,
  added: z.array(contentRefSchema),
  removed: z.array(contentRefSchema),
})

export const acquireEquipmentCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('ACQUIRE_EQUIPMENT'),
  instanceId: z.string().uuid(),
  contentRef: contentRefSchema,
  quantity: z.number().int().min(1).default(1),
  source: z.enum(['STARTING_EQUIPMENT', 'PURCHASED', 'FOUND', 'GRANTED']),
})

export const equipItemCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('EQUIP_ITEM'),
  instanceId: z.string().uuid(),
  slot: z.enum(['ARMOR', 'SHIELD', 'MAIN_HAND', 'OFF_HAND', 'RING', 'GENERIC']),
  /** Required when slot is RING */
  ringPosition: z.union([z.literal(1), z.literal(2)]).optional(),
})

export const unequipItemCommandSchema = commandEnvelopeSchema.extend({
  type: z.literal('UNEQUIP_ITEM'),
  instanceId: z.string().uuid(),
})

/* ──────────────────────────────────────────────
 * Discriminated union — used for single command dispatch route
 * ────────────────────────────────────────────── */

export const characterCommandUnionSchema = z.discriminatedUnion('type', [
  createCharacterCommandSchema,
  assignAbilityScoresCommandSchema,
  gainClassLevelCommandSchema,
  applyHitPointsCommandSchema,
  makeFeatureSelectionCommandSchema,
  chooseFeatCommandSchema,
  updateSpellSelectionCommandSchema,
  acquireEquipmentCommandSchema,
  equipItemCommandSchema,
  unequipItemCommandSchema,
])

export type CharacterCommandUnion = z.infer<typeof characterCommandUnionSchema>

/* ──────────────────────────────────────────────
 * Inferred TypeScript types
 * ────────────────────────────────────────────── */

export type CreateCharacterCommand = z.infer<typeof createCharacterCommandSchema>
export type AssignAbilityScoresCommand = z.infer<typeof assignAbilityScoresCommandSchema>
export type GainClassLevelCommand = z.infer<typeof gainClassLevelCommandSchema>
export type ApplyHitPointsCommand = z.infer<typeof applyHitPointsCommandSchema>
export type MakeFeatureSelectionCommand = z.infer<typeof makeFeatureSelectionCommandSchema>
export type ChooseFeatCommand = z.infer<typeof chooseFeatCommandSchema>
export type UpdateSpellSelectionCommand = z.infer<typeof updateSpellSelectionCommandSchema>
export type AcquireEquipmentCommand = z.infer<typeof acquireEquipmentCommandSchema>
export type EquipItemCommand = z.infer<typeof equipItemCommandSchema>
export type UnequipItemCommand = z.infer<typeof unequipItemCommandSchema>
