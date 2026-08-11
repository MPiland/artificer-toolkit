import type {
  CampaignContentMaturityDto,
  CampaignFormatDto,
  CampaignToneTagDto
} from '@artificer-toolkit/schema/api/campaigns'

export const campaignFormatOptions: ReadonlyArray<{
  value: CampaignFormatDto
  label: string
}> = [
  { value: 'ONE_SHOT', label: 'One-shot' },
  { value: 'ONGOING', label: 'Ongoing' }
]

export const campaignMaturityOptions: ReadonlyArray<{
  value: CampaignContentMaturityDto
  label: string
}> = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'MATURE', label: 'Mature' }
]

export const campaignToneOptions: ReadonlyArray<{
  value: CampaignToneTagDto
  label: string
}> = [
  { value: 'LIGHTHEARTED', label: 'Lighthearted' },
  { value: 'HEROIC', label: 'Heroic' },
  { value: 'SERIOUS', label: 'Serious' },
  { value: 'DARK', label: 'Dark' },
  { value: 'GRITTY', label: 'Gritty' },
  { value: 'HORROR', label: 'Horror' },
  { value: 'COMEDIC', label: 'Comedic' },
  { value: 'COZY', label: 'Cozy' }
]
