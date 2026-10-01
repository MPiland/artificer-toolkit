import { persistEncounterConcentrationChildren } from '@artificer-toolkit/encounter-persistence/concentrationChildrenPersistence'
import { applyLiveConcentrationCleanup } from '@artificer-toolkit/encounter-persistence/concentrationCleanupPersistence'

/** Resolves native Character versions and cleanup through the admitted Character writer. */
export function persistRoomConcentrationChildren(
  ctx: Parameters<typeof persistEncounterConcentrationChildren>[0],
  children: Parameters<typeof persistEncounterConcentrationChildren>[1]
) {
  return persistEncounterConcentrationChildren(ctx, children, {
    currentCharacterStreamVersion: async (characterId) => {
      const { campaign } = await ctx.ports.requireCampaignAuthority(
        children.state.campaignId,
        children.userId
      )
      const { assignment } = await ctx.ports.requireCampaignCharacterAuthority(
        campaign.id,
        characterId,
        campaign.ownerUserId
      )
      const character = await ctx.ports.readCharacterRow(characterId)
      if (
        !character ||
        character.status !== 'ACTIVE' ||
        character.userId !== assignment.userId ||
        character.systemId !== children.state.gameSystemId
      )
        throw new Error('Room concentration Character owner changed.')
      return character.play.streamVersion
    },
    applyCleanup: (cleanup) => applyLiveConcentrationCleanup(ctx, cleanup)
  })
}
