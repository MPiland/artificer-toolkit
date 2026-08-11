import { Select, Textarea, TextInput, Title } from '@mantine/core'
import type { Dispatch, SetStateAction } from 'react'
import { updateSocialListingDraft, type SocialListingDraft } from '../../socialFormModel'
import { scheduleKindOptions, weekdayOptions } from '../../socialModels'
import * as styles from './SocialListingSections.css'

export function SocialListingScheduleSection({
  campaignFormat,
  draft,
  setDraft
}: {
  campaignFormat: 'ONE_SHOT' | 'ONGOING'
  draft: SocialListingDraft
  setDraft: Dispatch<SetStateAction<SocialListingDraft>>
}) {
  return (
    <section className={styles.panel} aria-labelledby='listing-schedule-title'>
      <Title id='listing-schedule-title' order={2}>
        Schedule
      </Title>
      <div className={styles.formGrid}>
        <Select
          data={scheduleKindOptions
            .filter((option) => campaignFormat === 'ONGOING' || option.value !== 'RECURRING')
            .map((option) => ({ ...option }))}
          description={
            campaignFormat === 'ONE_SHOT'
              ? 'One-shot Campaigns can be flexible or scheduled once.'
              : undefined
          }
          label='Schedule type'
          value={draft.scheduleKind}
          onChange={(value) => {
            const next = scheduleKindOptions.find((option) => option.value === value)
            if (next) updateSocialListingDraft(setDraft, 'scheduleKind', next.value)
          }}
        />
        <TextInput
          label='IANA timezone'
          maxLength={100}
          placeholder='America/Chicago'
          required
          value={draft.timeZone}
          onChange={(event) =>
            updateSocialListingDraft(setDraft, 'timeZone', event.currentTarget.value)
          }
        />
        {draft.scheduleKind === 'ONE_TIME' ? (
          <TextInput
            label='Start date and time'
            required
            type='datetime-local'
            value={draft.startsAtLocal}
            onChange={(event) =>
              updateSocialListingDraft(setDraft, 'startsAtLocal', event.currentTarget.value)
            }
          />
        ) : null}
        {draft.scheduleKind === 'RECURRING' ? (
          <>
            <Select
              data={weekdayOptions}
              label='Weekday'
              value={String(draft.weekday)}
              onChange={(value) =>
                updateSocialListingDraft(setDraft, 'weekday', Number(value ?? 0))
              }
            />
            <TextInput
              label='Local start time'
              required
              type='time'
              value={draft.localStartTime}
              onChange={(event) =>
                updateSocialListingDraft(setDraft, 'localStartTime', event.currentTarget.value)
              }
            />
            <Select
              data={[
                { label: 'Weekly', value: 'WEEKLY' },
                { label: 'Every other week', value: 'BIWEEKLY' }
              ]}
              label='Frequency'
              value={draft.recurrence}
              onChange={(value) => {
                if (value === 'WEEKLY' || value === 'BIWEEKLY') {
                  updateSocialListingDraft(setDraft, 'recurrence', value)
                }
              }}
            />
          </>
        ) : null}
        <Textarea
          autosize
          className={styles.spanAll}
          label='Schedule summary'
          maxLength={2000}
          minRows={2}
          required
          value={draft.scheduleSummary}
          onChange={(event) =>
            updateSocialListingDraft(setDraft, 'scheduleSummary', event.currentTarget.value)
          }
        />
      </div>
    </section>
  )
}
