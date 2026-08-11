import { createEmptySocialListingDraft, socialListingDraftToFields } from './socialFormModel'
import { socialHubSearchSchema } from './socialSearch'

describe('Social listing form model', () => {
  it('keeps exact location out of online listing inputs', () => {
    const draft = createEmptySocialListingDraft()
    draft.summary = 'A welcoming weekly game.'
    draft.systemId = 'f6c023cf-bc33-43e7-92ea-af6af2b84229'
    draft.scheduleSummary = 'Thursday evenings'
    draft.contentGuidance = 'Fantasy action'
    draft.attendancePolicy = 'Give notice when absent'
    draft.allowedContentRules = 'Core rules only'
    draft.tableConduct = 'Share the spotlight'
    draft.contentBoundaries = 'Discussed in session zero'
    draft.safetyDetails = 'Pause whenever needed'
    draft.city = 'Chicago'
    draft.stateCode = 'IL'

    expect(socialListingDraftToFields(draft).location).toBeNull()
  })

  it('turns a recurring local schedule into the shared contract shape', () => {
    const draft = createEmptySocialListingDraft()
    draft.scheduleKind = 'RECURRING'
    draft.scheduleSummary = 'Thursday evenings'
    draft.weekday = 4
    draft.localStartTime = '19:30'
    draft.recurrence = 'BIWEEKLY'
    draft.timeZone = 'America/Chicago'

    expect(socialListingDraftToFields(draft).schedule).toEqual({
      kind: 'RECURRING',
      summary: 'Thursday evenings',
      weekday: 4,
      localStartTime: '19:30',
      recurrence: 'BIWEEKLY',
      timeZone: 'America/Chicago'
    })
  })

  it('drops unrecognized search values instead of retaining sensitive data', () => {
    const parsed = socialHubSearchSchema.parse({ view: 'discover', serverSecret: 'secret-value' })
    expect(parsed).toEqual({ view: 'discover' })
  })
})
