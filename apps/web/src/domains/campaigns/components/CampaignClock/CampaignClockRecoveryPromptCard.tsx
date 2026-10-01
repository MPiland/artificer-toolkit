import { Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { CampaignClockRecoveryPromptDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { splitAbsoluteMinute } from '@artificer-toolkit/rules-runtime/campaignClock'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import { useCharacterSheetCommandMutation } from '#app/data/characters/mutations'
import { getCharacterSheetSlice } from '#app/data/characters/queries'
import { useLiveCharacterSheet } from '#app/domains/characters/sheet/core/useLiveCharacterSheet'
import { CLOCK_RECOVERY_BOUNDARY_LABELS, recoverableResources } from './campaignClockRecovery'
import { formatTime } from './campaignClockTime'

export function CampaignClockRecoveryPromptCard({
  prompt
}: {
  prompt: CampaignClockRecoveryPromptDto
}) {
  const { boundaryKind, campaignId, characterId } = prompt
  const dismissPrompt = useConvexMutation(convexApi.campaigns.clock.dismissRecoveryPrompt)
  const committed = useQuery(getCharacterSheetSlice(characterId, 'ACTIONS', campaignId))
  const live = useLiveCharacterSheet(characterId, campaignId)
  const command = useCharacterSheetCommandMutation(
    characterId,
    campaignId,
    live &&
      committed.data && {
        checkpointVersion: committed.data.meta.streamVersion,
        sendPlayCommand: live.sendPlayCommand
      }
  )
  const [excludedIds, setExcludedIds] = useState<readonly string[]>([])
  // The room's Sheet is current while it holds the Character; the committed Sheet is its fallback.
  const sheet = live?.sheet ?? committed.data
  const candidates = sheet ? recoverableResources(sheet.resources.items, boundaryKind) : []
  const selected = candidates.filter((resource) => !excludedIds.includes(resource.id))
  const dismiss = useMutation({
    mutationFn: () => dismissPrompt({ campaignId, promptId: prompt.id })
  })
  const refresh = useMutation({
    mutationFn: async () => {
      if (!sheet) throw new Error('Character Sheet is not loaded.')
      let expectedVersion = sheet.meta.streamVersion
      for (const resource of selected) {
        // Each command commits a new play version; the next one must expect exactly that.
        const result = await command.mutateAsync({
          type: 'RECOVER_SHEET_RESOURCE',
          commandId: crypto.randomUUID(),
          expectedVersion,
          owner: resource.owner,
          trigger: boundaryKind
        })
        expectedVersion = result.streamVersion
      }
      await dismissPrompt({ campaignId, promptId: prompt.id })
    }
  })
  const { day, minuteOfDay } = splitAbsoluteMinute(prompt.boundaryAbsoluteMinute)
  const labels = CLOCK_RECOVERY_BOUNDARY_LABELS[boundaryKind]
  const busy = dismiss.isPending || refresh.isPending
  const error = dismiss.error ?? refresh.error

  return (
    <Paper withBorder p='sm'>
      <Stack gap='xs'>
        <Text fw={700} size='sm'>
          {prompt.characterName} · {labels.passed} (Day {day} · {formatTime(minuteOfDay)})
        </Text>
        {!sheet ? (
          <Text c='dimmed' size='sm'>
            {committed.isPending ? 'Loading charges…' : 'Charges are unavailable.'}
          </Text>
        ) : candidates.length === 0 ? (
          <Text c='dimmed' size='sm'>
            No charges that recover at {labels.recovers} are spent.
          </Text>
        ) : (
          <Stack gap={6}>
            {candidates.map((resource) => (
              <Checkbox
                key={resource.id}
                checked={!excludedIds.includes(resource.id)}
                disabled={busy}
                label={`${resource.label} · ${resource.remaining}/${resource.max}`}
                onChange={(event) =>
                  setExcludedIds((current) =>
                    event.currentTarget.checked
                      ? current.filter((id) => id !== resource.id)
                      : [...current, resource.id]
                  )
                }
              />
            ))}
          </Stack>
        )}
        {error ? (
          <Text c='red' role='alert' size='xs'>
            Charges could not be updated. Try again.
          </Text>
        ) : null}
        <Group justify='flex-end' gap='xs'>
          {candidates.length === 0 ? (
            <Button
              loading={dismiss.isPending}
              size='xs'
              variant='default'
              onClick={() => dismiss.mutate()}
            >
              Dismiss
            </Button>
          ) : (
            <>
              <Button
                disabled={refresh.isPending}
                loading={dismiss.isPending}
                size='xs'
                variant='default'
                onClick={() => dismiss.mutate()}
              >
                Skip
              </Button>
              <Button
                disabled={dismiss.isPending || selected.length === 0 || Boolean(live?.pending)}
                loading={refresh.isPending}
                size='xs'
                onClick={() => refresh.mutate()}
              >
                Refresh selected
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Paper>
  )
}
