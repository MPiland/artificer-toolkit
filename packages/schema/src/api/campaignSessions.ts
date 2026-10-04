import { z, lazySchema } from '../zod.js'

import { authoredRichTextSchema } from '../shared/authoredLimits.js'
import { authoredSubjectKindSchema } from '../projections/identity.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import {
  campaignAuthorLabelSchema,
  shortTextSchema,
  timeZoneSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const recoverCampaignClockBoundaryInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    actorUserId: z.string().check(z.minLength(1)),
    absolute: z.number().check(z.int()).check(z.nonnegative()),
    kind: z.enum(['DAWN', 'DUSK', 'DAILY']),
    occurredAt: timestampSchema
  })
)

export const campaignNoteVisibilitySchema = lazySchema(() => z.enum(['PRIVATE', 'SHARED']))
export const campaignNotebookCategoryDtoSchema = lazySchema(() =>
  z.enum(['GENERAL', 'PEOPLE', 'PLACES'])
)
export const campaignNotebookSectionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    authorUserId: uuidSchema,
    authorLabel: campaignAuthorLabelSchema,
    title: shortTextSchema,
    content: authoredRichTextSchema,
    visibility: campaignNoteVisibilitySchema,
    category: campaignNotebookCategoryDtoSchema,
    version: versionSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)
export const createCampaignNotebookSectionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    title: shortTextSchema,
    content: authoredRichTextSchema,
    visibility: z._default(campaignNoteVisibilitySchema, 'PRIVATE'),
    category: z._default(campaignNotebookCategoryDtoSchema, 'GENERAL')
  })
)
export const updateCampaignNotebookSectionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sectionId: uuidSchema,
    title: z.optional(shortTextSchema),
    content: z.optional(authoredRichTextSchema),
    visibility: z.optional(campaignNoteVisibilitySchema),
    category: z.optional(campaignNotebookCategoryDtoSchema),
    expectedVersion: versionSchema
  })
)
export const deleteCampaignNotebookSectionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sectionId: uuidSchema
  })
)

export const campaignSessionStatusDtoSchema = lazySchema(() => z.enum(['OPEN', 'FINISHED']))
function validateCampaignSessionSchedule(
  value: {
    scheduledStartAt: string | null
    scheduledEndAt: string | null
    timeZone: string | null
  },
  context: z.core.$RefinementCtx
): void {
  const { scheduledStartAt, scheduledEndAt, timeZone } = value
  if (scheduledStartAt === null && scheduledEndAt === null && timeZone === null) return
  if (scheduledStartAt === null || scheduledEndAt === null || timeZone === null) {
    context.addIssue({
      code: 'custom',
      message: 'Session scheduling requires a start, end, and time zone.'
    })
    return
  }
  if (Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt))
    context.addIssue({
      code: 'custom',
      message: 'Session end must be after its start.',
      path: ['scheduledEndAt']
    })
}
export const campaignSessionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    sessionNumber: z.number().check(z.int()).check(z.positive()),
    title: z.nullable(shortTextSchema),
    scheduledStartAt: z.nullable(timestampSchema),
    scheduledEndAt: z.nullable(timestampSchema),
    timeZone: z.nullable(timeZoneSchema),
    status: campaignSessionStatusDtoSchema,
    finishedAt: z.nullable(timestampSchema),
    version: versionSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)
