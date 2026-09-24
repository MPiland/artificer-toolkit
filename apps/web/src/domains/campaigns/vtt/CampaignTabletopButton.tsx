import { ActionIcon, Tooltip } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { Gamepad2 } from 'lucide-react'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import {
  buildTabletopHref,
  openAuxiliaryWindow,
  tabletopWindowName
} from './CampaignTabletopWindow.model'

export function CampaignTabletopButton({ campaignId }: { campaignId: string }) {
  const campaign = useQuery(getCampaignDetail(campaignId))
  const currentSession = useQuery(
    convexQuery(convexApi.campaigns.sessions.latestOpen, { campaignId })
  ).data
  const campaignDetail = campaign.data

  if (!campaignDetail || !currentSession) return null

  const href = buildTabletopHref(campaignDetail.publicId, currentSession.sessionNumber)
  return (
    <Tooltip label='Open live tabletop window'>
      <ActionIcon
        aria-label='Open live tabletop window'
        component='a'
        href={href}
        rel='noopener noreferrer'
        size='lg'
        target='_blank'
        variant='default'
        onClick={(event) =>
          openAuxiliaryWindow(
            event,
            tabletopWindowName(campaignDetail.publicId, currentSession.sessionNumber)
          )
        }
      >
        <Gamepad2 aria-hidden size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
