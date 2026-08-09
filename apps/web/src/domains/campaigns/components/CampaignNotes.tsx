import { Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { CampaignNotebook } from './CampaignNotebook'
import { CampaignSessionNotes } from './CampaignSessionNotes'
import * as styles from '../campaigns.css'

type NotesSection = 'GENERAL' | 'PEOPLE' | 'PLACES' | 'SESSIONS' | 'GM_PRIVATE'

export function CampaignNotes({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const [section, setSection] = useState<NotesSection>('GENERAL')
  const canSeePrivate = campaign.role === 'OWNER'

  return (
    <div className={styles.notesWorkspace}>
      <nav className={styles.notesRail} aria-label='Campaign notes sections'>
        <Text c='dimmed' fw={700} size='xs' tt='uppercase'>
          Notes
        </Text>
        {(
          [
            'GENERAL',
            'PEOPLE',
            'PLACES',
            'SESSIONS',
            ...(canSeePrivate ? ['GM_PRIVATE'] : [])
          ] as NotesSection[]
        ).map((value) => (
          <button
            className={styles.notesRailItem}
            data-active={section === value || undefined}
            key={value}
            type='button'
            onClick={() => setSection(value)}
          >
            {value === 'GM_PRIVATE' ? 'GM private' : value.charAt(0) + value.slice(1).toLowerCase()}
          </button>
        ))}
      </nav>
      <div className={styles.notesContent}>
        <div className={styles.notesMobileSelect}>
          <Select
            aria-label='Notes section'
            classNames={{ input: styles.input }}
            data={[
              { value: 'GENERAL', label: 'General' },
              { value: 'PEOPLE', label: 'People' },
              { value: 'PLACES', label: 'Places' },
              { value: 'SESSIONS', label: 'Sessions' },
              ...(canSeePrivate ? [{ value: 'GM_PRIVATE', label: 'GM private' }] : [])
            ]}
            value={section}
            onChange={(value) => {
              if (
                value === 'GENERAL' ||
                value === 'PEOPLE' ||
                value === 'PLACES' ||
                value === 'SESSIONS' ||
                value === 'GM_PRIVATE'
              )
                setSection(value)
            }}
          />
        </div>
        <Stack gap='lg'>
          {section === 'GENERAL' || section === 'PEOPLE' || section === 'PLACES' ? (
            <CampaignNotebook
              campaign={campaign}
              embedded
              sectionTitle={`${section.charAt(0)}${section.slice(1).toLowerCase()} notes`}
              visibilityFilter='SHARED'
              categoryFilter={section}
            />
          ) : null}
          {section === 'GM_PRIVATE' ? (
            <CampaignNotebook
              campaign={campaign}
              embedded
              sectionTitle='GM private notes'
              visibilityFilter='GM_PRIVATE'
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
