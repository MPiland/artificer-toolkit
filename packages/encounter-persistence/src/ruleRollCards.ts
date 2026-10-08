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
 */
export async function recordRuleRollCard(
  ctx: EncounterReadTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainGmRoll'>
  },
  input: {
    campaign: CampaignAuthority['campaign']
    encounterId: string
    roller: RuleRollRoller | null
    initiatorUserId: string
    visibility: RollVisibilityDto | undefined
    clientNonce: string
    roll: RollRecordDto
  }
): Promise<{
  audience: 'TABLE' | 'PRIVATE'
  entry: CampaignChatEntryDto | null
}> {
  const { campaign, roller, roll } = input
  const { audience, authorUserId } = await readRuleRollRouting(ctx, input)
  if (audience === 'TABLE')
    return {
      audience,
      entry: await ctx.ports.insertTableRoll(
        await ctx.ports.requireCampaignAuthority(campaign.id, authorUserId),
        authorUserId,
        input.clientNonce,
        roll
      )
    }
  await ctx.ports.retainGmRoll(campaign.ownerUserId, roll, {
    campaignId: campaign.id,
    creature: roller ? { encounterId: input.encounterId, actorId: roller.id } : null,
    revealedAt: null,
    noticedAt: null
  })
  return { audience, entry: null }
}
