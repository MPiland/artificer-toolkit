import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title
} from '@mantine/core'
import type {
  BeginCampaignCopyInput,
  CampaignCopyProgress
} from '@artificer-toolkit/schema/api/campaignCopy'
import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConvex, useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import * as sharedStyles from '../campaigns.css'

type NotebookCategory = CampaignCopyProgress['notebookCategories'][number]

type CampaignCopyProps = {
  campaigns: readonly CampaignSummaryDto[]
  source: CampaignSummaryDto | null
  onClose: () => void
  onOpen: (campaign: CampaignSummaryDto) => void
}

const notebookCategories: ReadonlyArray<{ value: NotebookCategory; label: string }> = [
  { value: 'GENERAL', label: 'Notes' },
  { value: 'PEOPLE', label: 'People / NPC notes' },
  { value: 'PLACES', label: 'Places / cities' }
]

const statusLabels: Record<CampaignCopyProgress['status'], string> = {
  RUNNING: 'Copying',
  CLEANING: 'Cleaning up',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
}

export function CampaignCopy({ campaigns, source, onClose, onOpen }: CampaignCopyProps) {
  const navigate = useNavigate()
  const [selectedCategories, setSelectedCategories] = useState<NotebookCategory[]>([])
  const begin = useConvexMutation(convexApi.campaigns.copyJobs.begin)
  const convex = useConvex()
  const cancel = useConvexMutation(convexApi.campaigns.copyJobs.cancel)
  const jobs = usePaginatedQuery(convexApi.campaigns.copyJobs.list, {}, { initialNumItems: 8 })
  const beginCopy = useMutation({
    retry: 1,
    mutationFn: (input: BeginCampaignCopyInput) => begin(input),
    onSuccess: async (copy) => {
      if (copy.status !== 'COMPLETED' || !copy.destination) return
      setSelectedCategories([])
      onClose()
      await navigate({
        to: '/campaigns/$campaignPublicId/$campaignSlug',
        params: buildCampaignRouteParams(copy.destination.publicId, copy.destination.name)
      })
    }
  })
  const openCopy = useMutation({
    mutationFn: async (copyId: string) => {
      const copy = await convex.query(convexApi.campaigns.copyJobs.progress, { copyId })
      if (copy.status !== 'COMPLETED' || !copy.destination)
        throw new Error('This copied Campaign is no longer available.')
      return copy.destination
    },
    onSuccess: async (destination) => {
      await navigate({
        to: '/campaigns/$campaignPublicId/$campaignSlug',
        params: buildCampaignRouteParams(destination.publicId, destination.name)
      })
    }
  })
  const cancelCopy = useMutation({ mutationFn: (copyId: string) => cancel({ copyId }) })

  const closePicker = () => {
    if (beginCopy.isPending) return
    beginCopy.reset()
    setSelectedCategories([])
    onClose()
  }

  return (
    <>
      <Modal
        centered
        closeOnClickOutside={!beginCopy.isPending}
        closeOnEscape={!beginCopy.isPending}
        opened={source !== null}
        onClose={closePicker}
        title='Copy Campaign'
        withCloseButton={!beginCopy.isPending}
      >
        <Stack gap='md'>
          <Text>
            Campaign settings, description, System, catalogues, and attunement settings are copied
            automatically.
          </Text>
          <Checkbox.Group
            label='Notebook content to copy'
            value={selectedCategories}
            onChange={setSelectedCategories}
          >
            <Stack gap='xs' mt='xs'>
              {notebookCategories.map((category) => (
                <Checkbox key={category.value} label={category.label} value={category.value} />
              ))}
            </Stack>
          </Checkbox.Group>
          <Text c='dimmed' size='sm'>
            Saved encounters remain in your DM Library. Session and player history, direct shares,
            and inventory are not copied.
          </Text>
          {beginCopy.error ? <Alert color='red'>{beginCopy.error.message}</Alert> : null}
          {beginCopy.isSuccess && source ? (
            <Alert color='blue'>
              Copying {source.name} in the background. You can close this window.
            </Alert>
          ) : null}
          <Group justify='flex-end'>
            <Button disabled={beginCopy.isPending} variant='default' onClick={closePicker}>
              Cancel
            </Button>
            <Button
              disabled={!source || beginCopy.isPending || beginCopy.isSuccess}
              loading={beginCopy.isPending}
              onClick={() => {
                if (!source) return
                const previousInput = beginCopy.variables
                const sameIntent =
                  previousInput !== undefined &&
                  previousInput.campaignId === source.id &&
                  previousInput.expectedVersion === source.version &&
                  (previousInput.notebookCategories ?? []).length === selectedCategories.length &&
                  (previousInput.notebookCategories ?? []).every(
                    (category, index) => category === selectedCategories[index]
                  )
                beginCopy.mutate(
                  sameIntent && previousInput
                    ? previousInput
                    : {
                        campaignId: source.id,
                        expectedVersion: source.version,
                        commandId: crypto.randomUUID(),
                        notebookCategories: selectedCategories
                      }
                )
              }}
            >
              Copy Campaign
            </Button>
          </Group>
        </Stack>
      </Modal>

      <section className={sharedStyles.panel} aria-labelledby='campaign-copy-progress-title'>
        <Group justify='space-between'>
          <Title id='campaign-copy-progress-title' order={2} size='h3'>
            Campaign copy progress
          </Title>
          {jobs.status === 'LoadingFirstPage' ? (
            <Loader aria-label='Loading Campaign copy progress' size='sm' />
          ) : null}
        </Group>
        {jobs.status === 'Exhausted' && jobs.results.length === 0 ? (
          <Text c='dimmed'>No Campaign copies yet.</Text>
        ) : null}
        {jobs.status !== 'LoadingFirstPage' ? (
          <Stack gap='sm'>
            {jobs.results.map((copy) => {
              const retrySource = campaigns.find(
                (campaign) => campaign.id === copy.sourceCampaignId
              )
              const actionError =
                (openCopy.variables === copy.copyId ? openCopy.error : null) ??
                (cancelCopy.variables === copy.copyId ? cancelCopy.error : null)
              return (
                <div
                  className={sharedStyles.memberRow}
                  data-testid={`campaign-copy-${copy.copyId}`}
                  key={copy.copyId}
                >
                  <div>
                    <Group gap='xs'>
                      <Text fw={600}>{copy.sourceName}</Text>
                      <Badge>{statusLabels[copy.status]}</Badge>
                    </Group>
                    <Text c='dimmed' size='sm'>
                      {copy.copiedSections} {copy.copiedSections === 1 ? 'section' : 'sections'}{' '}
                      copied
                    </Text>
                    {copy.failureReason ? (
                      <Text c='red' size='sm'>
                        {copy.failureReason}
                      </Text>
                    ) : null}
                    {actionError ? (
                      <Alert color='red' mt='xs'>
                        {actionError.message}
                      </Alert>
                    ) : null}
                  </div>
                  <Group gap='xs'>
                    {copy.status === 'RUNNING' ? (
                      <Button
                        loading={cancelCopy.isPending && cancelCopy.variables === copy.copyId}
                        size='xs'
                        variant='default'
                        onClick={() => cancelCopy.mutate(copy.copyId)}
                      >
                        Cancel copy
                      </Button>
                    ) : null}
                    {copy.status === 'COMPLETED' ? (
                      <Button
                        loading={openCopy.isPending && openCopy.variables === copy.copyId}
                        size='xs'
                        onClick={() => openCopy.mutate(copy.copyId)}
                      >
                        Open
                      </Button>
                    ) : null}
                    {copy.status === 'FAILED' && retrySource?.role === 'OWNER' ? (
                      <Button size='xs' variant='default' onClick={() => onOpen(retrySource)}>
                        Copy again
                      </Button>
                    ) : null}
                  </Group>
                </div>
              )
            })}
            {jobs.status === 'CanLoadMore' ? (
              <Button size='sm' variant='subtle' onClick={() => jobs.loadMore(8)}>
                Load more copies
              </Button>
            ) : null}
            {jobs.status === 'LoadingMore' ? (
              <Loader aria-label='Loading more Campaign copies' size='sm' />
            ) : null}
          </Stack>
        ) : null}
      </section>
    </>
  )
}
