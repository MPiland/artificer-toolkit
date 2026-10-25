import type {
  SocialListingDto,
  SocialListingScheduleDto
} from '@artificer-toolkit/schema/api/socialHub'
import { buildAuthoredRouteHandle } from '#app/routing/authoredRouteHandles'

export const socialViews = ['discover', 'applications', 'invitations', 'hosting'] as const
export type SocialView = (typeof socialViews)[number]

export const socialListingManagementSections = ['listing', 'applications', 'invitations'] as const
export type SocialListingManagementSection = (typeof socialListingManagementSections)[number]

export const socialListingManagementSectionLabels: Record<SocialListingManagementSection, string> =
  {
    listing: 'Listing details',
    applications: 'Applications',
    invitations: 'Invitations'
  }

export const socialViewLabels: Record<SocialView, string> = {
  discover: 'Discover',
  applications: 'My applications',
  invitations: 'Invitations',
  hosting: 'Hosting'
}

export const playModeOptions = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'HYBRID', label: 'Hybrid' }
] as const

export const campaignFormatOptions = [
  { value: 'ONE_SHOT', label: 'One-shot' },
  { value: 'ONGOING', label: 'Ongoing' }
] as const

export const contentMaturityOptions = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'MATURE', label: 'Mature' }
] as const

export const toneTagOptions = [
  { value: 'LIGHTHEARTED', label: 'Lighthearted' },
  { value: 'HEROIC', label: 'Heroic' },
  { value: 'SERIOUS', label: 'Serious' },
  { value: 'DARK', label: 'Dark' },
  { value: 'GRITTY', label: 'Gritty' },
  { value: 'HORROR', label: 'Horror' },
  { value: 'COMEDIC', label: 'Comedic' },
  { value: 'COZY', label: 'Cozy' }
] as const

export const scheduleKindOptions = [
  { value: 'FLEXIBLE', label: 'Flexible' },
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'RECURRING', label: 'Recurring' }
] as const

export const safetyPracticeOptions = [
  { value: 'SESSION_ZERO', label: 'Session zero' },
  { value: 'LINES_AND_VEILS', label: 'Lines and veils' },
  { value: 'X_CARD', label: 'X-card' },
  { value: 'OPEN_DOOR', label: 'Open door' },
  { value: 'SCRIPT_CHANGE', label: 'Script change' },
  { value: 'OTHER', label: 'Other' }
] as const

export const reportReasonOptions = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE_OR_ABUSE', label: 'Hate or abuse' },
  { value: 'SEXUAL_CONTENT', label: 'Sexual content' },
  { value: 'SPAM_OR_SCAM', label: 'Spam or scam' },
  { value: 'SAFETY_MISREPRESENTATION', label: 'Safety misrepresentation' },
  { value: 'PRIVACY', label: 'Privacy' },
  { value: 'OTHER', label: 'Other' }
] as const

export const socialModerationActions = [
  { value: 'START_REVIEW', label: 'Start review' },
  { value: 'DISMISS', label: 'Dismiss report' },
  { value: 'RESOLVE', label: 'Resolve report' },
  { value: 'HIDE_LISTING', label: 'Hide listing' },
  { value: 'RESTORE_LISTING', label: 'Restore listing' },
  { value: 'SUSPEND_PROFILE', label: 'Suspend profile' },
  { value: 'RESTORE_PROFILE', label: 'Restore profile' }
] as const

export const socialListingPolicyFields = [
  ['Content guidance', 'contentGuidance'],
  ['Attendance policy', 'attendancePolicy'],
  ['Allowed content and rules', 'allowedContentRules'],
  ['Table conduct', 'tableConduct'],
  ['Content boundaries', 'contentBoundaries'],
  ['How safety practices are used', 'safetyDetails']
] as const

/** Built per call: the labels follow the reader's locale, which is unknown at module load. */
export function weekdayOptions() {
  return Array.from({ length: 7 }, (_, weekday) => ({
    value: String(weekday),
    label: new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, 7 + weekday))
    )
  }))
}

export function buildSocialListingRouteParams(
  listing: Pick<SocialListingDto, 'listingPublicId' | 'title'>
) {
  const handle = buildAuthoredRouteHandle(listing.listingPublicId, listing.title)
  return { listingPublicId: handle.publicId, slug: handle.slug }
}

export function formatSocialSchedule(schedule: SocialListingScheduleDto) {
  if (schedule.kind === 'FLEXIBLE') return schedule.summary
  if (schedule.kind === 'ONE_TIME') {
    return `${new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: schedule.timeZone
    }).format(new Date(schedule.startsAt))} — ${schedule.summary}`
  }

  const weekday = weekdayOptions()[schedule.weekday]?.label ?? 'Recurring'
  return `${weekday} at ${schedule.localStartTime} (${schedule.recurrence === 'WEEKLY' ? 'weekly' : 'every other week'}) — ${schedule.summary}`
}

export function formatListingLocation(listing: SocialListingDto) {
  if (listing.playMode === 'ONLINE') return 'Online'
  if (!listing.location) return listing.playMode === 'HYBRID' ? 'Hybrid' : 'In person'
  return `${listing.location.city}, ${listing.location.stateCode}`
}

export function formatSocialDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export function formatSocialTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
