import { Accordion, Alert, Button, Group, Menu, Stack, Text } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { useConvex, usePaginatedQuery } from 'convex/react'
import { SessionSectionEditor } from './CampaignSessionNotes'
import {
  campaignSessionSectionDescription,
  campaignSessionSectionLabel,
  type CampaignSessionSectionKind
} from './campaignSessionSections.model'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionSectionGroup({
  campaign,
  sessionId,
  kinds,
  readOnly = false
}: {
  campaign: CampaignDetailDto
  sessionId: string
  kinds: readonly CampaignSessionSectionKind[]
  readOnly?: boolean
}) {
  const convex = useConvex()
  const notes = usePaginatedQuery(
    convexApi.campaigns.sessionNotes.list,
    { campaignId: campaign.id, sessionId },
    { initialNumItems: 8 }
  )
  const create = useMutation({
    mutationFn: (kind: CampaignSessionSectionKind) =>
      convex.mutation(convexApi.campaigns.sessionNotes.create, {
        campaignId: campaign.id,
        sessionId,
        title: campaignSessionSectionLabel(kind),
        content: '',
        kind
      })
  })
  const editable = campaign.status === 'ACTIVE' && !readOnly

  if (notes.status === 'LoadingFirstPage') return <Text c='dimmed'>Loading Session sections…</Text>

  const sectionsByKind = kinds.map((kind) => ({
    kind,
    sections: notes.results.filter((section) => section.kind === kind)
  }))
  const populatedKinds = sectionsByKind.filter(({ sections }) => sections.length > 0)

  return (
    <Stack className={sessionsStyles.sessionSectionCollection} gap={0}>
      {populatedKinds.map(({ kind, sections }) => {
        const label = campaignSessionSectionLabel(kind)
        return (
          <section className={sessionsStyles.sessionSectionKind} key={kind}>
            <div>
              <Text fw={700}>{label}</Text>
              <Text c='dimmed' size='sm'>
                {campaignSessionSectionDescription(kind)}
              </Text>
            </div>
            <Accordion
              className={sessionsStyles.sessionSectionAccordion}
              multiple
              variant='contained'
            >
              {sections.map((section) => (
                <Accordion.Item key={section.id} value={section.id}>
                  <Accordion.Control>{section.title}</Accordion.Control>
                  <Accordion.Panel>
                    <SessionSectionEditor
                      campaignId={campaign.id}
                      contentLabel='Details'
                      deletable={editable}
                      editable={editable}
                      isGm
                      section={section}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </section>
        )
      })}
      <Group className={sessionsStyles.sessionSectionAdder} justify='space-between' wrap='wrap'>
        <Text c='dimmed' size='sm'>
          {populatedKinds.length
            ? 'Add another planning section when it is useful.'
            : 'No sections added.'}
        </Text>
        {editable ? (
          <Menu position='bottom-end' withinPortal>
            <Menu.Target>
              <Button loading={create.isPending} variant='default'>
                Add section
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {kinds.map((kind) => (
                <Menu.Item key={kind} onClick={() => create.mutate(kind)}>
                  {campaignSessionSectionLabel(kind)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </Group>
      {create.error ? <Alert color='red'>That section couldn’t be created.</Alert> : null}
      {notes.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => notes.loadMore(8)}>
          Load more sections
        </Button>
      ) : null}
    </Stack>
  )
}
