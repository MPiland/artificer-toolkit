import {
  Alert,
  Button,
  Group,
  NumberInput,
  Radio,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import * as sharedStyles from '../campaigns.css'
import * as settingsStyles from './campaignSettings.css'

export function CampaignSettings({ campaign }: { campaign: CampaignDetailDto }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description ?? '')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>(campaign.visibility)
  const [attunementSlotOverride, setAttunementSlotOverride] = useState<string | number>(
    campaign.attunementSlotOverride ?? ''
  )
  const editable = campaign.capabilities.edit && campaign.status === 'ACTIVE'

  async function refreshCampaign() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() })
    ])
  }

  const update = useMutation({
    mutationFn: () =>
      api.campaigns.update({
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        name: name.trim() || campaign.name,
        description: description.trim() || null,
        attunementSlotOverride:
          attunementSlotOverride === '' ? null : Number(attunementSlotOverride),
        visibility
      }),
    onSuccess: refreshCampaign
  })
  const lifecycle = useMutation({
    mutationFn: async (action: 'ARCHIVE' | 'DELETE') => {
      if (action === 'ARCHIVE') await api.campaigns.archive(campaign.id, campaign.version)
      else await api.campaigns.delete(campaign.id, campaign.version)
    },
    onSuccess: async (_result, action) => {
      await refreshCampaign()
      if (action === 'DELETE') await navigate({ to: '/campaigns' })
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
      </section>
      <section className={sharedStyles.panel} aria-labelledby='campaign-access-title'>
        <Title order={2} id='campaign-access-title'>
          Campaign access
        </Title>
        <Radio.Group
          label='Listing visibility'
          value={visibility}
          onChange={(value) => setVisibility(value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE')}
        >
          <Group mt='xs'>
            <Radio disabled={!editable} label='Private' value='PRIVATE' />
            <Radio disabled={!editable} label='Public' value='PUBLIC' />
          </Group>
        </Radio.Group>
        <Text c='dimmed' size='sm'>
          {visibility === 'PUBLIC' ? 'Public listing' : 'Private Campaign'}
        </Text>
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
                if (window.confirm('Permanently delete this Campaign?')) lifecycle.mutate('DELETE')
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
