import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollRecordDto, RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readEncounterActorPrimaryController } from './actorController.js'
import type { CampaignAuthority, EncounterReadTransaction, EncounterWritePorts } from './ports.js'

/** The Encounter actor that made a roll. */
type RuleRollRoller = Pick<
  EncounterRunActorState,
  'id' | 'kind' | 'sourceId' | 'controllerUserIds' | 'public'
>

/**
 * `roller` as its card is routed when the roll's caster perceives it or not. A creature an area's
 * caster cannot perceive rolls as a hidden one does (D62): its card is the GM's alone and never
 * reaches a table that includes the caster.
 */
export function rollerAsPerceivedByCaster<Roller extends RuleRollRoller>(
  roller: Roller,
  perceivedByCaster: boolean
): Roller {
  return perceivedByCaster ? roller : { ...roller, public: false }
}

/**
 * Where a rule roll's card goes and who authors it (Q14, D83). A hidden actor's roll is always
 * private (D62), so a table never learns it exists. Otherwise a player-controlled actor's roll is
 * the table's, and a GM-controlled actor's roll follows the Public/Private choice the owner's
 * command carried, else the owner's stored preference; a player's command cannot pick it. The
 * card is authored by the roller's primary controller (the owner if that member has left), never
 * by whoever triggered the roll. With no roller actor, the member who rolled is the controller.
 */
export async function readRuleRollRouting(
  ctx: EncounterReadTransaction,
  input: {
    campaign: CampaignAuthority['campaign']
    roller: RuleRollRoller | null
    initiatorUserId: string
    visibility: RollVisibilityDto | undefined
  }
): Promise<{ audience: 'TABLE' | 'PRIVATE'; authorUserId: string }> {
  const { campaign, roller, initiatorUserId } = input
  const controller = roller
    ? await readEncounterActorPrimaryController(ctx, campaign, roller)
    : initiatorUserId
  const controllerLeft =
    controller !== campaign.ownerUserId &&
    (
      await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', controller)
        )
        .unique()
    )?.status !== 'ACTIVE'
  const authorUserId = controllerLeft ? campaign.ownerUserId : controller
  if (roller && !roller.public) return { audience: 'PRIVATE', authorUserId }
  if (controller !== campaign.ownerUserId) return { audience: 'TABLE', authorUserId }
  const visibility =
    (initiatorUserId === campaign.ownerUserId ? input.visibility : undefined) ??
    (await ctx.ports.readGmRollVisibility(campaign.ownerUserId))
  return { audience: visibility === 'PUBLIC' ? 'TABLE' : 'PRIVATE', authorUserId }
}

/**
 * Records one rule roll's chat card: a TABLE card, or a roll retained in the GM's private history
 * with the rolling creature referenced for a later reveal. Returns the posted table entry.
 *
 * A private card is also the roller's own when a player controls the roller (`playerCopyUserId`):
 * that player's history holds the generic `roll`, with no reveal to offer, and their answer carries
 * it. The table and the area's caster learn nothing of it.
 *
 * A roll the server adjusted for sight (ATTACK-10.1) carries `gmRoll`, the same dice with the GM's
 * specific reason. The table card keeps the generic `roll`; the GM's history holds `gmRoll`, already
 * revealed when the table has `roll`, and the only card when the roll is private.
 */
export async function recordRuleRollCard(
  ctx: EncounterReadTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: {
    campaign: CampaignAuthority['campaign']
    /** Null for a roll outside an Encounter, such as a Sheet death save. */
    encounterId: string | null
    roller: RuleRollRoller | null
    initiatorUserId: string
    visibility: RollVisibilityDto | undefined
    clientNonce: string
    roll: RollRecordDto
    gmRoll?: RollRecordDto
  }
): Promise<{
  audience: 'TABLE' | 'PRIVATE'
  entry: CampaignChatEntryDto | null
  /** The player who rolled a private card and keeps their own copy; null when only the GM holds it. */
  playerCopyUserId: string | null
}> {
  const { campaign, roller, roll } = input
  const { audience, authorUserId } = await readRuleRollRouting(ctx, input)
  const creature =
    roller && input.encounterId ? { encounterId: input.encounterId, actorId: roller.id } : null
  if (audience === 'TABLE') {
    const entry = await ctx.ports.insertTableRoll(
      await ctx.ports.requireCampaignAuthority(campaign.id, authorUserId),
      authorUserId,
      input.clientNonce,
      roll
    )
    if (input.gmRoll)
      await ctx.ports.retainPrivateRoll(campaign.ownerUserId, input.gmRoll, {
        campaignId: campaign.id,
        creature,
        revealedAt: input.gmRoll.createdAt,
        noticedAt: null
      })
    return { audience, entry, playerCopyUserId: null }
  }
  await ctx.ports.retainPrivateRoll(campaign.ownerUserId, input.gmRoll ?? roll, {
    campaignId: campaign.id,
    creature,
    revealedAt: null,
    noticedAt: null
  })
  const playerCopyUserId = authorUserId === campaign.ownerUserId ? null : authorUserId
  if (playerCopyUserId) await ctx.ports.retainPrivateRoll(playerCopyUserId, roll, null)
  return { audience, entry: null, playerCopyUserId }
}
