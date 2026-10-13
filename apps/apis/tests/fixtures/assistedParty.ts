import { makeFunctionReference } from 'convex/server'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../../convex/_generated/api'
import { loadCharacterSheetFacts } from '../../convex/characters/sheetFacts'
import { equipAllCharacterItems, equipAllItems, setupCharacterRun } from './encounterCharacter'
import { createEncounterInitiativeDefinitions } from './encounterInitiative'
import { attachFixtureRoom, checkpointLiveRoom } from './localRoomWorker'
import { createPartyPlayer } from './partyPlayer'
import { importedSubject } from './publication'
import { setAutoRollDice } from './rollPreferences'
import { srdWolf } from './srdCreatures'
import { readTestActor } from './storedActors'

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

/**
 * A GM and two players (Aria and Bryn, each assigned their own SRD Fighter with a seeded Longsword)
 * in an Assisted Campaign whose controllers declare initiative for every actor at START. All three auto-roll their
 * dice. The prepared Run seats both Characters against one SRD Wolf; the room is attached and nothing
 * has started.
 */
export async function assistedPartyFixture() {
  const base = await setupCharacterRun({}, longsword)
  const { campaign } = base
  const gm = base.owner
  const ariaPlayer = base.player
  const brynPlayer = await createPartyPlayer(base.t, campaign)
  await brynPlayer.join()
  const brynDraft = await base.createCharacter(undefined, brynPlayer.caller)
  const brynCharacter = (
    await brynPlayer.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: brynDraft.draft.id,
      mode: 'create',
      character: { ...brynDraft.character, label: 'Bryn' }
    })
  ).character
  await brynPlayer.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: brynCharacter.id
  })
  await equipAllCharacterItems(base)
  await equipAllItems(brynPlayer.caller, brynCharacter.id)
  // App rolls post to the table chat, which needs a username; every member rolls their own dice.
  for (const [member, username] of [
    [gm, 'GameMaster'],
    [ariaPlayer, 'AriaPlayer']
  ] as const)
    await member.caller.mutation(api.account.updateProfile, { username, bio: null })
  for (const userId of [gm.userId, ariaPlayer.userId, brynPlayer.userId])
    await setAutoRollDice(base.t, userId, true)

  const { definitions, policyIds } = createEncounterInitiativeDefinitions([
    { cadence: 'ENCOUNTER_START', procedure: 'DECLARED_ACTION_ROLL' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...definitions,
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ]
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...srdWolf, subjectKind: 'CREATURE', document: srdWolf })]
  })
  const { version, updatedAt: _updatedAt, ...settings } = await gm.caller.query(
    api.campaigns.playSettings.get,
    { campaignId: campaign.id }
  )
  await gm.caller.mutation(api.campaigns.playSettings.save, {
    ...settings,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: policyIds[0] ?? null,
    initiativeTieDefinitionId: null
  })

  // The Run is created after both assignments so it seats both Characters.
  const blueprint = await gm.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Assisted party journey',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: srdWolf.id }]
  })
  const run = await gm.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actorOf = (characterId: string) => {
    const actor = run.actors.find(
      (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
    )
    if (!actor) throw new Error('A party Character is missing from the Run.')
    return actor.id
  }
  const wolfActor = run.actors.find((actor) => actor.kind === 'CREATURE')
  if (!wolfActor) throw new Error('The Wolf is missing from the Run.')

  const { attackByCharacter, wolfAttackActionId } = await base.t.run(async (ctx) => {
    const attackActionId = async (userId: string, characterId: string) => {
      const facts = await loadCharacterSheetFacts(ctx, userId, characterId, campaign.id)
      const candidates = facts?.ruleEvaluation.facts.actionCandidates.filter(
        (candidate) => candidate.equipment?.grip === 'ONE_HANDED'
      )
      if (candidates?.length !== 1) throw new Error('Expected one one-handed Longsword attack.')
      return candidates[0]!.actionId
    }
    const wolfRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', run.id).eq('id', wolfActor.id)
      )
      .unique()
    if (!wolfRow) throw new Error('Missing the Wolf actor row.')
    const bite = discoverEncounterFeatureActionCapabilities({
      actor: await readTestActor(ctx, wolfRow),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find((candidate) => candidate.mechanicFacts.invocation.triggerCode === 'MELEE_WEAPON_ATTACK')
    if (!bite) throw new Error('Missing the Wolf Bite action.')
    return {
      attackByCharacter: {
        aria: await attackActionId(ariaPlayer.userId, base.character.id),
        bryn: await attackActionId(brynPlayer.userId, brynCharacter.id)
      },
      wolfAttackActionId: bite.actionId
    }
  })
  await attachFixtureRoom(base.t, campaign.id)
  return {
    t: base.t,
    campaign,
    run,
    gm,
    aria: {
      player: ariaPlayer,
      actorId: actorOf(base.character.id),
      attackActionId: attackByCharacter.aria
    },
    bryn: {
      player: brynPlayer,
      actorId: actorOf(brynCharacter.id),
      attackActionId: attackByCharacter.bryn
    },
    wolf: { actorId: wolfActor.id, attackActionId: wolfAttackActionId },
    /** The Run's current version; the room holds the Run (D85), so Convex has it only after a checkpoint. */
    version: async () => {
      await checkpointLiveRoom(campaign.id)
      return base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (query) => query.eq('id', run.id))
          .unique()
        if (!row) throw new Error('Missing the party Run.')
        return row.version
      })
    }
  }
}

export type AssistedParty = Awaited<ReturnType<typeof assistedPartyFixture>>
