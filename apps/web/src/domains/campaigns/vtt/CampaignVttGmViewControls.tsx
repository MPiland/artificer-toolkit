import { ActionIcon, Select, Tooltip } from '@mantine/core'
import { Eye, EyeOff } from 'lucide-react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'

/**
 * What the GM's players see of the GM's tabletop: the vision preview as one player, and whether
 * the GM's previews and pings are shared.
 */
export function CampaignVttGmViewControls({
  memberships,
  previewUserId,
  sharePreviews,
  onPreviewUserChange,
  onSharePreviewsChange
}: {
  memberships: CampaignDetailDto['memberships']
  previewUserId: string | null
  sharePreviews: boolean
  onPreviewUserChange: (userId: string | null) => void
  onSharePreviewsChange: (share: boolean) => void
}) {
  return (
    <>
      <Select
        aria-label='GM vision preview'
        data={[
          { label: 'Full GM view', value: 'GM' },
          ...memberships
            .filter((membership) => membership.role === 'PLAYER')
            .map((membership) => ({
              label: `Preview ${membership.username}`,
              value: membership.userId
            }))
        ]}
        size='xs'
        value={previewUserId ?? 'GM'}
        onChange={(value) => onPreviewUserChange(value && value !== 'GM' ? value : null)}
      />
      <Tooltip
        label={
          sharePreviews ? 'Players see your previews and pings' : 'Previews and pings are private'
        }
      >
        <ActionIcon
          aria-label='Show my previews to players'
          aria-pressed={sharePreviews}
          variant={sharePreviews ? 'filled' : 'default'}
          onClick={() => onSharePreviewsChange(!sharePreviews)}
        >
          {sharePreviews ? <Eye aria-hidden size={18} /> : <EyeOff aria-hidden size={18} />}
        </ActionIcon>
      </Tooltip>
    </>
  )
}
