import type { CampaignContentShareDto } from '@artificer-toolkit/schema/api/campaignCore'

export function campaignVehicleShareLabel(share: CampaignContentShareDto): string {
  const document = share.document
  return document &&
    typeof document === 'object' &&
    !Array.isArray(document) &&
    'label' in document &&
    typeof document.label === 'string'
    ? document.label
    : 'Campaign Vehicle'
}
