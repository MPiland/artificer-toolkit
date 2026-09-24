import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionReferencePinDto } from '@artificer-toolkit/schema/api/campaignSessions'
import {
  buildBackgroundRouteParams,
  buildCampaignRouteParams,
  buildClassRouteParams,
  buildCreatureRouteParams,
  buildEquipmentRouteParams,
  buildFeatRouteParams,
  buildRaceRouteParams,
  buildSpellRouteParams,
  buildVehicleRouteParams
} from '#app/routing/authoredRouteParams'

export type AuthoredReferenceTarget = Extract<
  CampaignSessionReferencePinDto['target'],
  { kind: 'AUTHORED_ROUTE' }
>

export const authoredReferenceSubjectOptions: ReadonlyArray<{
  label: string
  value: AuthoredReferenceTarget['routeSubjectKind']
}> = [
  { label: 'Background', value: 'BACKGROUND' },
  { label: 'Class', value: 'CLASS' },
  { label: 'Creature', value: 'CREATURE' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Feat', value: 'FEAT' },
  { label: 'Race', value: 'RACE' },
  { label: 'Spell', value: 'SPELL' },
  { label: 'Vehicle', value: 'VEHICLE' }
]

export function campaignSessionReferenceHref(
  campaign: Pick<CampaignDetailDto, 'name' | 'publicId'>,
  reference: CampaignSessionReferencePinDto
): string {
  if (reference.target.kind === 'CAMPAIGN_NOTE') {
    const params = buildCampaignRouteParams(campaign.publicId, campaign.name)
    return `/campaigns/${params.campaignPublicId}/${params.campaignSlug}?tab=notes`
  }

  const { publicId, routeSubjectKind } = reference.target
  const label = reference.label
  if (routeSubjectKind === 'BACKGROUND') {
    const params = buildBackgroundRouteParams(publicId, label)
    return `/backgrounds/${params.backgroundPublicId}/${params.backgroundSlug}`
  }
  if (routeSubjectKind === 'CLASS') {
    const params = buildClassRouteParams(publicId, label)
    return `/classes/${params.classPublicId}/${params.classSlug}`
  }
  if (routeSubjectKind === 'CREATURE') {
    const params = buildCreatureRouteParams(publicId, label)
    return `/creatures/${params.creaturePublicId}/${params.creatureSlug}`
  }
  if (routeSubjectKind === 'EQUIPMENT') {
    const params = buildEquipmentRouteParams(publicId, label)
    return `/equipment/${params.equipmentPublicId}/${params.equipmentSlug}`
  }
  if (routeSubjectKind === 'FEAT') {
    const params = buildFeatRouteParams(publicId, label)
    return `/feats/${params.featPublicId}/${params.featSlug}`
  }
  if (routeSubjectKind === 'RACE') {
    const params = buildRaceRouteParams(publicId, label)
    return `/races/${params.racePublicId}/${params.raceSlug}`
  }
  if (routeSubjectKind === 'SPELL') {
    const params = buildSpellRouteParams(publicId, label)
    return `/spells/${params.spellPublicId}/${params.spellSlug}`
  }
  const params = buildVehicleRouteParams(publicId, label)
  return `/vehicles/${params.vehiclePublicId}/${params.vehicleSlug}`
}
