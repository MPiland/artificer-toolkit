import type {
  CreateSocialListingInput,
  SocialListingDto,
  SocialListingExpectationsDto,
  SocialListingScheduleDto
} from '@artificer-toolkit/schema/api/socialHub'
import type { Dispatch, SetStateAction } from 'react'

type ListingFields = Omit<CreateSocialListingInput, 'campaignId'>

export interface SocialListingDraft {
  summary: string
  audience: 'PRIVATE' | 'PUBLIC'
  systemId: string
  playMode: 'ONLINE' | 'IN_PERSON' | 'HYBRID'
  capacity: number
  scheduleKind: 'FLEXIBLE' | 'ONE_TIME' | 'RECURRING'
  timeZone: string
  scheduleSummary: string
  startsAtLocal: string
  weekday: number
  localStartTime: string
  recurrence: 'WEEKLY' | 'BIWEEKLY'
  city: string
  stateCode: string
  contentGuidance: string
  attendancePolicy: string
  allowedContentRules: string
  tableConduct: string
  contentBoundaries: string
  safetyPractices: SocialListingExpectationsDto['safetyPractices']
  safetyDetails: string
}

export function createEmptySocialListingDraft(): SocialListingDraft {
  return {
    summary: '',
    audience: 'PRIVATE',
    systemId: '',
    playMode: 'ONLINE',
    capacity: 5,
    scheduleKind: 'FLEXIBLE',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    scheduleSummary: '',
    startsAtLocal: '',
    weekday: 0,
    localStartTime: '19:00',
    recurrence: 'WEEKLY',
    city: '',
    stateCode: '',
    contentGuidance: '',
    attendancePolicy: '',
    allowedContentRules: '',
    tableConduct: '',
    contentBoundaries: '',
    safetyPractices: ['SESSION_ZERO'],
    safetyDetails: ''
  }
}

export function socialListingToDraft(listing: SocialListingDto): SocialListingDraft {
  return {
    summary: listing.summary,
    audience: listing.audience,
    systemId: listing.system.systemId,
    playMode: listing.playMode,
    capacity: listing.capacity,
    scheduleKind: listing.schedule.kind,
    timeZone: listing.schedule.timeZone,
    scheduleSummary: listing.schedule.summary,
    startsAtLocal:
      listing.schedule.kind === 'ONE_TIME'
        ? instantToLocalDateTime(listing.schedule.startsAt, listing.schedule.timeZone)
        : '',
    weekday: listing.schedule.kind === 'RECURRING' ? listing.schedule.weekday : 0,
    localStartTime:
      listing.schedule.kind === 'RECURRING' ? listing.schedule.localStartTime : '19:00',
    recurrence: listing.schedule.kind === 'RECURRING' ? listing.schedule.recurrence : 'WEEKLY',
    city: listing.location?.city ?? '',
    stateCode: listing.location?.stateCode ?? '',
    contentGuidance: listing.expectations.contentGuidance,
    attendancePolicy: listing.expectations.attendancePolicy,
    allowedContentRules: listing.expectations.allowedContentRules,
    tableConduct: listing.expectations.tableConduct,
    contentBoundaries: listing.expectations.contentBoundaries,
    safetyPractices: listing.expectations.safetyPractices,
    safetyDetails: listing.expectations.safetyDetails
  }
}

export function socialListingDraftToFields(draft: SocialListingDraft): ListingFields {
  const expectations: SocialListingExpectationsDto = {
    contentGuidance: draft.contentGuidance,
    attendancePolicy: draft.attendancePolicy,
    allowedContentRules: draft.allowedContentRules,
    tableConduct: draft.tableConduct,
    contentBoundaries: draft.contentBoundaries,
    safetyPractices: draft.safetyPractices,
    safetyDetails: draft.safetyDetails
  }

  return {
    summary: draft.summary,
    audience: draft.audience,
    systemId: draft.systemId,
    playMode: draft.playMode,
    capacity: draft.capacity,
    schedule: buildSchedule(draft),
    location:
      draft.playMode === 'ONLINE'
        ? null
        : { city: draft.city, stateCode: draft.stateCode.toUpperCase() },
    expectations
  }
}

export function updateSocialListingDraft<TKey extends keyof SocialListingDraft>(
  setDraft: Dispatch<SetStateAction<SocialListingDraft>>,
  key: TKey,
  value: SocialListingDraft[TKey]
) {
  setDraft((current) => ({ ...current, [key]: value }))
}

function buildSchedule(draft: SocialListingDraft): SocialListingScheduleDto {
  if (draft.scheduleKind === 'ONE_TIME') {
    return {
      kind: 'ONE_TIME',
      timeZone: draft.timeZone,
      summary: draft.scheduleSummary,
      startsAt: localDateTimeToInstant(draft.startsAtLocal, draft.timeZone)
    }
  }
  if (draft.scheduleKind === 'RECURRING') {
    return {
      kind: 'RECURRING',
      timeZone: draft.timeZone,
      summary: draft.scheduleSummary,
      weekday: draft.weekday,
      localStartTime: draft.localStartTime,
      recurrence: draft.recurrence
    }
  }
  return { kind: 'FLEXIBLE', timeZone: draft.timeZone, summary: draft.scheduleSummary }
}

function localDateTimeToInstant(localValue: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue)
  if (!match) throw new Error('Choose a valid date and time.')
  const target = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  )
  let instant = target
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateParts(new Date(instant), timeZone)
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    instant += target - represented
  }
  return new Date(instant).toISOString()
}

function instantToLocalDateTime(instant: string, timeZone: string) {
  const parts = dateParts(new Date(instant), timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute')
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
