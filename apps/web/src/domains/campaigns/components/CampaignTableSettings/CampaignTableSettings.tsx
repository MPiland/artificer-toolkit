import {
  Alert,
  Button,
  Checkbox,
  Loader,
  NumberInput,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { CampaignPlaySettingsDto } from '@artificer-toolkit/schema/api/campaigns'
import type { TableSafetyPracticeDto } from '@artificer-toolkit/schema/api/tableSafety'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignPlaySettings } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './CampaignTableSettings.css'

const practices: ReadonlyArray<{
  value: TableSafetyPracticeDto
  label: string
}> = [
  { value: 'SESSION_ZERO', label: 'Session zero' },
  { value: 'LINES_AND_VEILS', label: 'Lines and veils' },
  { value: 'X_CARD', label: 'X-card' },
  { value: 'OPEN_DOOR', label: 'Open door' },
  { value: 'SCRIPT_CHANGE', label: 'Script change' },
  { value: 'OTHER', label: 'Other' }
]

type Draft = Omit<CampaignPlaySettingsDto, 'campaignId' | 'updatedAt' | 'version'>

export function CampaignTableSettings({ campaign }: { campaign: CampaignDetailDto }) {
  const settings = useQuery(getCampaignPlaySettings(campaign.id))
  if (settings.isPending) return <Loader aria-label='Loading table settings' size='sm' />
  if (settings.isError) return <Alert color='red'>Table settings are unavailable.</Alert>
  return <CampaignTableSettingsForm campaign={campaign} settings={settings.data} />
}

function CampaignTableSettingsForm({
  campaign,
  settings
}: {
  campaign: CampaignDetailDto
  settings: CampaignPlaySettingsDto
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const editable = isCampaignTableSettingsEditable(campaign)
  useEffect(() => setDraft(toDraft(settings)), [settings])

  const save = useMutation({
    mutationFn: () =>
      api.campaigns.playSettings.save({
        campaignId: campaign.id,
        expectedVersion: settings.version,
        ...draft
      }),
    onSuccess: (updated) =>
      queryClient.setQueryData(queryKeys.campaigns.playSettings(campaign.id), updated)
  })

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className={styles.panel} aria-labelledby='table-settings-title'>
      <div>
        <Title id='table-settings-title' order={2}>
          Table expectations
        </Title>
        <Text c='dimmed' size='sm'>
          Schedule norms, table agreements, and the live safety method stay visible to every member.
        </Text>
      </div>
      <div className={styles.scheduleGrid}>
        <NumberInput
          disabled={!editable}
          label='Normal cadence (days)'
          min={1}
          max={365}
          value={draft.normalCadenceDays ?? ''}
          onChange={(value) => set('normalCadenceDays', value === '' ? null : Number(value))}
        />
        <NumberInput
          disabled={!editable}
          label='Expected duration (minutes)'
          min={15}
          max={1440}
          step={15}
          value={draft.expectedDurationMinutes ?? ''}
          onChange={(value) => set('expectedDurationMinutes', value === '' ? null : Number(value))}
        />
        <NumberInput
          disabled={!editable}
          label='Quorum'
          min={1}
          max={100}
          value={draft.quorum ?? ''}
          onChange={(value) => set('quorum', value === '' ? null : Number(value))}
        />
      </div>
      <Stack gap='md'>
        <PolicyField
          disabled={!editable}
          label='Absent-character policy'
          value={draft.absentCharacterPolicy}
          onChange={(value) => set('absentCharacterPolicy', value)}
        />
        <PolicyField
          disabled={!editable}
          label='Content guidance'
          value={draft.contentGuidance}
          onChange={(value) => set('contentGuidance', value)}
        />
        <PolicyField
          disabled={!editable}
          label='Allowed content and rules'
          value={draft.allowedContentRules}
          onChange={(value) => set('allowedContentRules', value)}
        />
        <PolicyField
          disabled={!editable}
          label='Table conduct'
          value={draft.tableConduct}
          onChange={(value) => set('tableConduct', value)}
        />
        <PolicyField
          disabled={!editable}
          label='Content boundaries'
          value={draft.contentBoundaries}
          onChange={(value) => set('contentBoundaries', value)}
        />
        <Checkbox.Group
          label='Safety practices'
          value={draft.safetyPractices}
          onChange={(values) =>
            set(
              'safetyPractices',
              practices
                .filter((practice) => values.includes(practice.value))
                .map((practice) => practice.value)
            )
          }
        >
          <div className={styles.practiceGrid}>
            {practices.map((practice) => (
              <Checkbox
                disabled={!editable}
                key={practice.value}
                label={practice.label}
                value={practice.value}
              />
            ))}
          </div>
        </Checkbox.Group>
        <PolicyField
          disabled={!editable}
          label='Live pause / change / skip method'
          maxLength={500}
          value={draft.liveSafetyMethod}
          onChange={(value) => set('liveSafetyMethod', value)}
        />
      </Stack>
      {save.error ? <Alert color='red'>Table settings couldn’t be saved.</Alert> : null}
      {editable ? (
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Save table settings
        </Button>
      ) : null}
    </section>
  )
}

function PolicyField({
  disabled,
  label,
  maxLength = 4000,
  value,
  onChange
}: {
  disabled: boolean
  label: string
  maxLength?: number
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <Textarea
      autosize
      disabled={disabled}
      label={label}
      maxLength={maxLength}
      minRows={2}
      value={value ?? ''}
      onChange={(event) => onChange(event.currentTarget.value.trimStart() || null)}
    />
  )
}

function toDraft(settings: CampaignPlaySettingsDto): Draft {
  const { campaignId: _campaignId, updatedAt: _updatedAt, version: _version, ...draft } = settings
  return draft
}

export function isCampaignTableSettingsEditable(
  campaign: Pick<CampaignDetailDto, 'role' | 'status'>
) {
  return campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
}
