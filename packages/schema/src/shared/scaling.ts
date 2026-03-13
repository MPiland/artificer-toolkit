import { z } from 'zod'

export const levelScaledValueLevelDtoSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  order: z.number().int()
})

export const levelScaledValueDtoSchema = z.discriminatedUnion('scalingSource', [
  z.object({
    scalingSource: z.literal('CHARACTER_LEVEL'),
    levels: z.array(levelScaledValueLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('CLASS_LEVEL'),
    classId: z.string(),
    levels: z.array(levelScaledValueLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('SPELL_LEVEL'),
    spellId: z.string(),
    levels: z.array(levelScaledValueLevelDtoSchema)
  })
])

const poolScaledValueBaseDtoSchema = z.object({
  amount: z.number().optional(),
  multiplier: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional()
})

export const poolScaledValueDtoSchema = z.discriminatedUnion('scalingSource', [
  z.object({
    scalingSource: z.literal('CHARACTER_LEVEL')
  }).merge(poolScaledValueBaseDtoSchema),
  z.object({
    scalingSource: z.literal('CLASS_LEVEL'),
    classId: z.string()
  }).merge(poolScaledValueBaseDtoSchema),
  z.object({
    scalingSource: z.literal('SPELL_LEVEL'),
    spellId: z.string()
  }).merge(poolScaledValueBaseDtoSchema)
])

export type LevelScaledValueDto = z.infer<typeof levelScaledValueDtoSchema>
export type PoolScaledValueDto = z.infer<typeof poolScaledValueDtoSchema>
