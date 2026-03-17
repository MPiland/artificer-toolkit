import { z } from 'zod'

/* ──────────────────────────────────────────────
 * Shared primitives
 * ────────────────────────────────────────────── */

const contentRefSchema = z.object({
  contentId: z.string().min(1),
  contentVersionId: z.string().optional(),
  systemId: z.string().min(1),
})

/* ──────────────────────────────────────────────
 * Command schemas
 * ────────────────────────────────────────────── */

export const createCharacterCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  name: z.string().min(1).max(100),
  systemId: z.string().min(1),
})

export const assignAbilityScoresCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
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

export const gainClassLevelCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  classRef: contentRefSchema,
  subclassRef: contentRefSchema.optional(),
})

export const applyHitPointsCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  classRef: contentRefSchema,
  classLevel: z.number().int().min(1).max(20),
  method: z.enum(['ROLLED', 'AVERAGE', 'MAXIMUM']),
  /** Die result — required when method is ROLLED */
  roll: z.number().int().optional(),
})

export const makeFeatureSelectionCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  featureId: z.string().min(1),
  choiceKey: z.string().min(1),
  selectedOptionRefs: z.array(contentRefSchema).min(1),
  atLevel: z.number().int().min(1),
})

export const chooseFeatCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  featRef: contentRefSchema,
  sourceFeatureId: z.string().min(1),
})

export const updateSpellSelectionCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  classRef: contentRefSchema,
  added: z.array(contentRefSchema),
  removed: z.array(contentRefSchema),
})

export const acquireEquipmentCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  instanceId: z.string().uuid(),
  contentRef: contentRefSchema,
  quantity: z.number().int().min(1).default(1),
  source: z.enum(['STARTING_EQUIPMENT', 'PURCHASED', 'FOUND', 'GRANTED']),
})

export const equipItemCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  instanceId: z.string().uuid(),
  slot: z.enum(['ARMOR', 'SHIELD', 'MAIN_HAND', 'OFF_HAND', 'RING', 'GENERIC']),
  /** Required when slot is RING */
  ringPosition: z.union([z.literal(1), z.literal(2)]).optional(),
})

export const unequipItemCommandSchema = z.object({
  characterId: z.string().uuid(),
  actorId: z.string().min(1),
  commandId: z.string().uuid(),
  instanceId: z.string().uuid(),
})

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
