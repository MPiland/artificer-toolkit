import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { CampaignFileList } from './CampaignFileList'
import { CampaignFileUploader } from './CampaignFileUploader'
import * as styles from './CampaignFiles.css'

export function CampaignFiles({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  return (
    <div className={styles.layout}>
      {campaign.status === 'ACTIVE' ? <CampaignFileUploader campaignId={campaign.id} /> : null}
      <CampaignFileList campaign={campaign} currentUserId={currentUserId} />
    </div>
  )
}
