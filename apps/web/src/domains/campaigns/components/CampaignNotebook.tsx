import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type SubmitEvent, useEffect, useRef, useState } from 'react'
import type { CampaignDetailDto, CampaignNotebookSectionDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignNotebook } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import { renderSanitizedRichHtml } from '#app/ui/primitives/renderSanitizedRichHtml'
import * as styles from '../campaigns.css'

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
  const queryClient = useQueryClient()
  const notebook = useQuery(getCampaignNotebook(campaign.id))
  const [newTitle, setNewTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'GM_PRIVATE' | 'SHARED'>(
    visibilityFilter ?? 'GM_PRIVATE'
  )
  const create = useMutation({
    mutationFn: () =>
      api.campaigns.notebook.create({
        campaignId: campaign.id,
        title: newTitle,
        content,
        visibility,
        category: categoryFilter ?? 'GENERAL'
      }),
    onSuccess: async () => {
      setNewTitle('')
      setContent('')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.notebook(campaign.id)
      })
    }
  })

  const visibleSections = notebook.data?.filter(
    (section) =>
      (visibilityFilter === undefined || section.visibility === visibilityFilter) &&
      (categoryFilter === undefined || section.category === categoryFilter)
  )
  const canCreate = campaign.status === 'ACTIVE' && campaign.role === 'OWNER'

  return (
    <section
      className={embedded ? styles.notesSection : styles.panel}
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
      {notebook.error ? <Alert color='red'>{notebook.error.message}</Alert> : null}
      {visibleSections?.length === 0 ? <Text c='dimmed'>No sections yet.</Text> : null}
      {visibleSections?.map((section) => (
        <NotebookEditor
          campaignId={campaign.id}
          editable={campaign.status === 'ACTIVE' && campaign.role === 'OWNER'}
          key={section.id}
          canChangeVisibility={campaign.role === 'OWNER'}
          section={section}
        />
      ))}
      {canCreate ? (
        <form
          className={styles.form}
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <Title order={3}>New section</Title>
          <TextInput
            label='Section title'
            classNames={{ input: styles.input }}
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
              classNames={{ input: styles.input }}
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
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content)
  const [visibility, setVisibility] = useState(section.visibility)
  const saved = useRef(section)
  const save = useMutation({
    mutationFn: () =>
      api.campaigns.notebook.update({
        campaignId,
        sectionId: section.id,
        expectedVersion: saved.current.version,
        title,
        content,
        visibility
      }),
    onSuccess: (updated) => {
      saved.current = updated
      return queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.notebook(campaignId)
      })
    }
  })
  const remove = useMutation({
    mutationFn: () => api.campaigns.notebook.delete(campaignId, section.id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.notebook(campaignId)
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
      <TextInput
        disabled={!editable}
        classNames={{ input: styles.input }}
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
          classNames={{ input: styles.input }}
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
          <Button color='red' variant='subtle' onClick={() => remove.mutate()}>
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
