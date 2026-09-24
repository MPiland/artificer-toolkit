import {
  Alert,
  Button,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  TextInput,
  Title
} from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { SystemListItemDto } from '@artificer-toolkit/schema/api/systems'
import { useMutation as useConvexMutation } from 'convex/react'
import { useSystemList } from '#app/data/systems/useSystemList'
import { queryKeys } from '#app/lib/queryKeys'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import * as sharedStyles from '../campaigns.css'
import * as settingsStyles from './campaignSettings.css'
import { CampaignMetadataFields } from './CampaignMetadataFields'

export function CampaignSettings({
  campaign,
  onDeleteConfirmed,
  onDeleteFailed
}: {
  campaign: CampaignDetailDto
  onDeleteConfirmed?: () => void
  onDeleteFailed?: () => void
}) {
  const settings = useQuery(convexQuery(convexApi.campaigns.queries.settings, { id: campaign.id }))
  const systems = useSystemList()
  if (settings.isPending || systems.isPending)
    return <Loader aria-label='Loading Campaign settings' size='sm' />
  if (settings.isError || systems.isError)
    return <Alert color='red'>Campaign settings are unavailable.</Alert>
  return (
    <CampaignSettingsForm
      campaign={settings.data}
      systems={systems.data}
      onDeleteConfirmed={onDeleteConfirmed}
      onDeleteFailed={onDeleteFailed}
    />
  )
}

