import { Accordion, Alert, Button, Group, Menu, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignSessionNotes } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { SessionSectionEditor } from './CampaignSessionNotes'
import {
  campaignSessionSectionDescription,
  campaignSessionSectionLabel,
  type CampaignSessionSectionKind
} from './campaignSessionSections.model'
import * as styles from '../campaigns.css'

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
  const queryClient = useQueryClient()
  const notes = useQuery(getCampaignSessionNotes(campaign.id, sessionId))
  const create = useMutation({
    mutationFn: (kind: CampaignSessionSectionKind) =>
      api.campaigns.sessions.notes.create({
        campaignId: campaign.id,
        sessionId,
        title: campaignSessionSectionLabel(kind),
        content: '',
        visibility: 'GM_PRIVATE',
        kind
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionNotes(campaign.id, sessionId)
      })
  })
  const editable = campaign.status === 'ACTIVE' && !readOnly

  if (notes.isPending) return <Text c='dimmed'>Loading Session sections…</Text>
  if (notes.error) return <Alert color='red'>Session sections couldn’t be loaded.</Alert>

  const sectionsByKind = kinds.map((kind) => ({
    kind,
    sections: (notes.data ?? []).filter((section) => section.kind === kind)
  }))
  const populatedKinds = sectionsByKind.filter(({ sections }) => sections.length > 0)

  return (
    <Stack className={styles.sessionSectionCollection} gap={0}>
      {populatedKinds.map(({ kind, sections }) => {
        const label = campaignSessionSectionLabel(kind)
        return (
          <section className={styles.sessionSectionKind} key={kind}>
            <div>
              <Text fw={700}>{label}</Text>
              <Text c='dimmed' size='sm'>
                {campaignSessionSectionDescription(kind)}
              </Text>
            </div>
            <Accordion className={styles.sessionSectionAccordion} multiple variant='contained'>
              {sections.map((section) => (
                <Accordion.Item key={section.id} value={section.id}>
                  <Accordion.Control>{section.title}</Accordion.Control>
                  <Accordion.Panel>
                    <SessionSectionEditor
                      campaignId={campaign.id}
                      contentLabel='Details'
                      deletable={editable}
                      editable={editable}
                      section={section}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </section>
        )
      })}
      <Group className={styles.sessionSectionAdder} justify='space-between' wrap='wrap'>
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
    </Stack>
  )
}
