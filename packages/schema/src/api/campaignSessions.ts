import { z } from 'zod'

import { authoredRichTextSchema } from '../shared/authoredLimits.js'
import { authoredSubjectKindDtoSchema } from './content.js'
import {
  shortTextSchema,
  timeZoneSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const campaignNotebookVisibilityDtoSchema = z.enum(['GM_PRIVATE', 'SHARED'])
export const campaignNotebookCategoryDtoSchema = z.enum(['GENERAL', 'PEOPLE', 'PLACES'])
export const campaignNotebookSectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  title: shortTextSchema,
  content: authoredRichTextSchema,
  visibility: campaignNotebookVisibilityDtoSchema,
  category: campaignNotebookCategoryDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const createCampaignNotebookSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  title: shortTextSchema,
  content: authoredRichTextSchema,
  visibility: campaignNotebookVisibilityDtoSchema.default('GM_PRIVATE'),
  category: campaignNotebookCategoryDtoSchema.default('GENERAL')
})
export const updateCampaignNotebookSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sectionId: uuidSchema,
  title: shortTextSchema.optional(),
  content: authoredRichTextSchema.optional(),
  visibility: campaignNotebookVisibilityDtoSchema.optional(),
  category: campaignNotebookCategoryDtoSchema.optional(),
  expectedVersion: versionSchema
})
export const deleteCampaignNotebookSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sectionId: uuidSchema
})

export const campaignSessionStatusDtoSchema = z.enum(['OPEN', 'FINISHED'])
function validateCampaignSessionSchedule(
  value: {
    scheduledStartAt: string | null
    scheduledEndAt: string | null
    timeZone: string | null
  },
  context: z.RefinementCtx
): void {
  const { scheduledStartAt, scheduledEndAt, timeZone } = value
  if (scheduledStartAt === null && scheduledEndAt === null && timeZone === null) return
  if (scheduledStartAt === null || scheduledEndAt === null || timeZone === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Session scheduling requires a start, end, and time zone.'
    })
    return
  }
  if (Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Session end must be after its start.',
      path: ['scheduledEndAt']
    })
}
export const campaignSessionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionNumber: z.number().int().positive(),
  title: shortTextSchema.nullable(),
  scheduledStartAt: timestampSchema.nullable(),
  scheduledEndAt: timestampSchema.nullable(),
  timeZone: timeZoneSchema.nullable(),
  status: campaignSessionStatusDtoSchema,
  finishedAt: timestampSchema.nullable(),
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const createCampaignSessionInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    title: shortTextSchema.nullable().optional(),
    scheduledStartAt: timestampSchema.nullable().default(null),
    scheduledEndAt: timestampSchema.nullable().default(null),
    timeZone: timeZoneSchema.nullable().default(null)
  })
  .superRefine(validateCampaignSessionSchedule)
export const updateCampaignSessionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  title: shortTextSchema.nullable().optional(),
  scheduledStartAt: timestampSchema.nullable().optional(),
  scheduledEndAt: timestampSchema.nullable().optional(),
  timeZone: timeZoneSchema.nullable().optional(),
  expectedVersion: versionSchema
})
export const deleteCampaignSessionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
const campaignLivePlayCommandBaseSchema = z.strictObject({
  campaignId: uuidSchema,
  commandId: uuidSchema,
  expectedVersion: versionSchema
})
export const finishCampaignSessionInputSchema = campaignLivePlayCommandBaseSchema.extend({
  sessionId: uuidSchema
})
export const reopenCampaignSessionInputSchema = campaignLivePlayCommandBaseSchema.extend({
  sessionId: uuidSchema
})
export const getCampaignSessionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionNumber: z.number().int().positive()
})
export const campaignSessionAttendanceDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  characterId: uuidSchema,
  present: z.boolean()
})
export const campaignSessionRsvpDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  userId: uuidSchema,
  response: z.enum(['YES', 'NO', 'MAYBE']),
  updatedAt: timestampSchema
})
export const campaignSessionRsvpDtoListSchema = z.array(campaignSessionRsvpDtoSchema)
export const listCampaignSessionRsvpsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const setCampaignSessionRsvpInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  response: z.enum(['YES', 'NO', 'MAYBE'])
})
const campaignSessionReferencePinTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CAMPAIGN_NOTE'), noteSectionId: uuidSchema }),
  z.strictObject({
    kind: z.literal('AUTHORED_ROUTE'),
    routeSubjectKind: authoredSubjectKindDtoSchema,
    publicId: z.string().trim().min(1).max(120)
  })
])
export const campaignSessionReferencePinDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  target: campaignSessionReferencePinTargetSchema,
  label: shortTextSchema,
  createdAt: timestampSchema
})
export const campaignSessionReferencePinsDtoSchema = z.array(campaignSessionReferencePinDtoSchema)
export const createCampaignSessionReferencePinInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  target: campaignSessionReferencePinTargetSchema
})
export const deleteCampaignSessionReferencePinInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  pinId: uuidSchema
})
export const listCampaignSessionReferencePinsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const campaignSessionAttendanceDtoListSchema = z.array(campaignSessionAttendanceDtoSchema)
export const listCampaignSessionAttendanceInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const setCampaignSessionAttendanceInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  characterId: uuidSchema,
  present: z.boolean(),
  expectedVersion: versionSchema
})
export const campaignClockDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  day: z.number().int().safe().min(1),
  minuteOfDay: z.number().int().min(0).max(1439),
  running: z.boolean(),
  runningSince: timestampSchema.nullable(),
  dawnMinute: z.number().int().min(0).max(1439),
  duskMinute: z.number().int().min(0).max(1439),
  processedBoundaryAbsoluteMinute: z.number().int(),
  version: versionSchema,
  updatedAt: timestampSchema
})
export const initializeCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  day: z.number().int().safe().min(1),
  minuteOfDay: z.number().int().min(0).max(1439),
  dawnMinute: z.number().int().min(0).max(1439),
  duskMinute: z.number().int().min(0).max(1439)
})
export const configureCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  day: z.number().int().safe().min(1).optional(),
  minuteOfDay: z.number().int().min(0).max(1439).optional(),
  dawnMinute: z.number().int().min(0).max(1439).optional(),
  duskMinute: z.number().int().min(0).max(1439).optional()
})
export const startCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const pauseCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const advanceCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  minutes: z.number().int().safe().positive()
})
export const rewindCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  minutes: z.number().int().safe().positive(),
  correctionReason: z.string().trim().min(1).max(500)
})
export const reconcileCampaignClockInputSchema = campaignLivePlayCommandBaseSchema

