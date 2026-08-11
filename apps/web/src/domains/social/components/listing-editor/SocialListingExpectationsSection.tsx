import { Checkbox, Stack, Textarea, Title } from '@mantine/core'
import type { Dispatch, SetStateAction } from 'react'
import { updateSocialListingDraft, type SocialListingDraft } from '../../socialFormModel'
import { safetyPracticeOptions, socialListingPolicyFields } from '../../socialModels'
import * as styles from './SocialListingSections.css'

export function SocialListingExpectationsSection({
  draft,
  setDraft
}: {
  draft: SocialListingDraft
  setDraft: Dispatch<SetStateAction<SocialListingDraft>>
}) {
  return (
    <section className={styles.panel} aria-labelledby='listing-expectations-title'>
      <Title id='listing-expectations-title' order={2}>
        Expectations and safety
      </Title>
      <div className={styles.formGrid}>
        <Checkbox.Group
          label='Safety practices'
          required
          value={draft.safetyPractices}
          onChange={(values) =>
            updateSocialListingDraft(
              setDraft,
              'safetyPractices',
              safetyPracticeOptions
                .filter((option) => values.includes(option.value))
                .map((option) => option.value)
            )
          }
        >
          <Stack gap='xs' mt='xs'>
            {safetyPracticeOptions.map((option) => (
              <Checkbox key={option.value} label={option.label} value={option.value} />
            ))}
          </Stack>
        </Checkbox.Group>
        {socialListingPolicyFields.map(([label, key]) => (
          <Textarea
            autosize
            key={key}
            label={label}
            maxLength={4000}
            minRows={3}
            required
            value={draft[key]}
            onChange={(event) => updateSocialListingDraft(setDraft, key, event.currentTarget.value)}
          />
        ))}
      </div>
    </section>
  )
}
