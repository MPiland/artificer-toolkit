import { Alert } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  CAMPAIGN_CHARACTER_CONTROLLER_LIMIT,
  type CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { AppMultiSelect } from '#app/ui/primitives/Select'

/** GM-only: lend control of one assigned Character to other players, or take it back at any time. */
export function CharacterControllersField({
  campaignId,
  character,
  controllerUserIds,
  memberships,
  assignedUserId
}: {
  campaignId: string
  character: NonNullable<CampaignDetailDto['memberships'][number]['assignedCharacter']>
  controllerUserIds: string[]
  memberships: CampaignDetailDto['memberships']
  assignedUserId: string
}) {
  const setControllers = useConvexMutation(convexApi.campaigns.characterControllers.setControllers)
  const save = useMutation({
    retry: false,
    mutationFn: (userIds: string[]) =>
      setControllers({ campaignId, characterId: character.id, controllerUserIds: userIds })
  })

  return (
    <>
      <AppMultiSelect
        aria-label={`Who else controls ${character.label}`}
        clearable
        comboboxProps={{ withinPortal: false }}
        data={memberships
          .filter((member) => member.role === 'PLAYER' && member.userId !== assignedUserId)
          .map((member) => ({ label: member.username, value: member.userId }))}
        description='The assigned player always keeps control.'
        disabled={save.isPending}
        label='Also controlled by'
        maxValues={CAMPAIGN_CHARACTER_CONTROLLER_LIMIT}
        placeholder={controllerUserIds.length ? undefined : 'Only the assigned player'}
        value={controllerUserIds}
        onChange={(userIds) => save.mutate([...new Set(userIds)].sort())}
      />
      {save.error ? <Alert color='red'>{save.error.message}</Alert> : null}
    </>
  )
}
