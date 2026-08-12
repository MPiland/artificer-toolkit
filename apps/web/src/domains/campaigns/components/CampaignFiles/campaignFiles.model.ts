export const campaignFileAccept = 'image/jpeg,image/png,image/webp,text/plain'
export const campaignFileMaxBytes = 6 * 1024 * 1024

export function validateCampaignFile(file: File, handoutMap: boolean): string | null {
  if (file.size > campaignFileMaxBytes) return 'Files must be 6 MB or smaller.'
  if (!['image/jpeg', 'image/png', 'image/webp', 'text/plain'].includes(file.type)) {
    return 'Choose a JPEG, PNG, WebP, or plain-text file.'
  }
  if (handoutMap && file.type === 'text/plain') return 'Handout maps must be images.'
  return null
}
