import { Button, Group, Menu, Text, Tooltip } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Presentation } from 'lucide-react'
import { useConvex } from 'convex/react'
import { getCampaignLiveScenes } from '#app/data/campaigns/scenes'
import {
  useCampaignSceneShowing,
  useCampaignSceneShowingActions
} from '#app/data/campaigns/useCampaignSceneShowing'

/** GM control: show a Scene's map to players as an image without changing the presented Scene (D87). */
export function CampaignSceneShowingControl({ campaignId }: { campaignId: string }) {
  const convex = useConvex()
  const liveScenes = useQuery(getCampaignLiveScenes(campaignId, convex))
  const { showing, presentedSceneId } = useCampaignSceneShowing(campaignId)
  const actions = useCampaignSceneShowingActions(campaignId)
  return (
    <Group gap='xs' wrap='nowrap'>
      <Menu position='bottom-end' withinPortal>
        <Menu.Target>
          <Button
            leftSection={<Presentation aria-hidden size={16} />}
            loading={actions.show.isPending}
            size='xs'
            variant='default'
          >
            Show to players
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {(liveScenes.data ?? []).map((scene) => {
            const presented = scene.id === presentedSceneId
            return (
              <Tooltip
                disabled={!presented}
                key={scene.id}
                label='Already in front of players. It is the presented Scene.'
                position='left'
              >
                <Menu.Item
                  aria-disabled={presented}
                  data-disabled={presented || undefined}
                  onClick={presented ? undefined : () => actions.show.mutate(scene.id)}
                >
                  {scene.name}
                </Menu.Item>
              </Tooltip>
            )
          })}
          {liveScenes.data?.length === 0 ? <Menu.Label>No Scenes yet</Menu.Label> : null}
        </Menu.Dropdown>
      </Menu>
      {showing ? (
        <Button
          loading={actions.stop.isPending}
          size='xs'
          variant='light'
          onClick={() => actions.stop.mutate()}
        >
          Stop showing {showing.sceneName}
        </Button>
      ) : null}
      {actions.error ? (
        <Text c='red' role='alert' size='xs'>
          {actions.error.message}
        </Text>
      ) : null}
    </Group>
  )
}
