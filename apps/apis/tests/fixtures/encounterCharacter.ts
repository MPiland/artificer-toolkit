import { makeFunctionReference } from 'convex/server'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from './readyCharacter'
import { api, components } from '../../convex/_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

export async function setupCharacterRun(
  options: Parameters<typeof readySheetFixture>[0] = {},
  equipment?: Parameters<typeof readySheetFixture>[1]
) {
  const base = await readySheetFixture(options, equipment)
  const player = base.owner
  const owner = base.other
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [owner.userId, player.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (query) => query.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Fixture profile is unavailable.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const campaign = await owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.mutation(
    makeFunctionReference<
      'mutation',
      { ownerUserId: string; playerUserId: string; campaignId: string },
      null
    >('encounters/developmentCampaign:admitFixturePlayer'),
    { ownerUserId: owner.userId, playerUserId: player.userId, campaignId: campaign.id }
  )
  await player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })

  const blueprint = await owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Native Character mechanics fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Target', maxHitPoints: 3 }]
  })
  const run = await owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  const stored = (await base.readState()).character
  if (!actor || !stored) throw new Error('Fixture Character actor is unavailable.')
  return {
    ...base,
    player,
    owner,
    campaign,
    run,
    actor,
    characterStreamVersion: stored.play.streamVersion
  }
}

/** Declared weapon actions compile only from equipped item facts. */
export async function equipAllCharacterItems(base: Awaited<ReturnType<typeof setupCharacterRun>>) {
  const sheet = await base.player.caller.query(api.characters.sheet.get, {
    id: base.character.id
  })
  if (!sheet) throw new Error('Expected Character Sheet.')
  let characterVersion = base.characterStreamVersion
  for (const item of sheet.inventory.items) {
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: characterVersion,
        itemId: item.id
      }
    })
    characterVersion += 1
  }
}
