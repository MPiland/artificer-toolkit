import { Alert, Button, Group, Modal, SegmentedControl, Stack, TextInput } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { UpdateSocialContentPreferenceInput } from '@artificer-toolkit/schema/api/socialHub'
import { type SubmitEvent, useState } from 'react'
import { latestAdultBirthDate } from '#app/domains/social/socialAge'
import * as styles from './settings.css'

export function MatureContentPreference() {
  const queryClient = useQueryClient()
  const [birthDate, setBirthDate] = useState('')
  const [attestationOpened, setAttestationOpened] = useState(false)
  const preferenceQuery = convexQuery(convexApi.social.profiles.getEligibility, {})
  const preference = useQuery(preferenceQuery)
  const updateSocialPreference = useConvexMutation(convexApi.social.profiles.updatePreference)
  const updatePreference = useMutation({
    mutationFn: (input: UpdateSocialContentPreferenceInput) => updateSocialPreference({ input }),
    onSuccess: (result) => {
      queryClient.setQueryData(preferenceQuery.queryKey, result)
      setAttestationOpened(false)
      setBirthDate('')
    }
  })
  const currentPreference = preference.data?.contentPreference ?? 'STANDARD'

  const choosePreference = (value: string) => {
    if (value !== 'MATURE') {
      updatePreference.mutate({ contentPreference: 'STANDARD' })
      return
    }
    if (!preference.data?.adultAttestedAt) {
      updatePreference.reset()
      setAttestationOpened(true)
      return
    }
    updatePreference.mutate({ contentPreference: 'MATURE' })
  }

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingCopy}>
          <h3 className={styles.settingTitle}>Social content visibility</h3>
          <p className={styles.settingDescription}>
            Standard masks strong language in public Social Hub content. Mature content shows after
            you confirm that you are 18 or older.
          </p>
        </div>
        <Stack gap='xs'>
          <SegmentedControl
            aria-label='Social content visibility'
            className={styles.appearanceControl}
            data={[
              { label: 'Standard', value: 'STANDARD' },
              { label: 'Mature', value: 'MATURE' }
            ]}
            disabled={preference.isPending || preference.isError || updatePreference.isPending}
            value={currentPreference}
            onChange={choosePreference}
          />
          {preference.isError ? (
            <Alert color='red'>Content visibility is unavailable. Reload to try again.</Alert>
          ) : null}
          {updatePreference.isError && !attestationOpened ? (
            <Alert color='red'>{updatePreference.error.message}</Alert>
          ) : null}
        </Stack>
      </div>
      <Modal
        opened={attestationOpened}
        title='Confirm you are 18 or older'
        onClose={() => {
          setAttestationOpened(false)
          setBirthDate('')
          updatePreference.reset()
        }}
      >
        <form
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            if (birthDate) {
              updatePreference.mutate({ contentPreference: 'MATURE', birthDate })
            }
          }}
        >
          <Stack>
            <TextInput
              required
              description='Used once to confirm you are 18 or older. Your birth date is not stored.'
              label='Date of birth'
              max={latestAdultBirthDate()}
              type='date'
              value={birthDate}
              onChange={(event) => setBirthDate(event.currentTarget.value)}
            />
            {updatePreference.isError ? (
              <Alert color='red'>{updatePreference.error.message}</Alert>
            ) : null}
            <Group justify='flex-end'>
              <Button
                type='button'
                variant='default'
                onClick={() => {
                  setAttestationOpened(false)
                  setBirthDate('')
                  updatePreference.reset()
                }}
              >
                Cancel
              </Button>
              <Button disabled={!birthDate} loading={updatePreference.isPending} type='submit'>
                Confirm age and show mature text
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
