import { findOption } from '../../forms/utils/valueGuards'
import { Alert, Badge, Button, Group, Loader, Tabs, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CatchBoundary, useNavigate } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { type ComponentProps, type SubmitEvent, useState } from 'react'
import { useSystemList } from '#app/data/systems/useSystemList'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { SocialInviteDialog } from './components/SocialInviteDialog'
import { SocialListingApplications } from './components/listing-editor/SocialListingApplications'
import { SocialListingInvitations } from './components/listing-editor/SocialListingInvitations'
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
  socialListingManagementSectionLabels,
  socialListingManagementSections,
  type SocialListingManagementSection
} from './socialModels'
import * as styles from './SocialListingFormPage.css'

export function SocialListingFormPage(props: ComponentProps<typeof SocialListingEditor>) {
  const listingPublicId = props.listingPublicId?.toLowerCase()
  return (
    <CatchBoundary getResetKey={() => listingPublicId ?? 'new'} errorComponent={ListingEditorError}>
      <SocialListingEditor
        {...props}
        listingPublicId={listingPublicId}
        key={listingPublicId ?? 'new'}
      />
    </CatchBoundary>
  )
}

function ListingEditorError() {
  return <Alert color='red'>The listing editor is unavailable.</Alert>
}

function SocialListingEditor({
  invitePublicId,
  listingPublicId,
  section = 'listing',
  onSectionChange
}: {
  invitePublicId?: string
  listingPublicId?: string
  section?: SocialListingManagementSection
  onSectionChange?: (section: SocialListingManagementSection) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const campaigns = usePaginatedQuery(
    convexApi.campaigns.queries.list,
    section === 'listing' && !listingPublicId ? {} : 'skip',
    { initialNumItems: 8 }
  )
  const systems = useSystemList(section === 'listing')
  const listingQuery = convexQuery(
    convexApi.social.listings.getOwned,
    listingPublicId ? { listingPublicId } : 'skip'
  )
  const listing = useQuery(listingQuery)
  const createListing = useConvexMutation(convexApi.social.listingDrafts.create)
  const updateListing = useConvexMutation(convexApi.social.listings.update)
  const openListing = useConvexMutation(convexApi.social.listings.open)
  const closeListing = useConvexMutation(convexApi.social.listings.close)
  const removeListing = useConvexMutation(convexApi.social.listingDrafts.remove)
  const [campaignId, setCampaignId] = useState('')
  const [draft, setDraft] = useState<SocialListingDraft>(createEmptySocialListingDraft)
  const [savedListing, setSavedListing] = useState<SocialListingDto>()

  if (listing.data && savedListing?.listingPublicId !== listing.data.listingPublicId) {
    setDraft(socialListingToDraft(listing.data))
    setSavedListing(listing.data)
  }

  const save = useMutation({
    mutationFn: () => {
      const fields = socialListingDraftToFields(draft)
      if (savedListing) {
        return updateListing({
          input: {
            ...fields,
            listingPublicId: savedListing.listingPublicId,
            expectedVersion: savedListing.version
          }
        })
      }
      if (listingPublicId) throw new Error('Wait for the listing to load.')
      if (!campaignId) throw new Error('Choose a Campaign for this listing.')
      return createListing({ input: { ...fields, campaignId } })
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        convexQuery(convexApi.social.listings.getOwned, { listingPublicId: result.listingPublicId })
          .queryKey,
        result
      )
      setDraft(socialListingToDraft(result))
      setSavedListing(result)
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
      if (!savedListing) throw new Error('Save the listing first.')
      const input = {
        listingPublicId: savedListing.listingPublicId,
        expectedVersion: savedListing.version
      }
      return action === 'open' ? openListing(input) : closeListing(input)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        convexQuery(convexApi.social.listings.getOwned, { listingPublicId: result.listingPublicId })
          .queryKey,
        result
      )
      setSavedListing(result)
      notifications.show({ color: 'green', message: `Listing ${result.status.toLowerCase()}.` })
    }
  })
  const deleteDraft = useMutation({
    mutationFn: async () => {
      if (!savedListing) throw new Error('Save the listing first.')
      await removeListing({
        listingPublicId: savedListing.listingPublicId,
        expectedVersion: savedListing.version
      })
    },
    onSuccess: () => {
      void navigate({ to: '/social', search: { view: 'hosting' } })
    }
  })

  if (listingPublicId && listing.isPending) {
    return <Loader aria-label='Loading listing editor' size='sm' />
  }
  if (listing.isError || (section === 'listing' && systems.isError)) {
    return <Alert color='red'>The listing editor is unavailable.</Alert>
  }

  const ownedCampaigns = campaigns.results.filter(
    (campaign) => campaign.capabilities.manageActiveCampaign
  )
  const selectedCampaign = listing.data
    ? {
        name: listing.data.title,
        format: listing.data.format,
        toneTags: listing.data.toneTags,
        contentMaturity: listing.data.contentMaturity
      }
    : (ownedCampaigns.find((campaign) => campaign.id === campaignId) ?? null)
  const hasUnsavedChanges = savedListing
    ? JSON.stringify(draft) !== JSON.stringify(socialListingToDraft(savedListing))
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
              <Badge variant='light'>{formatEnumLabel(listing.data.status)}</Badge>
            ) : null}
          </Group>
          <Text c='dimmed'>
            {section === 'applications'
              ? 'Review applicants for this listing.'
              : section === 'invitations'
                ? 'Track invitations sent for this listing.'
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
            const nextSection = findOption(socialListingManagementSections, value)
            if (nextSection) onSectionChange(nextSection)
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
          {!listingPublicId && campaigns.status === 'CanLoadMore' ? (
            <Button variant='subtle' type='button' onClick={() => campaigns.loadMore(8)}>
              Load more Campaigns
            </Button>
          ) : null}
          {!listingPublicId &&
          (campaigns.status === 'LoadingFirstPage' || campaigns.status === 'LoadingMore') ? (
            <Loader aria-label='Loading Campaigns' size='sm' />
          ) : null}
          <SocialListingScheduleSection
            campaignFormat={selectedCampaign?.format ?? 'ONGOING'}
            draft={draft}
            setDraft={setDraft}
          />
          <SocialListingExpectationsSection draft={draft} setDraft={setDraft} />

          {deleteDraft.error ? <Alert color='red'>{deleteDraft.error.message}</Alert> : null}
          {save.error ? <Alert color='red'>{save.error.message}</Alert> : null}
          {changeStatus.error ? <Alert color='red'>{changeStatus.error.message}</Alert> : null}
          <div className={styles.actions}>
            <Button
              disabled={changeStatus.isPending || deleteDraft.isPending}
              loading={save.isPending}
              type='submit'
            >
              {listing.data?.status === 'CLOSED' ? 'Return to draft' : 'Save listing'}
            </Button>
            {listing.data?.status === 'DRAFT' ? (
              <Button
                disabled={hasUnsavedChanges || save.isPending || deleteDraft.isPending}
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
                disabled={save.isPending || deleteDraft.isPending}
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
                disabled={save.isPending || changeStatus.isPending}
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
        <SocialListingApplications listingPublicId={listing.data.listingPublicId} />
      ) : null}

      {listing.data && section === 'invitations' ? (
        <SocialListingInvitations
          invitePublicId={invitePublicId}
          listingPublicId={listing.data.listingPublicId}
        />
      ) : null}
    </section>
  )
}
