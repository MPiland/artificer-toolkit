import { ActionIcon, Tooltip } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Gamepad2 } from 'lucide-react'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import {
  buildTabletopHref,
  openAuxiliaryWindow,
  tabletopWindowName
} from './CampaignTabletopWindow.model'

export function CampaignTabletopButton({ campaignId }: { campaignId: string }) {
  const campaignDetail = useQuery(getCampaignDetail(campaignId)).data
  if (!campaignDetail) return null

  const href = buildTabletopHref(campaignDetail.publicId)
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
        onClick={(event) => openAuxiliaryWindow(event, tabletopWindowName(campaignDetail.publicId))}
      >
        <Gamepad2 aria-hidden size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
