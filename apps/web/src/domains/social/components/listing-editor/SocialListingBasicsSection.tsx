import { Badge, Group, NumberInput, Select, Text, Textarea, TextInput, Title } from '@mantine/core'
import type { Dispatch, SetStateAction } from 'react'
import { updateSocialListingDraft, type SocialListingDraft } from '../../socialFormModel'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { playModeOptions } from '../../socialModels'
import * as styles from './SocialListingSections.css'

export function SocialListingBasicsSection({
  campaignId,
  draft,
  isExisting,
  ownedCampaigns,
  projectedCampaign,
  setCampaignId,
  setDraft,
  systems
}: {
  campaignId: string
  draft: SocialListingDraft
  isExisting: boolean
  ownedCampaigns: ReadonlyArray<{
    id: string
    name: string
    format: 'ONE_SHOT' | 'ONGOING'
    toneTags: string[]
    contentMaturity: 'STANDARD' | 'MATURE'
  }>
  projectedCampaign: {
    name: string
    format: 'ONE_SHOT' | 'ONGOING'
    toneTags: string[]
    contentMaturity: 'STANDARD' | 'MATURE'
  } | null
  setCampaignId: (campaignId: string) => void
  setDraft: Dispatch<SetStateAction<SocialListingDraft>>
  systems: ReadonlyArray<{
    id: string
    label: string
    rulesetCode: string
    rulesetVersion: string
  }>
}) {
  return (
    <section className={styles.panel} aria-labelledby='listing-basics-title'>
      <Title id='listing-basics-title' order={2}>
        Basics
      </Title>
      <div className={styles.formGrid}>
        {!isExisting ? (
          <Select
            data={ownedCampaigns.map((campaign) => ({
              label: campaign.name,
              value: campaign.id
            }))}
            description='One listing can be created for each active Campaign you own.'
            label='Campaign'
            required
            value={campaignId || null}
            onChange={(value) => {
              const nextCampaign = ownedCampaigns.find((campaign) => campaign.id === value)
              setCampaignId(value ?? '')
              if (nextCampaign?.format === 'ONE_SHOT' && draft.scheduleKind === 'RECURRING') {
                updateSocialListingDraft(setDraft, 'scheduleKind', 'FLEXIBLE')
              }
            }}
          />
        ) : null}
        {projectedCampaign ? (
          <div className={styles.spanAll}>
            <Text fw={600}>{projectedCampaign.name}</Text>
            <Group gap='xs' mt='xs'>
              <Badge variant='light'>{formatEnumLabel(projectedCampaign.format)}</Badge>
              <Badge variant='light'>{formatEnumLabel(projectedCampaign.contentMaturity)}</Badge>
              {projectedCampaign.toneTags.map((tag) => (
                <Badge color='gray' key={tag} variant='outline'>
                  {formatEnumLabel(tag)}
                </Badge>
              ))}
            </Group>
            <Text c='dimmed' mt='xs' size='sm'>
              The listing title and table metadata come from this Campaign.
            </Text>
          </div>
        ) : null}
        <Textarea
          autosize
          className={styles.spanAll}
          label='Summary'
          maxLength={2000}
          minRows={4}
          required
          value={draft.summary}
          onChange={(event) =>
            updateSocialListingDraft(setDraft, 'summary', event.currentTarget.value)
          }
        />
        <Select
          data={[
            { label: 'Private — invitations only', value: 'PRIVATE' },
            { label: 'Public — discovery and applications', value: 'PUBLIC' }
          ]}
          label='Audience'
          value={draft.audience}
          onChange={(value) => {
            if (value === 'PRIVATE' || value === 'PUBLIC') {
              updateSocialListingDraft(setDraft, 'audience', value)
            }
          }}
        />
        <Select
          data={systems.map((system) => ({
            label: `${system.label} (${system.rulesetCode} ${system.rulesetVersion})`,
            value: system.id
          }))}
          label='System and ruleset'
          required
          searchable
          value={draft.systemId || null}
          onChange={(value) => updateSocialListingDraft(setDraft, 'systemId', value ?? '')}
        />
        <Select
          data={playModeOptions.map((option) => ({ ...option }))}
          label='Play mode'
          value={draft.playMode}
          onChange={(value) => {
            const next = playModeOptions.find((option) => option.value === value)
            if (next) {
              setDraft((current) => ({
                ...current,
                playMode: next.value,
                ...(next.value === 'ONLINE' ? { city: '', stateCode: '' } : {})
              }))
            }
          }}
        />
        <NumberInput
          hideControls
          label='Seat capacity'
          max={100}
          min={1}
          required
          value={draft.capacity}
          onChange={(value) => {
            if (typeof value === 'number') updateSocialListingDraft(setDraft, 'capacity', value)
          }}
        />
        {draft.playMode !== 'ONLINE' ? (
          <>
            <TextInput
              label='City'
              maxLength={100}
              required
              value={draft.city}
              onChange={(event) =>
                updateSocialListingDraft(setDraft, 'city', event.currentTarget.value)
              }
            />
            <TextInput
              label='State'
              maxLength={2}
              placeholder='IL'
              required
              value={draft.stateCode}
              onChange={(event) =>
                updateSocialListingDraft(
                  setDraft,
                  'stateCode',
                  event.currentTarget.value.toUpperCase()
                )
              }
            />
          </>
        ) : null}
      </div>
    </section>
  )
}
