import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type SubmitEvent, useEffect, useRef, useState } from 'react'
import type { CampaignDetailDto, CampaignSessionNoteSectionDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignSessionNotes, getCampaignSessions } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import * as sharedStyles from '../campaigns.css'
import * as notesStyles from './notes.css'

export function CampaignSessionNotes({
  campaign,
  currentUserId,
  embedded = false
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  embedded?: boolean
}) {
  const sessions = useQuery(getCampaignSessions(campaign.id))
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sessionId = selectedSessionId ?? sessions.data?.[0]?.id ?? null

  return (
    <section
      className={embedded ? notesStyles.notesSection : sharedStyles.panel}
      aria-labelledby='campaign-session-notes-title'
    >
      <div>
        <Title order={2} id='campaign-session-notes-title'>
          Session notes
        </Title>
        <Text c='dimmed' size='sm'>
          Shared sections autosave after about one second.
        </Text>
      </div>
      <Select
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
        classNames={{ input: sharedStyles.input }}
        label='Session'
        placeholder='No sessions yet'
        value={sessionId}
        onChange={setSelectedSessionId}
      />
      {sessionId ? (
        <CampaignSharedSessionNotes
          campaign={campaign}
          currentUserId={currentUserId}
          sessionId={sessionId}
        />
      ) : null}
    </section>
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

export function CampaignSharedSessionNotes({
  campaign,
  currentUserId,
  sessionId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  sessionId: string
}) {
  const queryClient = useQueryClient()
  const notes = useQuery(getCampaignSessionNotes(campaign.id, sessionId))
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.campaigns.sessions.notes.create({
        campaignId: campaign.id,
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
        queryKey: queryKeys.campaigns.sessionNotes(campaign.id, sessionId)
      })
    }
  })

  return (
    <Stack gap='md'>
      {notes.data?.map((section) => (
        <SessionSectionEditor
          campaignId={campaign.id}
          deletable={campaign.role === 'OWNER' || section.authorUserId === currentUserId}
          editable={campaign.status === 'ACTIVE'}
          key={section.id}
          section={section}
        />
      ))}
      {campaign.status === 'ACTIVE' ? (
        <form
          className={sharedStyles.form}
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <Title order={3}>Add your section</Title>
          <TextInput
            label='Section title'
            classNames={{ input: sharedStyles.input }}
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
      ) : null}
    </Stack>
  )
}

export function SessionSectionEditor({
  campaignId,
  contentLabel = 'Session notes',
  deletable,
  editable,
  section
}: {
  campaignId: string
  contentLabel?: string
  deletable: boolean
  editable: boolean
  section: CampaignSessionNoteSectionDto
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content)
  const saved = useRef(section)
  const save = useMutation({
    mutationFn: () =>
      api.campaigns.sessions.notes.update({
        campaignId,
        sessionId: section.sessionId,
        sectionId: section.id,
        expectedVersion: saved.current.version,
        title,
        content
      }),
    onSuccess: (updated) => {
      saved.current = updated
      return queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionNotes(campaignId, section.sessionId)
      })
    }
  })
  const remove = useMutation({
    mutationFn: () =>
      api.campaigns.sessions.notes.delete(campaignId, section.sessionId, section.id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionNotes(campaignId, section.sessionId)
      })
  })

  useEffect(() => {
    if (section.version <= saved.current.version) return
    const dirty = title !== saved.current.title || content !== saved.current.content
    if (dirty) return
    saved.current = section
    setTitle(section.title)
    setContent(section.content)
  }, [content, section, title])

  useEffect(() => {
    const dirty = title !== saved.current.title || content !== saved.current.content
    if (!editable || !dirty || save.isPending) return
    const timeout = window.setTimeout(() => save.mutate(), 1_000)
    return () => window.clearTimeout(timeout)
  }, [content, editable, save.isPending, title])

  return (
    <Stack gap='xs'>
      {save.error ? (
        <Alert color='orange' title='Save conflict or failure'>
          {save.error.message} Your local text was not overwritten.
        </Alert>
      ) : null}
      <TextInput
        classNames={{ input: sharedStyles.input }}
        disabled={!editable}
        label='Section title'
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      <RichTextEditor
        readOnly={!editable}
        label={contentLabel}
        name={`session-note-section-${section.id}`}
        value={content}
        onChange={setContent}
        maximumLength={100_000}
      />
      {editable ? (
        <Group>
          {deletable ? (
            <Button color='red' variant='subtle' onClick={() => remove.mutate()}>
              Delete
            </Button>
          ) : null}
          <Text aria-live='polite' c='dimmed' size='sm'>
            {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved.' : 'Changes save automatically.'}
          </Text>
        </Group>
      ) : null}
    </Stack>
  )
}
