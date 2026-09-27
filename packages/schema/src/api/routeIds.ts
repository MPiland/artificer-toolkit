import { z, lazySchema } from '../zod.js'

export const routeSubjectKindDtoSchema = lazySchema(() =>
  z.enum([
    'BACKGROUND',
    'CAMPAIGN',
    'CHARACTER',
    'CLASS',
    'CREATURE',
    'EQUIPMENT',
    'FEAT',
    'RACE',
    'SPELL',
    'VEHICLE'
  ])
)

export const routeIdentityDtoSchema = lazySchema(() =>
  z.object({
    subjectKind: routeSubjectKindDtoSchema,
    subjectId: z.string(),
    publicId: z.string()
  })
)

export const routeIdentityResolveRequestDtoSchema = lazySchema(() =>
  z.object({
    subjectKind: routeSubjectKindDtoSchema,
    publicId: z.string().check(z.minLength(1))
  })
)

export const routeIdentityBySubjectRequestDtoSchema = lazySchema(() =>
  z.object({
    subjectKind: routeSubjectKindDtoSchema,
    subjectId: z.string().check(z.minLength(1))
  })
)

export type RouteSubjectKindDto = z.infer<typeof routeSubjectKindDtoSchema>
export type RouteIdentityDto = z.infer<typeof routeIdentityDtoSchema>
export type RouteIdentityResolveRequestDto = z.infer<typeof routeIdentityResolveRequestDtoSchema>
export type RouteIdentityBySubjectRequestDto = z.infer<
  typeof routeIdentityBySubjectRequestDtoSchema
>