export const createCampaignSessionInputSchema = lazySchema(() =>
  z
    .strictObject({
      campaignId: uuidSchema,
      title: z.optional(z.nullable(shortTextSchema)),
      scheduledStartAt: z._default(z.nullable(timestampSchema), null),
      scheduledEndAt: z._default(z.nullable(timestampSchema), null),
      timeZone: z._default(z.nullable(timeZoneSchema), null)
    })
    .check(z.superRefine(validateCampaignSessionSchedule))
)
export const updateCampaignSessionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    title: z.optional(z.nullable(shortTextSchema)),
    scheduledStartAt: z.optional(z.nullable(timestampSchema)),
    scheduledEndAt: z.optional(z.nullable(timestampSchema)),
    timeZone: z.optional(z.nullable(timeZoneSchema)),
    expectedVersion: versionSchema
  })
)
const campaignLivePlayCommandBaseSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    commandId: uuidSchema,
    expectedVersion: versionSchema
  })
)
export const finishCampaignSessionInputSchema = lazySchema(() =>
  z.extend(campaignLivePlayCommandBaseSchema, {
    sessionId: uuidSchema
  })
)
export const getCampaignSessionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionNumber: z.number().check(z.int()).check(z.positive())
  })
)
export const campaignSessionAttendanceDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    characterId: uuidSchema,
    present: z.boolean()
  })
)
export const campaignSessionRsvpDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    userId: uuidSchema,
    response: z.enum(['YES', 'NO', 'MAYBE']),
    updatedAt: timestampSchema
  })
)
export const campaignSessionRsvpDtoListSchema = lazySchema(() =>
  z.array(campaignSessionRsvpDtoSchema)
)
export const listCampaignSessionRsvpsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema
  })
)
export const setCampaignSessionRsvpInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    response: z.enum(['YES', 'NO', 'MAYBE'])
  })
)
const campaignSessionReferencePinTargetSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CAMPAIGN_NOTE'),
      noteSectionId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('AUTHORED_ROUTE'),
      routeSubjectKind: authoredSubjectKindSchema,
      publicId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(120))
    })
  ])
)
export const campaignSessionReferencePinDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    target: campaignSessionReferencePinTargetSchema,
    label: shortTextSchema,
    createdAt: timestampSchema
  })
)
export const campaignSessionReferencePinsDtoSchema = lazySchema(() =>
  z.array(campaignSessionReferencePinDtoSchema)
)
export const createCampaignSessionReferencePinInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    target: campaignSessionReferencePinTargetSchema
  })
)
export const deleteCampaignSessionReferencePinInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    pinId: uuidSchema
  })
)
export const listCampaignSessionReferencePinsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema
  })
)
export const campaignSessionAttendanceDtoListSchema = lazySchema(() =>
  z.array(campaignSessionAttendanceDtoSchema)
)
export const listCampaignSessionAttendanceInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema
  })
)
export const setCampaignSessionAttendanceInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    characterId: uuidSchema,
    present: z.boolean(),
    expectedVersion: versionSchema
  })
)
export const campaignClockDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    day: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.gte(1)),
    minuteOfDay: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    running: z.boolean(),
    runningSince: z.nullable(timestampSchema),
    dawnMinute: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    duskMinute: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    processedBoundaryAbsoluteMinute: z.number().check(z.int()),
    /** True while combat paused a running clock; only that pause is lifted when combat ends. */
    pausedForCombat: z.boolean(),
    version: versionSchema,
    updatedAt: timestampSchema
  })
)
/** A Character in the fight at a clock boundary, left for the GM to refresh by hand. */
export const campaignClockRecoveryPromptDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    characterId: uuidSchema,
    characterName: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
    boundaryAbsoluteMinute: z.number().check(z.int()).check(z.nonnegative()),
    boundaryKind: z.enum(['DAWN', 'DUSK', 'DAILY']),
    createdAt: timestampSchema
  })
)
export const dismissCampaignClockRecoveryPromptInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    promptId: uuidSchema
  })
)
export const initializeCampaignClockInputSchema = lazySchema(() =>
  z.extend(campaignLivePlayCommandBaseSchema, {
    day: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.gte(1)),
    minuteOfDay: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    dawnMinute: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    duskMinute: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439))
  })
)
export const configureCampaignClockInputSchema = lazySchema(() =>
  z.extend(campaignLivePlayCommandBaseSchema, {
    dawnMinute: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    duskMinute: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439))
  })
)
export const startCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const pauseCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const advanceCampaignClockInputSchema = lazySchema(() =>
  z.extend(campaignLivePlayCommandBaseSchema, {
    minutes: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive())
  })
)
export const rewindCampaignClockInputSchema = lazySchema(() =>
  z.extend(campaignLivePlayCommandBaseSchema, {
    minutes: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive()),
    correctionReason: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
  })
)
export const resetCampaignClockInputSchema = lazySchema(() =>
  z.extend(campaignLivePlayCommandBaseSchema, {
    day: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.gte(1)),
    minuteOfDay: z.number().check(z.int()).check(z.gte(0)).check(z.lte(1439)),
    correctionReason: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
  })
)
export const reconcileCampaignClockInputSchema = campaignLivePlayCommandBaseSchema

