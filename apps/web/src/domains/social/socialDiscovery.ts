import type { SocialBrowseInput } from '@artificer-toolkit/schema/api/socialDiscovery'
import {
  campaignFormatOptions,
  contentMaturityOptions,
  playModeOptions,
  safetyPracticeOptions,
  scheduleKindOptions
} from './socialModels'
import type { SocialHubSearch } from './socialSearch'

export function toSocialDiscoveryInput(
  search: SocialHubSearch
): Omit<SocialBrowseInput, 'paginationOpts'> {
  return {
    systemId: search.systemId,
    format: search.format,
    contentMaturity: search.contentMaturity,
    toneTags: search.toneTags,
    playMode: search.playMode,
    timeZone: search.timeZone || undefined,
    scheduleKind: search.scheduleKind,
    weekday: search.weekday,
    stateCode: search.stateCode || undefined,
    city: search.city || undefined,
    minimumAvailableSeats: search.minimumAvailableSeats,
    safetyPractices: search.safetyPractice ? [search.safetyPractice] : undefined
  }
}

export function toSocialDiscoveryPlayMode(value: string | null): SocialHubSearch['playMode'] {
  return playModeOptions.find((option) => option.value === value)?.value
}

export function toSocialDiscoveryCampaignFormat(value: string | null): SocialHubSearch['format'] {
  return campaignFormatOptions.find((option) => option.value === value)?.value
}

export function toSocialDiscoveryContentMaturity(
  value: string | null
): SocialHubSearch['contentMaturity'] {
  return contentMaturityOptions.find((option) => option.value === value)?.value
}

export function toSocialDiscoveryScheduleKind(
  value: string | null
): SocialHubSearch['scheduleKind'] {
  return scheduleKindOptions.find((option) => option.value === value)?.value
}

export function toSocialDiscoverySafetyPractice(
  value: string | null
): SocialHubSearch['safetyPractice'] {
  return safetyPracticeOptions.find((option) => option.value === value)?.value
}
