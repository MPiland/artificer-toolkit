import { Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { CampaignNotebook } from './CampaignNotebook'
import { CampaignSessionNotes } from './CampaignSessionNotes'
import * as sharedStyles from '../campaigns.css'
import * as notesStyles from './notes.css'

type NotesSection = 'GENERAL' | 'PEOPLE' | 'PLACES' | 'SESSIONS'

export function CampaignNotes({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const [section, setSection] = useState<NotesSection>('GENERAL')

  return (
    <div className={notesStyles.notesWorkspace}>
      <nav className={notesStyles.notesRail} aria-label='Campaign notes sections'>
        <Text c='dimmed' fw={700} size='xs' tt='uppercase'>
          Notes
        </Text>
        {(['GENERAL', 'PEOPLE', 'PLACES', 'SESSIONS'] as const).map((value) => (
          <button
            className={notesStyles.notesRailItem}
            data-active={section === value || undefined}
            key={value}
            type='button'
            onClick={() => setSection(value)}
          >
            {value.charAt(0) + value.slice(1).toLowerCase()}
          </button>
        ))}
      </nav>
      <div className={notesStyles.notesContent}>
        <div className={notesStyles.notesMobileSelect}>
          <Select
            aria-label='Notes section'
            classNames={{ input: sharedStyles.input }}
            data={[
              { value: 'GENERAL', label: 'General' },
              { value: 'PEOPLE', label: 'People' },
              { value: 'PLACES', label: 'Places' },
              { value: 'SESSIONS', label: 'Sessions' }
            ]}
            value={section}
            onChange={(value) => {
              if (
                value === 'GENERAL' ||
                value === 'PEOPLE' ||
                value === 'PLACES' ||
                value === 'SESSIONS'
              )
                setSection(value)
            }}
          />
        </div>
        <Stack gap='lg'>
          {section === 'GENERAL' || section === 'PEOPLE' || section === 'PLACES' ? (
            <CampaignNotebook
              campaign={campaign}
              currentUserId={currentUserId}
              embedded
              sectionTitle={`${section.charAt(0)}${section.slice(1).toLowerCase()} notes`}
              categoryFilter={section}
            />
          ) : null}
          {section === 'SESSIONS' ? (
            <CampaignSessionNotes campaign={campaign} currentUserId={currentUserId} embedded />
          ) : null}
        </Stack>
      </div>
    </div>
  )
}
