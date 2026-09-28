import { Alert, Button, FileInput, Select, Stack, TextInput, Textarea, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import type { CampaignFileProfile } from '@artificer-toolkit/schema/api/media'
import type { MediaLibraryItemDto } from '@artificer-toolkit/schema/api/mediaAssets'
import { useAction, useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { MediaLibraryPicker } from '#app/components/MediaImage/MediaLibraryPicker'
import { campaignFileAccept, validateCampaignFile } from './campaignFiles.model'
import * as styles from './CampaignFiles.css'

export function CampaignFileUploader({ campaignId }: { campaignId: string }) {
  const sessions = usePaginatedQuery(
    convexApi.campaigns.sessions.list,
    { campaignId },
    { initialNumItems: 8 }
  )
  const notebook = usePaginatedQuery(
    convexApi.campaigns.notebooks.list,
    { campaignId },
    { initialNumItems: 8 }
  )
  const createUpload = useConvexMutation(convexApi.media.fileAssets.createUpload)
  const finalize = useAction(convexApi.media.fileActions.finalize)
  const createAttachment = useConvexMutation(convexApi.campaigns.attachments.create)
  const [file, setFile] = useState<File | null>(null)
  const [picked, setPicked] = useState<MediaLibraryItemDto | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [profile, setProfile] = useState<CampaignFileProfile>('CAMPAIGN_FILE')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [noteSectionId, setNoteSectionId] = useState<string | null>(null)
  const fileError = file ? validateCampaignFile(file, profile === 'CAMPAIGN_HANDOUT_MAP') : null

  const upload = useMutation({
    mutationFn: async () => {
      const details = {
        campaignId,
        description: description.trim() || null,
        sessionId,
        noteSectionId
      }
      // A reused image is already processed and owned by the uploader; it only needs attaching.
      if (picked)
        return createAttachment({
          ...details,
          assetId: picked.assetId,
          displayName: displayName.trim() || picked.originalFileName
        })
      if (!file || fileError) throw new Error(fileError ?? 'Choose a file.')
      const target = { type: profile, campaignId } as const
      const intent = await createUpload({
        profile,
        target,
        originalFileName: file.name,
        declaredMimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'text/plain',
        declaredBytes: file.size,
        idempotencyKey: crypto.randomUUID()
      })
      const response = await fetch(intent.url, {
        method: intent.method,
        headers: { 'Content-Type': file.type },
        body: file
      })
      if (!response.ok) throw new Error('Upload did not finish. Try again.')
      const finalized = await finalize({ assetId: intent.assetId })
      if (finalized.status !== 'READY')
        throw new Error(
          finalized.status === 'REJECTED'
            ? 'That file was rejected.'
            : 'File processing is still running.'
        )
      // Finalizing an image the uploader already has resolves to that existing asset.
      return createAttachment({
        ...details,
        assetId: finalized.assetId,
        displayName: displayName.trim() || file.name
      })
    },
    onSuccess: () => {
      setFile(null)
      setPicked(null)
      setDisplayName('')
      setDescription('')
      setSessionId(null)
      setNoteSectionId(null)
    }
  })

  return (
    <section className={styles.panel} aria-labelledby='campaign-file-upload-title'>
      <Title id='campaign-file-upload-title' order={2}>
        Add file
      </Title>
      <div className={styles.formGrid}>
        <div>
          <FileInput
            accept={campaignFileAccept}
            clearable
            label='File'
            placeholder={picked ? `${picked.originalFileName} (from my images)` : undefined}
            value={file}
            onChange={(next) => {
              setFile(next)
              if (next) setPicked(null)
              if (next && !displayName) setDisplayName(next.name)
            }}
          />
          <Button
            aria-expanded={browsing}
            type='button'
            variant='subtle'
            onClick={() => setBrowsing((open) => !open)}
          >
            Choose from my images
          </Button>
        </div>
        <Select
          label='Profile'
          data={[
            { value: 'CAMPAIGN_FILE', label: 'Campaign file' },
            { value: 'CAMPAIGN_HANDOUT_MAP', label: 'Handout map' }
          ]}
          value={profile}
          onChange={(value) => {
            if (value !== 'CAMPAIGN_FILE' && value !== 'CAMPAIGN_HANDOUT_MAP') return
            setProfile(value)
            // Handout maps and Campaign images are separate kinds of saved image.
            setPicked(null)
          }}
        />
        <TextInput
          label='Display name'
          maxLength={160}
          value={displayName}
          onChange={(event) => setDisplayName(event.currentTarget.value)}
        />
        <Select
          clearable
          label='Session (optional)'
          data={sessions.results.map((session) => ({
            value: session.id,
            label: session.title ?? `Session ${session.sessionNumber}`
          }))}
          value={sessionId}
          onChange={setSessionId}
        />
        {sessions.status === 'CanLoadMore' ? (
          <Button type='button' variant='subtle' onClick={() => sessions.loadMore(8)}>
            Load more sessions
          </Button>
        ) : null}
        <div>
          <Select
            clearable
            searchable
            label='Campaign note (optional)'
            data={notebook.results.map((note) => ({
              value: note.id,
              label: note.title
            }))}
            placeholder={notebook.status === 'LoadingFirstPage' ? 'Loading notes…' : undefined}
            value={noteSectionId}
            onChange={setNoteSectionId}
          />
          {notebook.status === 'CanLoadMore' ? (
            <Button type='button' variant='subtle' onClick={() => notebook.loadMore(8)}>
              Load more notes
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea
        autosize
        label='Description (optional)'
        maxLength={1000}
        minRows={2}
        value={description}
        onChange={(event) => setDescription(event.currentTarget.value)}
      />
      {browsing ? (
        <MediaLibraryPicker
          profileClass={profile === 'CAMPAIGN_HANDOUT_MAP' ? 'HANDOUT_MAP' : 'CONTENT_ART'}
          selectedAssetId={picked?.assetId ?? null}
          onSelect={(item) => {
            setPicked(item)
            setFile(null)
            setBrowsing(false)
            if (!displayName) setDisplayName(item.originalFileName)
          }}
        />
      ) : null}
      {fileError ? <Alert color='orange'>{fileError}</Alert> : null}
      {upload.error ? <Alert color='red'>{upload.error.message}</Alert> : null}
      <Stack align='flex-start'>
        <Button
          disabled={picked ? false : !file || Boolean(fileError)}
          loading={upload.isPending}
          onClick={() => upload.mutate()}
        >
          {picked ? 'Add image' : 'Upload file'}
        </Button>
      </Stack>
    </section>
  )
}
