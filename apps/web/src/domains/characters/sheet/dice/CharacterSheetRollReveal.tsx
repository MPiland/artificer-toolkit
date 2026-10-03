import { Button, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { RevealCampaignRollInput } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto, RollRevealModeDto } from '@artificer-toolkit/schema/api/rolls'

const reveals = [
  { mode: 'FULL', action: 'Show roll', done: 'Revealed to table', usedAt: 'revealedAt' },
  {
    mode: 'NOTICE',
    action: 'Show that I rolled',
    done: 'Table told you rolled',
    usedAt: 'noticedAt'
  }
] as const

/** The GM's two logged, one-time reveals of a private Campaign roll (D83). */
export function CharacterSheetRollReveal({
  roll,
  onReveal
}: {
  roll: RollHistoryEntryDto
  onReveal: (input: RevealCampaignRollInput) => Promise<unknown>
}) {
  const [revealed, setRevealed] = useState<ReadonlySet<RollRevealModeDto>>(new Set())
  const reveal = useMutation({
    mutationFn: onReveal,
    onSuccess: (_entry, { mode }) => setRevealed((current) => new Set(current).add(mode)),
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'The roll could not be revealed.'
      })
  })
  const gmCampaignRoll = roll.gmCampaignRoll
  if (!gmCampaignRoll) return null

  return (
    <Group gap='xs'>
      {reveals.map(({ mode, action, done, usedAt }) =>
        gmCampaignRoll[usedAt] !== null || revealed.has(mode) ? (
          <Text c='dimmed' key={mode} size='xs'>
            {done}
          </Text>
        ) : (
          <Button
            disabled={reveal.isPending}
            key={mode}
            loading={reveal.isPending && reveal.variables.mode === mode}
            size='compact-xs'
            variant='subtle'
            onClick={() =>
              reveal.mutate({ campaignId: gmCampaignRoll.campaignId, rollId: roll.id, mode })
            }
          >
            {action}
          </Button>
        )
      )}
    </Group>
  )
}
