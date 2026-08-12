import { Alert, Button, Select, Stack, Textarea, TextInput, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getCampaignConversations } from '#app/data/campaigns/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './CampaignAnnouncements.css'

export function CampaignAnnouncementComposer({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient()
  const conversations = useQuery(getCampaignConversations(campaignId))
  const partyId = conversations.data?.find((conversation) => conversation.kind === 'PARTY')?.id
  const [scope, setScope] = useState<'TABLE' | 'PARTY'>('TABLE')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const publish = useMutation({
    mutationFn: (commandId: string) =>
      api.campaigns.announcements.create({
        campaignId,
        commandId,
        scope,
        partyId: scope === 'PARTY' ? (partyId ?? null) : null,
        title: title.trim(),
        body: body.trim()
      }),
    onSuccess: async () => {
      setTitle('')
      setBody('')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.announcements(campaignId)
      })
    }
  })

  return (
    <section className={styles.panel} aria-labelledby='announcement-composer-title'>
      <Title id='announcement-composer-title' order={2}>
        Publish announcement
      </Title>
      <Stack gap='sm'>
        <Select
          data={[
            { label: 'Everyone at the table', value: 'TABLE' },
            { label: 'Players only', value: 'PARTY', disabled: !partyId }
          ]}
          label='Audience'
          value={scope}
          onChange={(value) => setScope(value === 'PARTY' ? 'PARTY' : 'TABLE')}
        />
        <TextInput
          label='Title'
          maxLength={120}
          required
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <Textarea
          autosize
          label='Message'
          maxLength={10_000}
          minRows={4}
          required
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
        />
      </Stack>
      {publish.error ? <Alert color='red'>The announcement couldn’t be published.</Alert> : null}
      <Button
        disabled={!title.trim() || !body.trim() || (scope === 'PARTY' && !partyId)}
        loading={publish.isPending}
        onClick={() => publish.mutate(crypto.randomUUID())}
      >
        Publish
      </Button>
    </section>
  )
}
