import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'

type MemberCharacters = Pick<
  CampaignDetailDto['memberships'][number],
  'activeCharacter' | 'benchedCharacters'
>

/** Every Character a member attached to the Campaign, the Active Character first (D236). */
export function attachedCharacters({ activeCharacter, benchedCharacters }: MemberCharacters) {
  return activeCharacter ? [activeCharacter, ...benchedCharacters] : [...benchedCharacters]
}
