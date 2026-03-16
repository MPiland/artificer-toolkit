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
    scalingSource: z.literal('PARENT_CLASS_LEVEL'),
    levels: z.array(levelScaledValueLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('SPELL_CAST_LEVEL'),
    levels: z.array(levelScaledValueLevelDtoSchema)
  })
])

export type LevelScaledValueDto = z.infer<typeof levelScaledValueDtoSchema>