function CampaignSettingsForm({
  campaign,
  systems,
  onDeleteConfirmed,
  onDeleteFailed
}: {
  campaign: CampaignDetailDto
  systems: SystemListItemDto[]
  onDeleteConfirmed?: () => void
  onDeleteFailed?: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description ?? '')
  const [format, setFormat] = useState(campaign.format)
  const [toneTags, setToneTags] = useState(campaign.toneTags)
  const [toneDetails, setToneDetails] = useState(campaign.toneDetails ?? '')
  const [contentMaturity, setContentMaturity] = useState(campaign.contentMaturity)
  const [attunementSlotOverride, setAttunementSlotOverride] = useState<string | number>(
    campaign.attunementSlotOverride ?? ''
  )
  const [primaryRulesCatalogueId, setPrimaryRulesCatalogueId] = useState(
    campaign.primaryRulesCatalogueId
  )
  const [additionalRulesCatalogueIds, setAdditionalRulesCatalogueIds] = useState(
    campaign.additionalRulesCatalogueIds
  )
  const gameSystem = systems.find((system) => system.id === campaign.gameSystemId)
  const catalogueOptions = (gameSystem?.rulesCatalogues ?? []).map((catalogue) => ({
    value: catalogue.id,
    label: catalogue.label
  }))
  const editable = campaign.capabilities.edit && campaign.status === 'ACTIVE'
  const updateCampaign = useConvexMutation(convexApi.campaigns.update.update)
  const archiveCampaign = useConvexMutation(convexApi.campaigns.archive.archive)
  const deleteCampaign = useConvexMutation(convexApi.campaigns.deletion.remove)

  async function refreshCampaign() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
    ])
  }

  const update = useMutation({
    mutationFn: () =>
      updateCampaign({
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        name: name.trim() || campaign.name,
        description: description.trim() || null,
        format,
        toneTags,
        toneDetails: toneDetails.trim() || null,
        contentMaturity,
        attunementSlotOverride:
          attunementSlotOverride === '' ? null : Number(attunementSlotOverride),
        primaryRulesCatalogueId,
        additionalRulesCatalogueIds
      }),
    onSuccess: refreshCampaign
  })
  const lifecycle = useMutation({
    mutationFn: async (action: 'ARCHIVE' | 'DELETE') => {
      if (action === 'ARCHIVE')
        await archiveCampaign({ campaignId: campaign.id, expectedVersion: campaign.version })
      else
        await deleteCampaign({
          campaignId: campaign.id,
          expectedVersion: campaign.version,
          confirmation: 'DELETE'
        })
    },
    onSuccess: async (_result, action) => {
      if (action !== 'DELETE') return refreshCampaign()
      await navigate({ to: '/campaigns', search: { campaignId: campaign.id } })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.all() })
      ])
    },
    onError: (_error, action) => {
      if (action === 'DELETE') onDeleteFailed?.()
    }
  })
  const error = update.error ?? lifecycle.error

  return (
    <div className={settingsStyles.overviewStack}>
      <section className={sharedStyles.panel} aria-labelledby='campaign-details-title'>
        <div>
          <Title order={2} id='campaign-details-title'>
            Campaign details
          </Title>
          <TextInput
            classNames={{ input: sharedStyles.input }}
            disabled={!editable}
            label='Name'
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <RichTextEditor
          label='Description'
          maximumLength={20000}
          name='campaign-description'
          onChange={setDescription}
          placeholder='Set the scene, tone, and premise for your table.'
          readOnly={!editable}
          value={description}
        />
        <CampaignMetadataFields
          contentMaturity={contentMaturity}
          disabled={!editable}
          format={format}
          toneDetails={toneDetails}
          toneTags={toneTags}
          onContentMaturityChange={setContentMaturity}
          onFormatChange={setFormat}
          onToneDetailsChange={setToneDetails}
          onToneTagsChange={setToneTags}
        />
      </section>
      <section className={sharedStyles.panel} aria-labelledby='campaign-rules-title'>
        <Title order={2} id='campaign-rules-title'>
          Campaign rules
        </Title>
        <NumberInput
          allowDecimal={false}
          classNames={{ input: sharedStyles.input }}
          disabled={!editable}
          label='Attunement slot limit'
          min={0}
          onChange={setAttunementSlotOverride}
          placeholder='Ruleset default'
          value={attunementSlotOverride}
        />
        <Select
          disabled
          label='Game System'
          value={campaign.gameSystemId}
          data={[
            { value: campaign.gameSystemId, label: gameSystem?.label ?? 'Configured Game System' }
          ]}
        />
        <Select
          data={catalogueOptions}
          disabled={!editable}
          label='Primary Rules Catalogue'
          onChange={(value) => {
            if (!value) return
            setPrimaryRulesCatalogueId(value)
            setAdditionalRulesCatalogueIds((current) => current.filter((id) => id !== value))
          }}
          required
          value={primaryRulesCatalogueId}
        />
        <MultiSelect
          data={catalogueOptions.filter((option) => option.value !== primaryRulesCatalogueId)}
          disabled={!editable}
          label='Additional Rules Catalogues'
          onChange={setAdditionalRulesCatalogueIds}
          searchable
          value={additionalRulesCatalogueIds}
        />
      </section>
      {editable ? (
        <Group justify='flex-start'>
          <Button loading={update.isPending} onClick={() => update.mutate()}>
            Save Campaign
          </Button>
        </Group>
      ) : null}
      {error ? <Alert color='red'>{error.message}</Alert> : null}
      <section className={sharedStyles.panel} aria-labelledby='campaign-lifecycle-title'>
        <Title order={2} id='campaign-lifecycle-title'>
          Campaign lifecycle
        </Title>
        <Stack className={settingsStyles.compactActions} gap='xs'>
          {campaign.capabilities.archive && campaign.status === 'ACTIVE' ? (
            <Button
              color='orange'
              variant='outline'
              onClick={() => {
                if (window.confirm('Archive this Campaign? It will become read-only.'))
                  lifecycle.mutate('ARCHIVE')
              }}
            >
              Archive
            </Button>
          ) : null}
          {campaign.capabilities.delete ? (
            <Button
              color='red'
              variant='outline'
              onClick={() => {
                if (window.confirm('Permanently delete this Campaign?')) {
                  onDeleteConfirmed?.()
                  lifecycle.mutate('DELETE')
                }
              }}
            >
              Delete
            </Button>
          ) : null}
        </Stack>
      </section>
    </div>
  )
}
