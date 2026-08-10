import { Alert, Badge, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignDetailDto, CampaignSessionDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignSessionAttendance } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
import * as sessionsStyles from '../campaignSessions.css'

export function CampaignSessionAttendance({
  campaign,
  session
}: {
  campaign: CampaignDetailDto
  session: CampaignSessionDto
}) {
  const queryClient = useQueryClient()
  const attendance = useQuery(getCampaignSessionAttendance(campaign.id, session.id))
  const assignedCharacters = campaign.memberships.flatMap((membership) =>
    membership.assignedCharacter ? [membership.assignedCharacter] : []
  )
  const setAttendance = useMutation({
    mutationFn: ({ characterId, present }: { characterId: string; present: boolean }) =>
      api.campaigns.sessions.attendance.set({
        campaignId: campaign.id,
        sessionId: session.id,
        characterId,
        present,
        expectedVersion: session.version
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.sessionAttendance(campaign.id, session.id)
      })
  })
  const canEdit = campaign.status === 'ACTIVE' && session.status === 'OPEN'
  const presentCount = assignedCharacters.filter((character) =>
    isPresent(attendance.data, character.id)
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
          {attendance.isPending
            ? 'Loading'
            : `${presentCount}/${assignedCharacters.length} present`}
        </Badge>
      </Group>
      {attendance.isPending ? <Text c='dimmed'>Loading attendance…</Text> : null}
      {attendance.error ? <Alert color='red'>Attendance couldn’t be loaded.</Alert> : null}
      {setAttendance.error ? <Alert color='red'>Attendance couldn’t be updated.</Alert> : null}
      {!attendance.isPending && !attendance.error && assignedCharacters.length ? (
        <SimpleGrid
          className={sessionsStyles.sessionAttendanceGrid}
          cols={{ base: 1, sm: 2, md: 4 }}
        >
          {assignedCharacters.map((character) => {
            const present = isPresent(attendance.data, character.id)
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
      ) : !attendance.isPending && !attendance.error ? (
        <Text c='dimmed'>No assigned Characters are available for attendance.</Text>
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
