import { Alert, Badge, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { useConvex, usePaginatedQuery } from 'convex/react'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionAttendance({
  campaign,
  session
}: {
  campaign: CampaignDetailDto
  session: CampaignSessionDto
}) {
  const convex = useConvex()
  const attendance = usePaginatedQuery(
    convexApi.campaigns.sessionAttendance.list,
    { campaignId: campaign.id, sessionId: session.id },
    { initialNumItems: 32 }
  )
  const assignedCharacters = campaign.memberships.flatMap((membership) =>
    membership.assignedCharacter ? [membership.assignedCharacter] : []
  )
  const setAttendance = useMutation({
    mutationFn: ({ characterId, present }: { characterId: string; present: boolean }) =>
      convex.mutation(convexApi.campaigns.sessionAttendance.set, {
        campaignId: campaign.id,
        sessionId: session.id,
        characterId,
        present,
        expectedVersion: session.version
      })
  })
  const canEdit = campaign.status === 'ACTIVE' && session.status === 'OPEN'
  const presentCount = assignedCharacters.filter((character) =>
    isPresent(attendance.results, character.id)
  ).length

  return (
    <Stack gap='md'>
      <Group align='flex-start' justify='space-between'>
        <div>
          <Text fw={700}>Attendance</Text>
          <Text c='dimmed' size='sm'>
            Record who is actually at the table for this Session.
          </Text>
        </div>
        <Badge variant='light'>
          {attendance.status === 'LoadingFirstPage'
            ? 'Loading'
            : `${presentCount}/${assignedCharacters.length} present`}
        </Badge>
      </Group>
      {attendance.status === 'LoadingFirstPage' ? (
        <Text c='dimmed'>Loading attendance…</Text>
      ) : null}
      {setAttendance.error ? <Alert color='red'>Attendance couldn’t be updated.</Alert> : null}
      {attendance.status !== 'LoadingFirstPage' && assignedCharacters.length ? (
        <SimpleGrid
          className={sessionsStyles.sessionAttendanceGrid}
          cols={{ base: 1, sm: 2, md: 4 }}
        >
          {assignedCharacters.map((character) => {
            const present = isPresent(attendance.results, character.id)
            return (
              <Button
                aria-pressed={present}
                className={sessionsStyles.sessionAttendanceCard}
                data-selected={present || undefined}
                disabled={!canEdit || setAttendance.isPending}
                key={character.id}
                variant='default'
                onClick={() =>
                  setAttendance.mutate({ characterId: character.id, present: !present })
                }
              >
                <Group justify='space-between' wrap='nowrap'>
                  <Text fw={700}>{character.label}</Text>
                  <Badge color={present ? 'green' : 'gray'} variant='light'>
                    {present ? 'Present' : 'Absent'}
                  </Badge>
                </Group>
              </Button>
            )
          })}
        </SimpleGrid>
      ) : attendance.status !== 'LoadingFirstPage' ? (
        <Text c='dimmed'>No assigned Characters are available for attendance.</Text>
      ) : null}
      {attendance.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => attendance.loadMore(32)}>
          Load more attendance
        </Button>
      ) : null}
    </Stack>
  )
}

function isPresent(
  attendance: Array<{ characterId: string; present: boolean }> | undefined,
  characterId: string
) {
  return attendance?.find((entry) => entry.characterId === characterId)?.present ?? false
}
