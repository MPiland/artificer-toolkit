import { Alert, Badge, Button, Group, Loader, Tabs, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type SubmitEvent, useEffect, useState } from 'react'
import { getCampaignList } from '#app/data/campaigns/queries'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SocialInviteDialog } from './components/SocialInviteDialog'
import { SocialListingApplications } from './components/listing-editor/SocialListingApplications'
import { SocialListingBasicsSection } from './components/listing-editor/SocialListingBasicsSection'
import { SocialListingExpectationsSection } from './components/listing-editor/SocialListingExpectationsSection'
import { SocialListingScheduleSection } from './components/listing-editor/SocialListingScheduleSection'
import {
  createEmptySocialListingDraft,
  socialListingDraftToFields,
  socialListingToDraft,
  type SocialListingDraft
} from './socialFormModel'
import {
  formatStatusLabel,
  socialListingManagementSectionLabels,
  socialListingManagementSections,
  type SocialListingManagementSection
} from './socialModels'
import * as styles from './SocialListingFormPage.css'

export function SocialListingFormPage({
  listingPublicId,
  section = 'listing',
  onSectionChange
}: {
  listingPublicId?: string
  section?: SocialListingManagementSection
  onSectionChange?: (section: SocialListingManagementSection) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const campaigns = useQuery({ ...getCampaignList(), enabled: section === 'listing' })
  const systems = useQuery({ ...getSystemList(), enabled: section === 'listing' })
  const listing = useQuery({
    queryKey: queryKeys.socialHub.listing(listingPublicId ?? 'new'),
    queryFn: () => api.socialHub.listings.getOwned(listingPublicId ?? ''),
    enabled: Boolean(listingPublicId)
  })
  const applications = useQuery({
    queryKey: queryKeys.socialHub.applicationsForListing(listingPublicId ?? 'new'),
    queryFn: () => api.socialHub.applications.forListing(listingPublicId ?? ''),
    enabled: Boolean(listingPublicId) && section === 'applications'
  })
  const [campaignId, setCampaignId] = useState('')
  const [draft, setDraft] = useState<SocialListingDraft>(createEmptySocialListingDraft)
  const [hydratedListingId, setHydratedListingId] = useState<string>()

  useEffect(() => {
    if (!listing.data || hydratedListingId === listing.data.listingPublicId) return
    setDraft(socialListingToDraft(listing.data))
    setHydratedListingId(listing.data.listingPublicId)
  }, [hydratedListingId, listing.data])

  const save = useMutation({
    mutationFn: () => {
      const fields = socialListingDraftToFields(draft)
      if (listing.data) {
        return api.socialHub.listings.update({
          ...fields,
          listingPublicId: listing.data.listingPublicId,
          expectedVersion: listing.data.version
        })
      }
      if (!campaignId) throw new Error('Choose a Campaign for this listing.')
      return api.socialHub.listings.create({ ...fields, campaignId })
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.socialHub.listing(result.listingPublicId), result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.listingsMine() })
      setDraft(socialListingToDraft(result))
      setHydratedListingId(result.listingPublicId)
      notifications.show({ color: 'green', message: 'Listing saved.' })
      if (!listingPublicId) {
        void navigate({
          params: { listingPublicId: result.listingPublicId },
          replace: true,
          search: { section: 'listing' },
          to: '/social/hosting/$listingPublicId/edit'
        })
      }
    }
  })
  const changeStatus = useMutation({
    mutationFn: (action: 'open' | 'close') => {
      if (!listing.data) throw new Error('Save the listing first.')
      const input = {
        listingPublicId: listing.data.listingPublicId,
        expectedVersion: listing.data.version
      }
      return action === 'open'
        ? api.socialHub.listings.open(input)
        : api.socialHub.listings.close(input)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.socialHub.listing(result.listingPublicId), result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.listingsMine() })
      notifications.show({ color: 'green', message: `Listing ${result.status.toLowerCase()}.` })
    }
  })
  const deleteDraft = useMutation({
    mutationFn: async () => {
      if (!listing.data) return
      await api.socialHub.listings.deleteDraft({
        listingPublicId: listing.data.listingPublicId,
        expectedVersion: listing.data.version
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.listingsMine() })
      void navigate({ to: '/social', search: { view: 'hosting' } })
    }
  })

  if (listingPublicId && listing.isPending) {
    return <Loader aria-label='Loading listing editor' size='sm' />
  }
  if (listing.isError || (section === 'listing' && (campaigns.isError || systems.isError))) {
    return <Alert color='red'>The listing editor is unavailable.</Alert>
  }

  const ownedCampaigns = (campaigns.data ?? []).filter(
    (campaign) => campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
  )
  const selectedCampaign = listing.data
    ? {
        name: listing.data.title,
        format: listing.data.format,
        toneTags: listing.data.toneTags,
        contentMaturity: listing.data.contentMaturity
      }
    : (ownedCampaigns.find((campaign) => campaign.id === campaignId) ?? null)
  const hasUnsavedChanges = listing.data
    ? JSON.stringify(draft) !== JSON.stringify(socialListingToDraft(listing.data))
    : true

  return (
    <section className={styles.page} aria-labelledby='social-listing-editor-title'>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <Group gap='xs'>
            <Title id='social-listing-editor-title' order={1}>
              {listing.data ? `Manage ${listing.data.title}` : 'Create a Social listing'}
            </Title>
            {listing.data ? (
              <Badge variant='light'>{formatStatusLabel(listing.data.status)}</Badge>
            ) : null}
          </Group>
          <Text c='dimmed'>
            {section === 'applications'
              ? 'Review applicants for this listing.'
              : 'Listings describe a free table. Campaign details stay private until admission.'}
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant='subtle'
            onClick={() => navigate({ to: '/social', search: { view: 'hosting' } })}
          >
            Back to hosting
          </Button>
          {listing.data ? <SocialInviteDialog listing={listing.data} /> : null}
        </div>
      </header>

      {listing.data && onSectionChange ? (
        <Tabs
          className={styles.managementTabs}
          value={section}
          onChange={(value) => {
            if (socialListingManagementSections.includes(value as SocialListingManagementSection)) {
              onSectionChange(value as SocialListingManagementSection)
            }
          }}
        >
          <Tabs.List aria-label='Listing management views'>
            {socialListingManagementSections.map((managementSection) => (
              <Tabs.Tab
                className={styles.managementTab}
                key={managementSection}
                value={managementSection}
              >
                {socialListingManagementSectionLabels[managementSection]}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      ) : null}

      {section === 'listing' ? (
        <form
          className={styles.form}
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <SocialListingBasicsSection
            campaignId={campaignId}
            draft={draft}
            isExisting={Boolean(listing.data)}
            ownedCampaigns={ownedCampaigns}
            projectedCampaign={selectedCampaign}
            setCampaignId={setCampaignId}
            setDraft={setDraft}
            systems={systems.data ?? []}
          />
          <SocialListingScheduleSection
            campaignFormat={selectedCampaign?.format ?? 'ONGOING'}
            draft={draft}
            setDraft={setDraft}
          />
          <SocialListingExpectationsSection draft={draft} setDraft={setDraft} />

          {save.error ? <Alert color='red'>{save.error.message}</Alert> : null}
          {changeStatus.error ? <Alert color='red'>{changeStatus.error.message}</Alert> : null}
          <div className={styles.actions}>
            <Button loading={save.isPending} type='submit'>
              Save listing
            </Button>
            {listing.data?.status === 'DRAFT' || listing.data?.status === 'CLOSED' ? (
              <Button
                disabled={hasUnsavedChanges}
                loading={changeStatus.isPending}
                type='button'
                variant='default'
                onClick={() => changeStatus.mutate('open')}
              >
                Open listing
              </Button>
            ) : null}
            {listing.data?.status === 'OPEN' ? (
              <Button
                loading={changeStatus.isPending}
                type='button'
                variant='default'
                onClick={() => changeStatus.mutate('close')}
              >
                Close listing
              </Button>
            ) : null}
            {listing.data?.status === 'DRAFT' ? (
              <Button
                color='red'
                loading={deleteDraft.isPending}
                type='button'
                variant='subtle'
                onClick={() => {
                  if (window.confirm('Delete this Social listing draft?')) deleteDraft.mutate()
                }}
              >
                Delete draft
              </Button>
            ) : null}
          </div>
          {listing.data && hasUnsavedChanges ? (
            <Text c='dimmed' size='sm'>
              Save changes before opening the listing.
            </Text>
          ) : null}
        </form>
      ) : null}

      {listing.data && section === 'applications' ? (
        <SocialListingApplications
          applications={applications.data ?? []}
          isError={applications.isError}
          isPending={applications.isPending}
          listing={listing.data}
        />
      ) : null}
    </section>
  )
}
