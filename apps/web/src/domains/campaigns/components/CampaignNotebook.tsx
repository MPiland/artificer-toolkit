import { Alert, Button, Group, Loader, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { type SubmitEvent, useEffect, useRef, useState } from 'react'
import type { CampaignNotebookSectionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import { renderSanitizedRichHtml } from '#app/lib/richText'
import * as sharedStyles from '../campaigns.css'
import * as notesStyles from './notes.css'

export function CampaignNotebook({
  campaign,
  embedded = false,
  sectionTitle = 'Campaign notes',
  visibilityFilter,
  categoryFilter
}: {
  campaign: CampaignDetailDto
  embedded?: boolean
  sectionTitle?: string
  visibilityFilter?: 'GM_PRIVATE' | 'SHARED'
  categoryFilter?: CampaignNotebookSectionDto['category']
}) {
  const notebook = usePaginatedQuery(
    convexApi.campaigns.notebooks.list,
    { campaignId: campaign.id },
    { initialNumItems: 8 }
  )
  const createNotebookSection = useConvexMutation(convexApi.campaigns.notebooks.create)
  const [newTitle, setNewTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'GM_PRIVATE' | 'SHARED'>(
    visibilityFilter ?? 'GM_PRIVATE'
  )
  const create = useMutation({
    mutationFn: () =>
      createNotebookSection({
        campaignId: campaign.id,
        title: newTitle,
        content,
        visibility,
        category: categoryFilter ?? 'GENERAL'
      }),
    onSuccess: () => {
      setNewTitle('')
      setContent('')
    }
  })

  const visibleSections = notebook.results.filter(
    (section) =>
      (visibilityFilter === undefined || section.visibility === visibilityFilter) &&
      (categoryFilter === undefined || section.category === categoryFilter)
  )
  const canCreate = campaign.status === 'ACTIVE' && campaign.role === 'OWNER'

  return (
    <section
      className={embedded ? notesStyles.notesSection : sharedStyles.panel}
      aria-labelledby='campaign-notebook-title'
    >
      <div>
        <Title order={2} id='campaign-notebook-title'>
          {sectionTitle}
        </Title>
        <Text c='dimmed' size='sm'>
          {campaign.role === 'OWNER'
            ? 'Write Campaign lore for the party to reference during play.'
            : 'Campaign lore maintained by the GM.'}
        </Text>
      </div>
      {notebook.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading Campaign notes' size='sm' />
      ) : null}
      {visibleSections.map((section) => (
        <NotebookEditor
          campaignId={campaign.id}
          editable={campaign.status === 'ACTIVE' && campaign.role === 'OWNER'}
          key={section.id}
          canChangeVisibility={campaign.role === 'OWNER'}
          section={section}
        />
      ))}
      {notebook.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => notebook.loadMore(8)}>
          Load more notes
        </Button>
      ) : null}
      {notebook.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more Campaign notes' size='sm' />
      ) : null}
      {notebook.status === 'Exhausted' && visibleSections.length === 0 ? (
        <Text c='dimmed'>No sections yet.</Text>
      ) : null}
      {canCreate ? (
        <form
          className={sharedStyles.form}
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <Title order={3}>New section</Title>
          {create.error ? <Alert color='red'>{create.error.message}</Alert> : null}
          <TextInput
            label='Section title'
            classNames={{ input: sharedStyles.input }}
            required
            value={newTitle}
            onChange={(event) => setNewTitle(event.currentTarget.value)}
          />
          {campaign.role === 'OWNER' ? (
            <Select
              data={[
                { label: 'GM private', value: 'GM_PRIVATE' },
                { label: 'Shared with party', value: 'SHARED' }
              ]}
              classNames={{ input: sharedStyles.input }}
              label='Visibility'
              value={visibility}
              onChange={(value) => setVisibility((value as typeof visibility) ?? 'GM_PRIVATE')}
            />
          ) : null}
          <RichTextEditor
            label='Notes'
            name='campaign-note-content'
            value={content}
            onChange={setContent}
            maximumLength={100_000}
          />
          <Button loading={create.isPending} type='submit'>
            Create section
          </Button>
        </form>
      ) : null}
    </section>
  )
}

function NotebookEditor({
  campaignId,
  editable,
  canChangeVisibility,
  section
}: {
  campaignId: string
  editable: boolean
  canChangeVisibility: boolean
  section: CampaignNotebookSectionDto
}) {
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content)
  const [visibility, setVisibility] = useState(section.visibility)
  const saved = useRef(section)
  const updateNotebookSection = useConvexMutation(convexApi.campaigns.notebooks.update)
  const removeNotebookSection = useConvexMutation(convexApi.campaigns.notebooks.remove)
  const save = useMutation({
    mutationFn: () =>
      updateNotebookSection({
        campaignId,
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
    mutationFn: () => removeNotebookSection({ campaignId, sectionId: section.id })
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

  if (!editable) {
    return (
      <Stack gap='xs'>
        <Title order={3}>{section.title}</Title>
        <Text c='dimmed' size='xs'>
          Shared with party
        </Text>
        <div>{renderSanitizedRichHtml(section.content)}</div>
      </Stack>
    )
  }

  return (
    <Stack gap='xs'>
      {save.error ? (
        <Alert color='orange' title='Save conflict or failure'>
          {save.error.message} Your local text was not overwritten.
        </Alert>
      ) : null}
      {remove.error ? <Alert color='red'>{remove.error.message}</Alert> : null}
      <TextInput
        disabled={!editable}
        classNames={{ input: sharedStyles.input }}
        label='Section title'
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      {canChangeVisibility ? (
        <Select
          data={[
            { label: 'GM private', value: 'GM_PRIVATE' },
            { label: 'Shared with party', value: 'SHARED' }
          ]}
          classNames={{ input: sharedStyles.input }}
          label='Visibility'
          value={visibility}
          onChange={(value) => setVisibility((value as typeof visibility) ?? visibility)}
        />
      ) : (
        <Text c='dimmed' size='xs'>
          Shared with party
        </Text>
      )}
      <RichTextEditor
        readOnly={!editable}
        label='Notes'
        name={`campaign-note-${section.id}`}
        value={content}
        onChange={setContent}
        maximumLength={100_000}
      />
      {editable ? (
        <Group>
          <Button
            color='red'
            disabled={remove.isPending}
            variant='subtle'
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
          <Text aria-live='polite' c='dimmed' size='sm'>
            {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved.' : 'Changes save automatically.'}
          </Text>
        </Group>
      ) : null}
    </Stack>
  )
}
