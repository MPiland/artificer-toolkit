import { z } from 'zod'
import { socialListingManagementSections, socialViews } from './socialModels'

export const socialHubSearchSchema = z.object({
  view: z.enum(socialViews).catch('discover'),
  applicationPublicId: z.string().uuid().optional(),
  invitePublicId: z.string().uuid().optional(),
  query: z.string().trim().max(200).optional(),
  systemId: z.string().uuid().optional(),
  format: z.enum(['ONE_SHOT', 'ONGOING']).optional(),
  contentMaturity: z.enum(['STANDARD', 'MATURE']).optional(),
  toneTags: z
    .array(
      z.enum(['LIGHTHEARTED', 'HEROIC', 'SERIOUS', 'DARK', 'GRITTY', 'HORROR', 'COMEDIC', 'COZY'])
    )
    .max(3)
    .optional(),
  playMode: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).optional(),
  timeZone: z.string().trim().max(100).optional(),
  scheduleKind: z.enum(['FLEXIBLE', 'ONE_TIME', 'RECURRING']).optional(),
  weekday: z.preprocess(
    (value) => (typeof value === 'string' && value !== '' ? Number(value) : value),
    z.number().int().min(0).max(6).optional()
  ),
  stateCode: z.string().trim().max(2).optional(),
  city: z.string().trim().max(100).optional(),
  minimumAvailableSeats: z.preprocess(
    (value) => (typeof value === 'string' && value !== '' ? Number(value) : value),
    z.number().int().min(1).max(100).optional()
  ),
  safetyPractice: z
    .enum(['SESSION_ZERO', 'LINES_AND_VEILS', 'X_CARD', 'OPEN_DOOR', 'SCRIPT_CHANGE', 'OTHER'])
    .optional()
})

export const socialListingManagementSearchSchema = z.object({
  section: z.enum(socialListingManagementSections).catch('listing'),
  invitePublicId: z.string().uuid().optional()
})

export type SocialHubSearch = z.infer<typeof socialHubSearchSchema>
