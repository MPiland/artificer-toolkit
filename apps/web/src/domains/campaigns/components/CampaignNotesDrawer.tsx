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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenText } from 'lucide-react'
import { type SubmitEvent, useState } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import {
  getCampaignDetail,
  getCampaignNotebook,
  getCampaignSessionNotes,
  getCampaignSessions
} from '#app/data/campaigns/queries'
import { useCampaignRealtime } from '#app/data/campaigns/useCampaignRealtime'
import { queryKeys } from '#app/lib/queryKeys'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import { renderSanitizedRichHtml } from '#app/lib/richText'
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
  useCampaignRealtime(campaign, currentUserId)
  const notebook = useQuery(getCampaignNotebook(campaign.id))
  const sessions = useQuery(getCampaignSessions(campaign.id))
  const [view, setView] = useState<'campaign' | 'sessions'>('campaign')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sessionId = selectedSessionId ?? sessions.data?.[0]?.id ?? null
  const sessionNotes = useQuery({
    ...getCampaignSessionNotes(campaign.id, sessionId ?? campaign.id),
    enabled: view === 'sessions' && Boolean(sessionId)
  })
  const sharedSections = notebook.data?.filter((section) => section.visibility === 'SHARED') ?? []

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
        onChange={(value) => setView(value as typeof view)}
      />

      {view === 'campaign' ? (
        <section>
          <Group justify='space-between' mb='sm'>
            <Text fw={700}>Campaign notes</Text>
            <Badge variant='light'>GM maintained</Badge>
          </Group>
          {notebook.error ? <Alert color='red'>{notebook.error.message}</Alert> : null}
          <Accordion multiple variant='separated'>
            {(['GENERAL', 'PEOPLE', 'PLACES'] as const).map((category) => {
              const sections = sharedSections.filter((section) => section.category === category)
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
                              <div>{renderSanitizedRichHtml(section.content)}</div>
                            </Accordion.Panel>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    ) : (
                      <Text c='dimmed' size='sm'>
                        No {label.toLowerCase()} notes yet.
                      </Text>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              )
            })}
          </Accordion>
        </section>
      ) : (
        <section>
          <Group justify='space-between' mb='sm'>
            <Text fw={700}>Session notes</Text>
            <Badge variant='light'>Collaborative</Badge>
          </Group>
          <Select
            classNames={{ input: sharedStyles.input }}
            data={(sessions.data ?? []).map((session) => ({
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
          {sessionNotes.error ? <Alert color='red'>{sessionNotes.error.message}</Alert> : null}
          {sessionId && sessionNotes.data?.length ? (
            <Accordion multiple mt='md' variant='separated'>
              {sessionNotes.data.map((section) => (
                <Accordion.Item key={section.id} value={`session:${section.id}`}>
                  <Accordion.Control>{section.title}</Accordion.Control>
                  <Accordion.Panel>
                    <SessionSectionEditor
                      campaignId={campaign.id}
                      deletable={
                        campaign.role === 'OWNER' || section.authorUserId === currentUserId
                      }
                      editable={
                        campaign.status === 'ACTIVE' && campaign.capabilities.contributeSessionNotes
                      }
                      section={section}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : sessionId && !sessionNotes.isPending ? (
            <Text c='dimmed' mt='sm' size='sm'>
              No notes for this session yet.
            </Text>
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
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.campaigns.sessions.notes.create({
        campaignId,
        sessionId,
        title,
        content,
        visibility: 'SHARED',
        kind: 'SHARED_NOTE'
      }),
    onSuccess: async () => {
      setTitle('')
      setContent('')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionNotes(campaignId, sessionId)
      })
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
