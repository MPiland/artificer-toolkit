import { Alert, Button, Select, Stack, Textarea, TextInput, Title } from '@mantine/core'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useMutation as useConvexMutation } from 'convex/react'
import * as styles from './CampaignAnnouncements.css'

export function CampaignAnnouncementComposer({ campaignId }: { campaignId: string }) {
  const createAnnouncement = useConvexMutation(convexApi.campaigns.announcements.create)
  const [scope, setScope] = useState<'TABLE' | 'PARTY'>('TABLE')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const publish = useMutation({
    mutationFn: (commandId: string) =>
      createAnnouncement({
        campaignId,
        commandId,
        scope,
        partyId: null,
        title: title.trim(),
        body: body.trim()
      }),
    onSuccess: () => {
      setTitle('')
      setBody('')
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
            { label: 'Players only', value: 'PARTY' }
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
        disabled={!title.trim() || !body.trim()}
        loading={publish.isPending}
        onClick={() => publish.mutate(crypto.randomUUID())}
      >
        Publish
      </Button>
    </section>
  )
}