export const campaignSessionNoteSectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  authorUserId: uuidSchema,
  title: shortTextSchema,
  content: authoredRichTextSchema,
  visibility: z.enum(['SHARED', 'GM_PRIVATE']),
  kind: z.enum([
    'SHARED_NOTE',
    'AGENDA',
    'SCENE',
    'SECRET',
    'REWARD',
    'SCRATCHPAD',
    'RECAP',
    'ENDING_STATE',
    'CANON',
    'RULING',
    'FOLLOW_UP'
  ]),
  sortOrder: z.number().int().nonnegative(),
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
function validateCampaignSessionNoteAccess(
  value: { visibility: 'SHARED' | 'GM_PRIVATE'; kind: string },
  context: z.RefinementCtx
): void {
  if ((value.kind === 'SHARED_NOTE') !== (value.visibility === 'SHARED'))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Shared notes must be shared; all other Session section kinds are GM-private.'
    })
}
export const createCampaignSessionNoteSectionInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    title: shortTextSchema,
    content: authoredRichTextSchema,
    visibility: z.enum(['SHARED', 'GM_PRIVATE']),
    kind: z.enum([
      'SHARED_NOTE',
      'AGENDA',
      'SCENE',
      'SECRET',
      'REWARD',
      'SCRATCHPAD',
      'RECAP',
      'ENDING_STATE',
      'CANON',
      'RULING',
      'FOLLOW_UP'
    ]),
    sortOrder: z.number().int().nonnegative().optional()
  })
  .superRefine(validateCampaignSessionNoteAccess)
export const updateCampaignSessionNoteSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  sectionId: uuidSchema,
  title: shortTextSchema.optional(),
  content: authoredRichTextSchema.optional(),
  visibility: z.enum(['SHARED', 'GM_PRIVATE']).optional(),
  kind: z
    .enum([
      'SHARED_NOTE',
      'AGENDA',
      'SCENE',
      'SECRET',
      'REWARD',
      'SCRATCHPAD',
      'RECAP',
      'ENDING_STATE',
      'CANON',
      'RULING',
      'FOLLOW_UP'
    ])
    .optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  expectedVersion: versionSchema
})
export const deleteCampaignSessionNoteSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  sectionId: uuidSchema
})
export const listCampaignNotebookSectionsInputSchema = z.strictObject({ campaignId: uuidSchema })
export const listCampaignSessionsInputSchema = z.strictObject({ campaignId: uuidSchema })
export const listCampaignSessionNoteSectionsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const campaignNotebookSectionsDtoSchema = z.array(campaignNotebookSectionDtoSchema)
export const campaignSessionsDtoSchema = z.array(campaignSessionDtoSchema)
export const campaignSessionNoteSectionsDtoSchema = z.array(campaignSessionNoteSectionDtoSchema)

export type CampaignNotebookSectionDto = z.infer<typeof campaignNotebookSectionDtoSchema>
export type CampaignSessionDto = z.infer<typeof campaignSessionDtoSchema>
export type CampaignSessionStatusDto = z.infer<typeof campaignSessionStatusDtoSchema>
export type FinishCampaignSessionInput = z.input<typeof finishCampaignSessionInputSchema>
export type ReopenCampaignSessionInput = z.input<typeof reopenCampaignSessionInputSchema>
export type GetCampaignSessionInput = z.input<typeof getCampaignSessionInputSchema>
export type CampaignSessionAttendanceDto = z.infer<typeof campaignSessionAttendanceDtoSchema>
export type CampaignSessionRsvpDto = z.infer<typeof campaignSessionRsvpDtoSchema>
export type SetCampaignSessionRsvpInput = z.input<typeof setCampaignSessionRsvpInputSchema>
export type CampaignSessionReferencePinDto = z.infer<typeof campaignSessionReferencePinDtoSchema>
export type SetCampaignSessionAttendanceInput = z.input<
  typeof setCampaignSessionAttendanceInputSchema
>
export type CampaignClockDto = z.infer<typeof campaignClockDtoSchema>
export type InitializeCampaignClockInput = z.input<typeof initializeCampaignClockInputSchema>
export type ConfigureCampaignClockInput = z.input<typeof configureCampaignClockInputSchema>
export type StartCampaignClockInput = z.input<typeof startCampaignClockInputSchema>
export type PauseCampaignClockInput = z.input<typeof pauseCampaignClockInputSchema>
export type AdvanceCampaignClockInput = z.input<typeof advanceCampaignClockInputSchema>
export type RewindCampaignClockInput = z.input<typeof rewindCampaignClockInputSchema>
export type ReconcileCampaignClockInput = z.input<typeof reconcileCampaignClockInputSchema>
export type CampaignSessionNoteSectionDto = z.infer<typeof campaignSessionNoteSectionDtoSchema>
