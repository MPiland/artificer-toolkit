import { buildAuthoredRouteHandle } from './authoredRouteHandles'

export function buildSpellRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'spellPublicId', 'spellSlug')
}

export function buildBackgroundRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'backgroundPublicId', 'backgroundSlug')
}

export function buildFeatRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'featPublicId', 'featSlug')
}

export function buildRaceRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'racePublicId', 'raceSlug')
}

export function buildCreatureRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'creaturePublicId', 'creatureSlug')
}

export function buildClassRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'classPublicId', 'classSlug')
}

export function buildEquipmentRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'equipmentPublicId', 'equipmentSlug')
}

export function buildVehicleRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'vehiclePublicId', 'vehicleSlug')
}

export function buildCampaignRouteParams(publicId: string, name: string | null | undefined) {
  return buildDomainRouteParams(publicId, name, 'campaignPublicId', 'campaignSlug')
}

export function buildCharacterRouteParams(publicId: string, label: string | null | undefined) {
  return buildDomainRouteParams(publicId, label, 'characterPublicId', 'characterSlug')
}

function buildDomainRouteParams<TPublicId extends string, TSlug extends string>(
  publicId: string,
  label: string | null | undefined,
  publicIdKey: TPublicId,
  slugKey: TSlug
): Record<TPublicId | TSlug, string> {
  const handle = buildAuthoredRouteHandle(publicId, label)

  return {
    [publicIdKey]: handle.publicId,
    [slugKey]: handle.slug
  } as Record<TPublicId | TSlug, string>
}
