import type { DBLike } from '#types'

export interface CharacterPreparationOptionSummary {
  id: string
  label: string
  level: number
}

interface CharacterPreparationOptionsQueryInput {
  spellIds: readonly string[]
  systemId: string
  ownerUserId: string
  viewerUserId: string
  campaignId: string | null
}

export async function getCharacterPreparationOptionsQuery(
  db: DBLike,
  input: CharacterPreparationOptionsQueryInput
): Promise<CharacterPreparationOptionSummary[]> {
  const spellIds = [...new Set(input.spellIds)]
  if (spellIds.length === 0) return []

  const query = db
    .selectFrom('spells as spell')
    .innerJoin(
      'spell_catalog_index_versions as catalog_index',
      'catalog_index.spell_id',
      'spell.id'
    )
    .select(['spell.id', 'spell.label', 'spell.level'])
    .where('spell.id', 'in', spellIds)
    .where('spell.system_id', '=', input.systemId)
    .where('spell.status', '=', 'ACTIVE')
    .whereRef('catalog_index.authored_version_id', '=', 'spell.active_version_id')

  if (input.campaignId) {
    return (await query
      .leftJoin('campaign_memberships as viewer_membership', (join) =>
        join
          .on('viewer_membership.campaign_id', '=', input.campaignId!)
          .on('viewer_membership.user_id', '=', input.viewerUserId)
          .on('viewer_membership.status', '=', 'ACTIVE')
      )
      .leftJoin('campaign_content_shares as share', (join) =>
        join
          .onRef('share.subject_id', '=', 'spell.id')
          .on('share.subject_kind', '=', 'SPELL')
          .on('share.campaign_id', '=', input.campaignId!)
          .onRef('share.shared_by', '=', 'spell.user_id')
      )
      .leftJoin('campaign_memberships as sharer_membership', (join) =>
        join
          .onRef('sharer_membership.campaign_id', '=', 'share.campaign_id')
          .onRef('sharer_membership.user_id', '=', 'share.shared_by')
          .on('sharer_membership.status', '=', 'ACTIVE')
      )
      .where('viewer_membership.user_id', 'is not', null)
      .where((eb) =>
        eb.or([
          eb('spell.user_id', '=', input.ownerUserId),
          eb('spell.is_master', '=', true),
          eb('sharer_membership.user_id', 'is not', null)
        ])
      )
      .orderBy('spell.label')
      .orderBy('spell.id')
      .execute()) as CharacterPreparationOptionSummary[]
  }

  return (await query
    .where((eb) =>
      eb.or([eb('spell.user_id', '=', input.ownerUserId), eb('spell.is_master', '=', true)])
    )
    .orderBy('spell.label')
    .orderBy('spell.id')
    .execute()) as CharacterPreparationOptionSummary[]
}
