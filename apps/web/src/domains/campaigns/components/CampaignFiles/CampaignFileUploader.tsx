import { Alert, Button, FileInput, Select, Stack, TextInput, Textarea, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CampaignFileProfile } from '@artificer-toolkit/schema/api/media'
import { api } from '#app/lib/api'
import { getCampaignNotebook, getCampaignSessions } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { getSupabaseBrowserClient } from '#supabase/client'
import { campaignFileAccept, validateCampaignFile } from './campaignFiles.model'
import * as styles from './CampaignFiles.css'

export function CampaignFileUploader({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient()
  const sessions = useQuery(getCampaignSessions(campaignId))
  const notebook = useQuery(getCampaignNotebook(campaignId))
  const [file, setFile] = useState<File | null>(null)
  const [profile, setProfile] = useState<CampaignFileProfile>('CAMPAIGN_FILE')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [noteSectionId, setNoteSectionId] = useState<string | null>(null)
  const fileError = file ? validateCampaignFile(file, profile === 'CAMPAIGN_HANDOUT_MAP') : null

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || fileError) throw new Error(fileError ?? 'Choose a file.')
      const target = { type: profile, campaignId } as const
      const intent = await api.media.createCampaignFileUpload({
        profile,
        target,
        originalFileName: file.name,
        declaredMimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'text/plain',
        declaredBytes: file.size,
        idempotencyKey: crypto.randomUUID()
      })
      const { error } = await getSupabaseBrowserClient()
        .storage.from(intent.bucket)
        .uploadToSignedUrl(intent.objectKey, intent.token, file)
      if (error) throw new Error('Upload did not finish. Try again.')
      const finalized = await api.media.finalizeCampaignFileUpload({
        assetId: intent.assetId
      })
      if (finalized.status !== 'READY')
        throw new Error(
          finalized.status === 'REJECTED'
            ? 'That file was rejected.'
            : 'File processing is still running.'
        )
      return api.campaigns.attachments.create({
        campaignId,
        assetId: intent.assetId,
        displayName: displayName.trim() || file.name,
        description: description.trim() || null,
        sessionId,
        noteSectionId
      })
    },
    onSuccess: async () => {
      setFile(null)
      setDisplayName('')
      setDescription('')
      setSessionId(null)
      setNoteSectionId(null)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.attachments(campaignId)
      })
    }
  })

  return (
    <section className={styles.panel} aria-labelledby='campaign-file-upload-title'>
      <Title id='campaign-file-upload-title' order={2}>
        Add file
      </Title>
      <div className={styles.formGrid}>
        <FileInput
          accept={campaignFileAccept}
          clearable
          label='File'
          value={file}
          onChange={(next) => {
            setFile(next)
            if (next && !displayName) setDisplayName(next.name)
          }}
        />
        <Select
          label='Profile'
          data={[
            { value: 'CAMPAIGN_FILE', label: 'Campaign file' },
            { value: 'CAMPAIGN_HANDOUT_MAP', label: 'Handout map' }
          ]}
          value={profile}
          onChange={(value) => {
            if (value === 'CAMPAIGN_FILE' || value === 'CAMPAIGN_HANDOUT_MAP') setProfile(value)
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
          data={(sessions.data ?? []).map((session) => ({
            value: session.id,
            label: session.title ?? `Session ${session.sessionNumber}`
          }))}
          value={sessionId}
          onChange={setSessionId}
        />
        <Select
          clearable
          label='Campaign note (optional)'
          data={(notebook.data ?? []).map((note) => ({
            value: note.id,
            label: note.title
          }))}
          value={noteSectionId}
          onChange={setNoteSectionId}
        />
      </div>
      <Textarea
        autosize
        label='Description (optional)'
        maxLength={1000}
        minRows={2}
        value={description}
        onChange={(event) => setDescription(event.currentTarget.value)}
      />
      {fileError ? <Alert color='orange'>{fileError}</Alert> : null}
      {upload.error ? <Alert color='red'>{upload.error.message}</Alert> : null}
      <Stack align='flex-start'>
        <Button
          disabled={!file || Boolean(fileError)}
          loading={upload.isPending}
          onClick={() => upload.mutate()}
        >
          Upload file
        </Button>
      </Stack>
    </section>
  )
}
