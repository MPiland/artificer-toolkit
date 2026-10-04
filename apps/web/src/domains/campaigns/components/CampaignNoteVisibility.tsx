import { Select, Text } from '@mantine/core'
import type { CampaignNotebookSectionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import * as sharedStyles from '../campaigns.css'

type NoteVisibility = CampaignNotebookSectionDto['visibility']

export function CampaignNoteVisibilitySelect({
  value,
  onChange
}: {
  value: NoteVisibility
  onChange: (value: NoteVisibility) => void
}) {
  return (
    <Select
      allowDeselect={false}
      classNames={{ input: sharedStyles.input }}
      data={[
        { label: 'Private', value: 'PRIVATE' },
        { label: 'Shared with party', value: 'SHARED' }
      ]}
      description='Private notes are visible only to you and the GM.'
      label='Visibility'
      value={value}
      onChange={(next) => {
        if (next === 'PRIVATE' || next === 'SHARED') onChange(next)
      }}
    />
  )
}

/** The author is named on shared notes, and to the GM on every note. */
export function CampaignNoteByline({
  visibility,
  authorLabel,
  showAuthor
}: {
  visibility: NoteVisibility
  authorLabel: string
  showAuthor: boolean
}) {
  return (
    <Text c='dimmed' size='xs'>
      {visibility === 'SHARED' ? 'Shared' : 'Private'}
      {showAuthor ? ` · by ${authorLabel}` : ''}
    </Text>
  )
}
