import { ActionIcon, Tooltip } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Gamepad2 } from 'lucide-react'
import { getCampaignDetail, getCampaignSessions } from '#app/data/campaigns/queries'
import {
  buildTabletopHref,
  findCurrentTabletopSession,
  openAuxiliaryWindow,
  tabletopWindowName
} from './CampaignTabletopWindow.model'

export function CampaignTabletopButton({ campaignId }: { campaignId: string }) {
  const campaign = useQuery(getCampaignDetail(campaignId))
  const sessions = useQuery(getCampaignSessions(campaignId))
  const currentSession = sessions.data ? findCurrentTabletopSession(sessions.data) : undefined
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
