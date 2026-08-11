import { MultiSelect, Select, Textarea } from '@mantine/core'
import type {
  CampaignContentMaturityDto,
  CampaignFormatDto,
  CampaignToneTagDto
} from '@artificer-toolkit/schema/api/campaigns'
import {
  campaignFormatOptions,
  campaignMaturityOptions,
  campaignToneOptions
} from '../campaignMetadata'

export function CampaignMetadataFields({
  contentMaturity,
  disabled = false,
  format,
  onContentMaturityChange,
  onFormatChange,
  onToneDetailsChange,
  onToneTagsChange,
  toneDetails,
  toneTags
}: {
  contentMaturity: CampaignContentMaturityDto
  disabled?: boolean
  format: CampaignFormatDto
  onContentMaturityChange: (value: CampaignContentMaturityDto) => void
  onFormatChange: (value: CampaignFormatDto) => void
  onToneDetailsChange: (value: string) => void
  onToneTagsChange: (value: CampaignToneTagDto[]) => void
  toneDetails: string
  toneTags: CampaignToneTagDto[]
}) {
  return (
    <>
      <Select
        data={campaignFormatOptions.map((option) => ({ ...option }))}
        disabled={disabled}
        label='Format'
        required
        value={format}
        onChange={(value) => {
          const option = campaignFormatOptions.find((candidate) => candidate.value === value)
          if (option) onFormatChange(option.value)
        }}
      />
      <Select
        data={campaignMaturityOptions.map((option) => ({ ...option }))}
        description='Standard masks known inappropriate words in shared and public views.'
        disabled={disabled}
        label='Content maturity'
        required
        value={contentMaturity}
        onChange={(value) => {
          const option = campaignMaturityOptions.find((candidate) => candidate.value === value)
          if (option) onContentMaturityChange(option.value)
        }}
      />
      <MultiSelect
        data={campaignToneOptions.map((option) => ({ ...option }))}
        description='Choose one to three tones.'
        disabled={disabled}
        label='Tone'
        maxValues={3}
        required
        value={toneTags}
        onChange={(values) =>
          onToneTagsChange(
            campaignToneOptions
              .filter((option) => values.includes(option.value))
              .map((option) => option.value)
          )
        }
      />
      <Textarea
        autosize
        disabled={disabled}
        label='Tone details'
        maxLength={1000}
        minRows={2}
        value={toneDetails}
        onChange={(event) => onToneDetailsChange(event.currentTarget.value)}
      />
    </>
  )
}
