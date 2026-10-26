import {
  Alert,
  Button,
  Checkbox,
  Loader,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  campaignPlaySettingsDtoSchema,
  campaignPlaySettingsOptionsDtoSchema,
  type CampaignPlaySettingsDto,
  type CampaignPlaySettingsOptionsDto
} from '@artificer-toolkit/schema/api/campaignSettings'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { TableSafetyPracticeDto } from '@artificer-toolkit/schema/api/tableSafety'
import { useMutation as useConvexMutation } from 'convex/react'
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
  const settings = useQuery(
    convexQuery(convexApi.campaigns.playSettings.get, { campaignId: campaign.id })
  )
  const options = useQuery(
    convexQuery(convexApi.campaigns.playSettings.options, { campaignId: campaign.id })
  )
  if (settings.isPending || options.isPending)
    return <Loader aria-label='Loading table settings' size='sm' />
  if (settings.isError || options.isError)
    return <Alert color='red'>Table settings are unavailable.</Alert>
  return (
    <CampaignTableSettingsForm
      campaign={campaign}
      options={campaignPlaySettingsOptionsDtoSchema.parse(options.data)}
      settings={campaignPlaySettingsDtoSchema.parse(settings.data)}
    />
  )
}

function CampaignTableSettingsForm({
  campaign,
  options,
  settings
}: {
  campaign: CampaignDetailDto
  options: CampaignPlaySettingsOptionsDto
  settings: CampaignPlaySettingsDto
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const editable = campaign.capabilities.manageActiveCampaign
  const savePlaySettings = useConvexMutation(convexApi.campaigns.playSettings.save)
  const selectedInitiativePolicy = options.initiativePolicies.find(
    (policy) => policy.definitionId === draft.initiativePolicyDefinitionId
  )
  const [syncedVersion, setSyncedVersion] = useState(settings.version)
  if (syncedVersion !== settings.version) {
    setSyncedVersion(settings.version)
    setDraft(toDraft(settings))
  }

  const save = useMutation({
    mutationFn: () =>
      savePlaySettings({
        campaignId: campaign.id,
        expectedVersion: settings.version,
        ...draft
      })
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
      <div>
        <Title order={3}>Rules automation</Title>
        <Text c='dimmed' size='sm'>
          Choose how much of the rules engine resolves for the table. New Encounters snapshot these
          settings.
        </Text>
      </div>
      <div className={styles.scheduleGrid}>
        <Select
          data={[
            { value: 'ASSISTED', label: 'Assisted' },
            { value: 'MANUAL', label: 'Manual' }
          ]}
          description='Assisted resolves the rules for you. Manual tracks turns, HP and dice only.'
          disabled={!editable}
          label='Automation mode'
          onChange={(value) => {
            if (value === 'ASSISTED' || value === 'MANUAL') set('automationMode', value)
          }}
          value={draft.automationMode}
        />
        <Select
          data={[
            { value: 'GM_PROMPT', label: 'GM prompt' },
            { value: 'SEARCH_ONLY', label: 'Search only' }
          ]}
          description='GM prompt quietly tells only the GM when a Character who does not know of a concealed zone could spot it. Search only waits for a player to search and the GM to decide.'
          disabled={!editable}
          label='Noticing concealed zones'
          onChange={(value) => {
            if (value === 'GM_PROMPT' || value === 'SEARCH_ONLY') set('zoneNoticing', value)
          }}
          value={draft.zoneNoticing}
        />
        <Checkbox
          checked={draft.trackAmmunition}
          description='Each ammunition attack draws a piece from the chosen stack and is refused when none is left. Off, the chosen ammunition still applies its bonuses and nothing is counted.'
          disabled={!editable}
          label='Track ammunition'
          onChange={(event) => set('trackAmmunition', event.currentTarget.checked)}
        />
        <Select
          clearable
          data={options.initiativePolicies.map((policy) => ({
            value: policy.definitionId,
            label: policy.label
          }))}
          description='Leave empty to use the Game System default.'
          disabled={!editable}
          label='Initiative policy'
          onChange={(value) => {
            set('initiativePolicyDefinitionId', value)
            set('initiativeTieDefinitionId', null)
          }}
          value={draft.initiativePolicyDefinitionId}
        />
        <Select
          clearable
          data={(selectedInitiativePolicy?.tieResolvers ?? []).map((resolver) => ({
            value: resolver.definitionId,
            label: resolver.label
          }))}
          description='Leave empty to use the policy default.'
          disabled={!editable || !selectedInitiativePolicy}
          label='Initiative tie resolver'
          onChange={(value) => set('initiativeTieDefinitionId', value)}
          value={draft.initiativeTieDefinitionId}
        />
      </div>
      <MultiSelect
        clearable
        data={options.optionalCombatRules.map((rule) => ({
          value: rule.definitionId,
          label: rule.label
        }))}
        description='Each selected rule is frozen when a new Encounter starts.'
        disabled={!editable}
        label='Optional combat rules'
        maxValues={14}
        onChange={(values) =>
          set(
            'optionalCombatRuleDefinitionIds',
            [...values].sort((left, right) => left.localeCompare(right))
          )
        }
        searchable
        value={draft.optionalCombatRuleDefinitionIds}
      />
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
