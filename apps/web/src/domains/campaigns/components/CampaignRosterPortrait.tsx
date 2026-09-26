import { Avatar } from '@mantine/core'
import { useMediaImage } from '#app/data/media'

/** An assigned Character's portrait, read through the Campaign scope any member may use. */
export function CampaignRosterPortrait({
  campaignId,
  characterId,
  label
}: {
  campaignId: string
  characterId: string
  label: string
}) {
  const image = useMediaImage(
    {
      lookup: { type: 'CHARACTER_PORTRAIT', characterId, campaignId },
      attach: { type: 'CHARACTER_PORTRAIT', characterId }
    },
    'THUMBNAIL'
  )
  return (
    <Avatar alt={`${label} portrait`} name={label} radius='md' size='lg' src={image.data?.url} />
  )
}