export const campaignSessionNoteKindSchema = lazySchema(() =>
  z.enum([
    'NOTE',
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
)
export const campaignSessionNoteSectionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    authorUserId: uuidSchema,
    authorLabel: campaignAuthorLabelSchema,
    title: shortTextSchema,
    content: authoredRichTextSchema,
    visibility: campaignNoteVisibilitySchema,
    kind: campaignSessionNoteKindSchema,
    sortOrder: z.number().check(z.int()).check(z.nonnegative()),
    version: versionSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)
function validateCampaignSessionNoteAccess(
  value: { visibility: 'PRIVATE' | 'SHARED'; kind: string },
  context: z.core.$RefinementCtx
): void {
  if (value.kind !== 'NOTE' && value.visibility === 'SHARED')
    context.addIssue({
      code: 'custom',
      message: 'Only notes can be shared; all other Session section kinds stay private.'
    })
}
export const createCampaignSessionNoteSectionInputSchema = lazySchema(() =>
  z
    .strictObject({
      campaignId: uuidSchema,
      sessionId: uuidSchema,
      title: shortTextSchema,
      content: authoredRichTextSchema,
      visibility: z._default(campaignNoteVisibilitySchema, 'PRIVATE'),
      kind: campaignSessionNoteKindSchema,
      sortOrder: z.optional(z.number().check(z.int()).check(z.nonnegative()))
    })
    .check(z.superRefine(validateCampaignSessionNoteAccess))
)
export const updateCampaignSessionNoteSectionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    sectionId: uuidSchema,
    title: z.optional(shortTextSchema),
    content: z.optional(authoredRichTextSchema),
    visibility: z.optional(campaignNoteVisibilitySchema),
    kind: z.optional(campaignSessionNoteKindSchema),
    sortOrder: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    expectedVersion: versionSchema
  })
)
export const deleteCampaignSessionNoteSectionInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    sectionId: uuidSchema
  })
)
export const listCampaignNotebookSectionsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema
  })
)
export const listCampaignSessionsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema
  })
)
export const listCampaignSessionNoteSectionsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema
  })
)
export const campaignNotebookSectionsDtoSchema = lazySchema(() =>
  z.array(campaignNotebookSectionDtoSchema)
)
export const campaignNotebookListInputSchema = lazySchema(() =>
  z.extend(listCampaignNotebookSectionsInputSchema, campaignListInputSchema.shape)
)
export const campaignNotebookListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: campaignNotebookSectionsDtoSchema
  })
)
export type CampaignNotebookListInput = z.infer<typeof campaignNotebookListInputSchema>
export type CampaignNotebookListPage = z.infer<typeof campaignNotebookListPageSchema>
export const campaignSessionsDtoSchema = lazySchema(() => z.array(campaignSessionDtoSchema))
export const campaignSessionNoteSectionsDtoSchema = lazySchema(() =>
  z.array(campaignSessionNoteSectionDtoSchema)
)

export type UpdateCampaignNotebookSectionInput = z.input<
  typeof updateCampaignNotebookSectionInputSchema
>
export type CampaignNotebookSectionDto = z.infer<typeof campaignNotebookSectionDtoSchema>
export type CampaignSessionDto = z.infer<typeof campaignSessionDtoSchema>
export type CampaignSessionStatusDto = z.infer<typeof campaignSessionStatusDtoSchema>
export type FinishCampaignSessionInput = z.input<typeof finishCampaignSessionInputSchema>
export type GetCampaignSessionInput = z.input<typeof getCampaignSessionInputSchema>
export type CampaignSessionAttendanceDto = z.infer<typeof campaignSessionAttendanceDtoSchema>
export type CampaignSessionRsvpDto = z.infer<typeof campaignSessionRsvpDtoSchema>
export type SetCampaignSessionRsvpInput = z.input<typeof setCampaignSessionRsvpInputSchema>
export type CampaignSessionReferencePinDto = z.infer<typeof campaignSessionReferencePinDtoSchema>
export type SetCampaignSessionAttendanceInput = z.input<
  typeof setCampaignSessionAttendanceInputSchema
>
export type CampaignClockDto = z.infer<typeof campaignClockDtoSchema>
export type CampaignClockRecoveryPromptDto = z.infer<typeof campaignClockRecoveryPromptDtoSchema>
export type DismissCampaignClockRecoveryPromptInput = z.input<
  typeof dismissCampaignClockRecoveryPromptInputSchema
>
export type InitializeCampaignClockInput = z.input<typeof initializeCampaignClockInputSchema>
export type ConfigureCampaignClockInput = z.input<typeof configureCampaignClockInputSchema>
export type StartCampaignClockInput = z.input<typeof startCampaignClockInputSchema>
export type PauseCampaignClockInput = z.input<typeof pauseCampaignClockInputSchema>
export type AdvanceCampaignClockInput = z.input<typeof advanceCampaignClockInputSchema>
export type RewindCampaignClockInput = z.input<typeof rewindCampaignClockInputSchema>
export type ResetCampaignClockInput = z.input<typeof resetCampaignClockInputSchema>
export type ReconcileCampaignClockInput = z.input<typeof reconcileCampaignClockInputSchema>
export type CampaignSessionNoteSectionDto = z.infer<typeof campaignSessionNoteSectionDtoSchema>
