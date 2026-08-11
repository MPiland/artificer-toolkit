import { Alert, Button, Group, Text, TextInput, Title } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type SubmitEvent, useState } from 'react'
import type {
  CampaignContentMaturityDto,
  CampaignFormatDto,
  CampaignToneTagDto
} from '@artificer-toolkit/schema/api/campaigns'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import RichTextEditor from '#app/ui/primitives/RichTextEditor/RichTextEditor'
import { CampaignMetadataFields } from './components/CampaignMetadataFields'
import * as sharedStyles from './campaigns.css'

export function CampaignCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<CampaignFormatDto>('ONGOING')
  const [toneTags, setToneTags] = useState<CampaignToneTagDto[]>(['HEROIC'])
  const [toneDetails, setToneDetails] = useState('')
  const [contentMaturity, setContentMaturity] = useState<CampaignContentMaturityDto>('STANDARD')
  const createCampaign = useMutation({
    mutationFn: () =>
      api.campaigns.create({
        name,
        description: description.trim() || null,
        format,
        toneTags,
        toneDetails: toneDetails.trim() || null,
        contentMaturity
      }),
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() })
      await navigate({
        to: '/campaigns/$campaignPublicId/$campaignSlug',
        params: buildCampaignRouteParams(campaign.publicId, campaign.name)
      })
    }
  })

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    createCampaign.mutate()
  }

  return (
    <main className={`${sharedStyles.page} ${sharedStyles.createPage}`}>
      <header className={sharedStyles.createHeader}>
        <Title order={1}>Create a Campaign</Title>
        <Text c='dimmed'>Open a table and invite players when you are ready.</Text>
      </header>
      <form className={sharedStyles.createForm} onSubmit={handleSubmit}>
        {createCampaign.error ? (
          <Alert color='red' title='Campaign not created'>
            {createCampaign.error.message}
          </Alert>
        ) : null}
        <TextInput
          classNames={{ input: sharedStyles.input }}
          label='Campaign name'
          maxLength={100}
          onChange={(event) => setName(event.currentTarget.value)}
          required
          value={name}
        />
        <RichTextEditor
          label='Description'
          maximumLength={20000}
          name='campaign-description'
          onChange={setDescription}
          placeholder='Set the scene, tone, and premise for your table.'
          value={description}
        />
        <CampaignMetadataFields
          contentMaturity={contentMaturity}
          format={format}
          toneDetails={toneDetails}
          toneTags={toneTags}
          onContentMaturityChange={setContentMaturity}
          onFormatChange={setFormat}
          onToneDetailsChange={setToneDetails}
          onToneTagsChange={setToneTags}
        />
        <Group className={sharedStyles.createActions}>
          <Button loading={createCampaign.isPending} type='submit'>
            Create Campaign
          </Button>
          <Button component={Link} to='/campaigns' variant='default'>
            Cancel
          </Button>
        </Group>
      </form>
    </main>
  )
}
