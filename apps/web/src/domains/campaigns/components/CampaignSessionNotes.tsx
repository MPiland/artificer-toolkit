import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { type SubmitEvent, useEffect, useRef, useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionNoteSectionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { useConvex, usePaginatedQuery } from 'convex/react'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import { CampaignNoteByline, CampaignNoteVisibilitySelect } from './CampaignNoteVisibility'
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
  const sessions = usePaginatedQuery(
    convexApi.campaigns.sessions.list,
    { campaignId: campaign.id },
    { initialNumItems: 8 }
  )
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sessionId = selectedSessionId ?? sessions.results[0]?.id ?? null

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
          Notes start private. Share one to put it in front of the whole party. Notes autosave after
          about one second.
        </Text>
      </div>
      <Select
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
        classNames={{ input: sharedStyles.input }}
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
  const convex = useConvex()
  const notes = usePaginatedQuery(
    convexApi.campaigns.sessionNotes.list,
    { campaignId: campaign.id, sessionId },
    { initialNumItems: 8 }
  )
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] =
    useState<CampaignSessionNoteSectionDto['visibility']>('PRIVATE')
  const create = useMutation({
    mutationFn: () =>
      convex.mutation(convexApi.campaigns.sessionNotes.create, {
        campaignId: campaign.id,
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
    <Stack gap='md'>
      {notes.results
        .filter((section) => section.kind === 'NOTE')
        .map((section) => (
          <SessionSectionEditor
            campaignId={campaign.id}
            deletable={
              campaign.status === 'ACTIVE' &&
              (campaign.role === 'OWNER' || section.authorUserId === currentUserId)
            }
            editable={campaign.status === 'ACTIVE' && section.authorUserId === currentUserId}
            isGm={campaign.role === 'OWNER'}
            key={section.id}
            section={section}
          />
        ))}
      {notes.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => notes.loadMore(8)}>
          Load more sections
        </Button>
      ) : null}
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
      ) : null}
    </Stack>
  )
}

export function SessionSectionEditor({
  campaignId,
  contentLabel = 'Session notes',
  deletable,
  editable,
  isGm,
  section
}: {
  campaignId: string
  contentLabel?: string
  deletable: boolean
  editable: boolean
  isGm: boolean
  section: CampaignSessionNoteSectionDto
}) {
  const convex = useConvex()
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content)
  const [visibility, setVisibility] = useState(section.visibility)
  const saved = useRef(section)
  const save = useMutation({
    mutationFn: () =>
      convex.mutation(convexApi.campaigns.sessionNotes.update, {
        campaignId,
        sessionId: section.sessionId,
        sectionId: section.id,
        expectedVersion: saved.current.version,
        title,
        content,
        visibility
      }),
    onSuccess: (updated) => {
      saved.current = updated
    }
  })
  const remove = useMutation({
    mutationFn: () =>
      convex.mutation(convexApi.campaigns.sessionNotes.remove, {
        campaignId,
        sessionId: section.sessionId,
        sectionId: section.id
      })
  })

  useEffect(() => {
    if (section.version <= saved.current.version) return
    const dirty =
      title !== saved.current.title ||
      content !== saved.current.content ||
      visibility !== saved.current.visibility
    if (dirty) return
    saved.current = section
    setTitle(section.title)
    setContent(section.content)
    setVisibility(section.visibility)
  }, [content, section, title, visibility])

  useEffect(() => {
    const dirty =
      title !== saved.current.title ||
      content !== saved.current.content ||
      visibility !== saved.current.visibility
    if (!editable || !dirty || save.isPending) return
    const timeout = window.setTimeout(() => save.mutate(), 1_000)
    return () => window.clearTimeout(timeout)
  }, [content, editable, save.isPending, title, visibility])

  return (
    <Stack gap='xs'>
      {save.error ? (
        <Alert color='orange' title='Save conflict or failure'>
          {save.error.message} Your local text was not overwritten.
        </Alert>
      ) : null}
      {section.kind === 'NOTE' && !editable ? (
        <CampaignNoteByline
          authorLabel={section.authorLabel}
          showAuthor={section.visibility === 'SHARED' || isGm}
          visibility={section.visibility}
        />
      ) : null}
      <TextInput
        classNames={{ input: sharedStyles.input }}
        disabled={!editable}
        label='Section title'
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      {editable && section.kind === 'NOTE' ? (
        <CampaignNoteVisibilitySelect value={visibility} onChange={setVisibility} />
      ) : null}
      <RichTextEditor
        readOnly={!editable}
        label={contentLabel}
        name={`session-note-section-${section.id}`}
        value={content}
        onChange={setContent}
        maximumLength={100_000}
      />
      {deletable || editable ? (
        <Group>
          {deletable ? (
            <Button color='red' variant='subtle' onClick={() => remove.mutate()}>
              Delete
            </Button>
          ) : null}
          {editable ? (
            <Text aria-live='polite' c='dimmed' size='sm'>
              {save.isPending
                ? 'Saving…'
                : save.isSuccess
                  ? 'Saved.'
                  : 'Changes save automatically.'}
            </Text>
          ) : null}
        </Group>
      ) : null}
    </Stack>
  )
}
