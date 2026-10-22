import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { BookOpenText } from 'lucide-react'
import { useConvex, usePaginatedQuery } from 'convex/react'
import { type SubmitEvent, useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import { renderSanitizedRichHtml } from '#app/lib/richText'
import { findOption } from '#app/forms/utils/valueGuards'
import type { CampaignSessionNoteSectionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { CampaignNoteByline, CampaignNoteVisibilitySelect } from './CampaignNoteVisibility'
import { SessionSectionEditor } from './CampaignSessionNotes'
import * as sharedStyles from '../campaigns.css'

export function CampaignNotesDrawer({
  campaignId,
  currentUserId
}: {
  campaignId: string
  currentUserId: string
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const campaign = useQuery({ ...getCampaignDetail(campaignId), enabled: opened })

  return (
    <>
      <Tooltip label='Campaign notes'>
        <ActionIcon aria-label='Open Campaign notes' size='lg' variant='default' onClick={open}>
          <BookOpenText aria-hidden='true' size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close Campaign notes' }}
        opened={opened}
        position='right'
        size='lg'
        title={campaign.data ? `${campaign.data.name} notes` : 'Campaign notes'}
        onClose={close}
      >
        {campaign.isPending ? <Loader size='sm' /> : null}
        {campaign.isError ? <Alert color='red'>Campaign notes could not be loaded.</Alert> : null}
        {campaign.data ? (
          <CampaignNotesContent campaign={campaign.data} currentUserId={currentUserId} />
        ) : null}
      </Drawer>
    </>
  )
}

function CampaignNotesContent({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  const [view, setView] = useState<'campaign' | 'sessions'>('campaign')
  const notebook = usePaginatedQuery(
    convexApi.campaigns.notebooks.list,
    view === 'campaign' ? { campaignId: campaign.id } : 'skip',
    { initialNumItems: 8 }
  )
  const sessions = usePaginatedQuery(
    convexApi.campaigns.sessions.list,
    view === 'sessions' ? { campaignId: campaign.id } : 'skip',
    { initialNumItems: 8 }
  )
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sessionId = selectedSessionId ?? sessions.results[0]?.id ?? null
  const sessionNotes = usePaginatedQuery(
    convexApi.campaigns.sessionNotes.list,
    view === 'sessions' && sessionId ? { campaignId: campaign.id, sessionId } : 'skip',
    { initialNumItems: 8 }
  )

  return (
    <Stack gap='lg'>
      <SegmentedControl
        aria-label='Notes view'
        data={[
          { label: 'Campaign', value: 'campaign' },
          { label: 'Sessions', value: 'sessions' }
        ]}
        fullWidth
        value={view}
        onChange={(value) => setView(findOption(['campaign', 'sessions'], value) ?? view)}
      />

      {view === 'campaign' ? (
        <section>
          <Text fw={700} mb='sm'>
            Campaign notes
          </Text>
          {notebook.status === 'LoadingFirstPage' ? (
            <Loader aria-label='Loading Campaign notes' size='sm' />
          ) : null}
          <Accordion multiple variant='separated'>
            {(['GENERAL', 'PEOPLE', 'PLACES'] as const).map((category) => {
              const sections = notebook.results.filter((section) => section.category === category)
              const label = `${category.charAt(0)}${category.slice(1).toLowerCase()}`
              return (
                <Accordion.Item key={category} value={`category:${category}`}>
                  <Accordion.Control>{label}</Accordion.Control>
                  <Accordion.Panel>
                    {sections.length ? (
                      <Accordion multiple variant='contained'>
                        {sections.map((section) => (
                          <Accordion.Item key={section.id} value={`campaign:${section.id}`}>
                            <Accordion.Control>{section.title}</Accordion.Control>
                            <Accordion.Panel>
                              <CampaignNoteByline
                                authorLabel={section.authorLabel}
                                showAuthor={
                                  section.visibility === 'SHARED' || campaign.role === 'OWNER'
                                }
                                visibility={section.visibility}
                              />
                              <div>{renderSanitizedRichHtml(section.content)}</div>
                            </Accordion.Panel>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    ) : notebook.status === 'Exhausted' ? (
                      <Text c='dimmed' size='sm'>
                        No {label.toLowerCase()} notes yet.
                      </Text>
                    ) : null}
                  </Accordion.Panel>
                </Accordion.Item>
              )
            })}
          </Accordion>
          {notebook.status === 'CanLoadMore' ? (
            <Button variant='subtle' onClick={() => notebook.loadMore(8)}>
              Load more notes
            </Button>
          ) : null}
          {notebook.status === 'LoadingMore' ? (
            <Loader aria-label='Loading more Campaign notes' size='sm' />
          ) : null}
        </section>
      ) : (
        <section>
          <Group justify='space-between' mb='sm'>
            <Text fw={700}>Session notes</Text>
            <Badge variant='light'>Collaborative</Badge>
          </Group>
          <Select
            classNames={{ input: sharedStyles.input }}
            data={sessions.results.map((session) => ({
              value: session.id,
              label: session.title
                ? session.scheduledStartAt
                  ? `${session.title} · ${formatSessionDate(session.scheduledStartAt, session.timeZone)}`
                  : session.title
                : session.scheduledStartAt
                  ? `Session ${formatSessionDate(session.scheduledStartAt, session.timeZone)}`
                  : `Session ${session.sessionNumber}`
            }))}
            label='Session'
            placeholder='No sessions yet'
            value={sessionId}
            onChange={setSelectedSessionId}
          />
          {sessions.status === 'CanLoadMore' ? (
            <Button variant='subtle' onClick={() => sessions.loadMore(8)}>
              Load more sessions
            </Button>
          ) : null}
          {sessionId && sessionNotes.results.length ? (
            <Accordion multiple mt='md' variant='separated'>
              {sessionNotes.results.map((section) => (
                <Accordion.Item key={section.id} value={`session:${section.id}`}>
                  <Accordion.Control>{section.title}</Accordion.Control>
                  <Accordion.Panel>
                    <SessionSectionEditor
                      campaignId={campaign.id}
                      deletable={
                        campaign.status === 'ACTIVE' &&
                        (campaign.role === 'OWNER' || section.authorUserId === currentUserId)
                      }
                      editable={
                        campaign.status === 'ACTIVE' &&
                        campaign.capabilities.contributeSessionNotes &&
                        section.authorUserId === currentUserId
                      }
                      isGm={campaign.role === 'OWNER'}
                      section={section}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : sessionId && sessionNotes.status !== 'LoadingFirstPage' ? (
            <Text c='dimmed' mt='sm' size='sm'>
              No notes for this session yet.
            </Text>
          ) : null}
          {sessionNotes.status === 'CanLoadMore' ? (
            <Button variant='subtle' onClick={() => sessionNotes.loadMore(8)}>
              Load more sections
            </Button>
          ) : null}
          {sessionId &&
          campaign.status === 'ACTIVE' &&
          campaign.capabilities.contributeSessionNotes ? (
            <SessionSectionCreator campaignId={campaign.id} sessionId={sessionId} />
          ) : null}
        </section>
      )}
    </Stack>
  )
}

function formatSessionDate(value: string, timeZone: string | null) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(value))
}

function SessionSectionCreator({
  campaignId,
  sessionId
}: {
  campaignId: string
  sessionId: string
}) {
  const convex = useConvex()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] =
    useState<CampaignSessionNoteSectionDto['visibility']>('PRIVATE')
  const create = useMutation({
    mutationFn: () =>
      convex.mutation(convexApi.campaigns.sessionNotes.create, {
        campaignId,
        sessionId,
        title,
        content,
        visibility,
        kind: 'NOTE'
      }),
    onSuccess: () => {
      setTitle('')
      setContent('')
    }
  })

  return (
    <form
      className={sharedStyles.form}
      onSubmit={(event: SubmitEvent) => {
        event.preventDefault()
        create.mutate()
      }}
    >
      <Text fw={700}>Add a session section</Text>
      <TextInput
        classNames={{ input: sharedStyles.input }}
        label='Section title'
        required
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      <CampaignNoteVisibilitySelect value={visibility} onChange={setVisibility} />
      <RichTextEditor
        label='Session notes'
        name={`session-note-${sessionId}`}
        value={content}
        onChange={setContent}
        maximumLength={100_000}
      />
      <Button loading={create.isPending} type='submit'>
        Add section
      </Button>
    </form>
  )
}
