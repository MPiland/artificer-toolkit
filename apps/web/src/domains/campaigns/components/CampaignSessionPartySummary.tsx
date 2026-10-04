import { Badge, Button, Group, Loader, Modal, SimpleGrid, Text } from '@mantine/core'
import { useQueries } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { LiveCampaignSummaryDto } from '@artificer-toolkit/schema/api/liveSessions'
import { getCharacterSheetSlice } from '#app/data/characters/queries'
import { usePaginatedQuery } from 'convex/react'
import { CharacterSheetView } from '#domains/characters/sheet/core/CharacterSheetView'
import { resolveHitPoints } from '../vtt/liveCampaignSummary'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionPartySummary({
  campaign,
  currentUserId,
  liveSummary,
  sessionId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  /** The room's summary while the table runs; its hit points replace Convex's. */
  liveSummary: LiveCampaignSummaryDto | null
  sessionId: string
}) {
  const attendance = usePaginatedQuery(
    convexApi.campaigns.sessionAttendance.list,
    { campaignId: campaign.id, sessionId },
    { initialNumItems: 32 }
  )
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const assigned = campaign.memberships.flatMap((membership) =>
    membership.assignedCharacter ? [{ membership, character: membership.assignedCharacter }] : []
  )
  const sheets = useQueries({
    queries: assigned.map(({ character }) =>
      getCharacterSheetSlice(character.id, 'COMMON', campaign.id)
    )
  })
  const selectedIndex = assigned.findIndex(({ character }) => character.id === selectedCharacterId)
  const selected = selectedIndex >= 0 ? assigned[selectedIndex] : null
  const selectedSheet = selectedIndex >= 0 ? sheets[selectedIndex]?.data : undefined

  return (
    <>
      <div>
        <Group align='flex-start' justify='space-between'>
          <div>
            <Text fw={700}>Party at a glance</Text>
            <Text c='dimmed' size='sm'>
              Open a Character when you need the full GM-authorized Sheet.
            </Text>
          </div>
          {sheets.some((sheet) => sheet.isPending) ? <Loader size='xs' /> : null}
        </Group>
        {assigned.length ? (
          <SimpleGrid
            className={sessionsStyles.sessionPartyGrid}
            cols={{ base: 1, sm: 2, lg: 3 }}
            mt='md'
          >
            {assigned.map(({ membership, character }, index) => {
              const sheet = sheets[index]?.data
              const hitPoints = resolveHitPoints(liveSummary, character.id, sheet?.overview)
              const present =
                attendance.results.find((entry) => entry.characterId === character.id)?.present ??
                true
              return (
                <article
                  className={sessionsStyles.sessionPartyCard}
                  data-absent={!present || undefined}
                  key={character.id}
                >
                  <Group align='flex-start' justify='space-between' wrap='nowrap'>
                    <div>
                      <Text fw={700}>{character.label}</Text>
                      <Text c='dimmed' size='sm'>
                        @{membership.username}
                      </Text>
                    </div>
                    {!present ? <Badge color='gray'>Absent</Badge> : null}
                  </Group>
                  {hitPoints ? (
                    <Group gap='md'>
                      <Text size='sm'>
                        HP {hitPoints.currentHitPoints}/{hitPoints.maxHitPoints}
                      </Text>
                      {sheet ? (
                        <>
                          <Text c='dimmed' size='sm'>
                            AC {sheet.overview.armorClass}
                          </Text>
                          <Text c='dimmed' size='sm'>
                            Lvl {sheet.identity.totalLevel}
                          </Text>
                        </>
                      ) : null}
                    </Group>
                  ) : (
                    <Text c='dimmed' size='sm'>
                      Character state unavailable.
                    </Text>
                  )}
                  <Button
                    disabled={!sheet}
                    size='compact-sm'
                    variant='default'
                    onClick={() => setSelectedCharacterId(character.id)}
                  >
                    View Sheet
                  </Button>
                </article>
              )
            })}
          </SimpleGrid>
        ) : (
          <Text c='dimmed' mt='md'>
            No Characters are assigned to this Campaign.
          </Text>
        )}
        {attendance.status === 'CanLoadMore' ? (
          <Button mt='md' variant='subtle' onClick={() => attendance.loadMore(32)}>
            Load more attendance
          </Button>
        ) : null}
      </div>
      <Modal
        fullScreen
        closeButtonProps={{ 'aria-label': 'Close Character Sheet' }}
        opened={Boolean(selected && selectedSheet)}
        title={selected?.character.label ?? 'Character Sheet'}
        onClose={() => setSelectedCharacterId(null)}
      >
        {selected && selectedSheet ? (
          <CharacterSheetView
            characterPublicId={selected.character.publicId}
            currentUserId={currentUserId}
            hasDraft={Boolean(selectedSheet.meta.hasBuilderDraft)}
            rollerName={selectedSheet.identity.label}
            sheet={selectedSheet}
          />
        ) : null}
      </Modal>
    </>
  )
}
