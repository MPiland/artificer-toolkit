import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { companionCreature, playerControlFixture, type PlayerControlBite } from '../../tests/fixtures/playerControl'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  committed,
  runRoomParity,
  type RoomParity
} from '../../tests/fixtures/roomConvexParity'

/**
 * Shadow parity (A35-S5, ADR 0035): the same Encounter commands through the Convex-first comparator
 * and through the room-native executor over SQLite, each from its own state, compared after every
 * command. Development and test only: deleted with the protected Convex comparators in S6c.
 *
 * Not driven: Concentration, Cleaving and the Scene commands (see the S5 handoff for why).
 */

const [, , dodge] = SRD_BASIC_ACTION_DEFINITIONS
const BITE_ROLL_ID = '00000000-0000-4000-8000-000000000c95'
const biteFeatureId = wolf.features?.find((feature) => feature.label === 'Bite')?.id

/** A step both paths must commit, so a refusal on both cannot pass for parity. */
const commit = async (parity: RoomParity, ...step: Parameters<RoomParity['step']>) =>
  committed(await parity.step(...step))

async function playControlScenario(
  options: { bite?: PlayerControlBite; promptRolls?: boolean },
  body: (context: {
    base: Awaited<ReturnType<typeof playerControlFixture>>
    parity: RoomParity
    gm: { userId: string; caller: Awaited<ReturnType<typeof playerControlFixture>>['owner']['caller'] }
    player: {
      userId: string
      caller: Awaited<ReturnType<typeof playerControlFixture>>['player']['caller']
    }
    command(): Promise<{ encounterId: string; commandId: string; expectedVersion: number }>
  }) => Promise<void>
) {
  const base = await playerControlFixture(options)
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_BASIC_ACTION_DEFINITIONS
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  const { divergences, report } = await runRoomParity(
    { t: base.t, campaignId: base.campaign.id, encounterId: base.run.id },
    (parity) =>
      body({
        base,
        parity,
        gm: { userId: base.owner.userId, caller: base.owner.caller },
        player: { userId: base.player.userId, caller: base.player.caller },
        command: async () => ({
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await parity.version()
        })
      })
  )
  expect(divergences, report).toEqual([])
}

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
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

describe('room-native Encounter commands match the Convex-first path', () => {
  it('GM tool commands: controllers, reminders, display, initiative, order, round', async () => {
    await playControlScenario({}, async ({ base, parity, gm, command }) => {
      const reminderId = crypto.randomUUID()
      const turnReminderId = crypto.randomUUID()
      await commit(parity, 'grant controller', gm, {
        type: 'UPDATE_ACTOR',
        ...(await command()),
        actorId: base.companion.id,
        controllerUserIds: [base.player.userId]
      })
      await commit(parity, 'hide and damage', gm, {
        type: 'UPDATE_ACTOR',
        ...(await command()),
        actorId: base.lurker.id,
        public: false,
        currentHitPoints: 4,
        tempHitPoints: 2,
        gmNotes: 'Watching the door.'
      })
      await commit(parity, 'health display default', gm, {
        type: 'SET_HEALTH_DISPLAY_DEFAULT',
        ...(await command()),
        level: 'DESCRIPTIVE'
      })
      await commit(parity, 'upsert reminder', gm, {
        type: 'UPSERT_REMINDER',
        ...(await command()),
        reminder: { id: reminderId, label: 'Check rations', timing: 'ROUND_END' }
      })
      await commit(parity, 'remove reminder', gm, {
        type: 'REMOVE_REMINDER',
        ...(await command()),
        reminderId
      })
      await commit(parity, 'upsert turn reminder', gm, {
        type: 'UPSERT_REMINDER',
        ...(await command()),
        reminder: {
          id: turnReminderId,
          label: 'Wolf howls',
          timing: 'TURN_START',
          actorId: base.enemy.id,
          public: true
        }
      })
      await commit(parity, 'set initiative', gm, {
        type: 'SET_INITIATIVE',
        ...(await command()),
        actorId: base.enemy.id,
        initiative: 25,
        manualOrder: null
      })
      await commit(
        parity,
        'roll actor initiative',
        gm,
        { type: 'ROLL_ACTOR_INITIATIVE', ...(await command()), actorId: base.lurker.id },
        [9]
      )
      // The current actor and completed turns keep their places.
      await commit(parity, 'reorder', gm, {
        type: 'REORDER',
        ...(await command()),
        actorIds: [base.companion.id, base.lurker.id, base.enemy.id, base.character.id]
      })
      await commit(parity, 'set round', gm, { type: 'SET_ROUND', ...(await command()), round: 2 })
      await commit(parity, 'replace optional combat rules', gm, {
        type: 'REPLACE_OPTIONAL_COMBAT_RULES',
        ...(await command()),
        definitionIds: []
      })
    })
  }, 120_000)

  it('turn commands: set current actor, advance, previous', async () => {
    await playControlScenario({}, async ({ base, parity, gm, command }) => {
      await commit(parity, 'set current actor', gm, {
        type: 'SET_CURRENT_ACTOR',
        ...(await command()),
        actorId: base.character.id
      })
      await commit(parity, 'advance turn', gm, { type: 'ADVANCE_TURN', ...(await command()) })
      await commit(parity, 'advance turn again', gm, {
        type: 'ADVANCE_TURN',
        ...(await command())
      })
      await commit(parity, 'previous turn', gm, { type: 'PREVIOUS_TURN', ...(await command()) })
      await commit(parity, 'clear current actor', gm, {
        type: 'SET_CURRENT_ACTOR',
        ...(await command()),
        actorId: null
      })
    })
  }, 120_000)

  it('actions: fixed-damage Bite on a Creature and on a Character, Dodge, undo', async () => {
    await playControlScenario({}, async ({ base, parity, gm, player, command }) => {
      await commit(parity, 'grant controller', gm, {
        type: 'UPDATE_ACTOR',
        ...(await command()),
        actorId: base.companion.id,
        controllerUserIds: [base.player.userId]
      })
      await commit(parity, 'bite a Creature', gm, await base.bite(base.companion.id, base.enemy.id))
      await commit(parity, 'revert the bite', gm, {
        type: 'REVERT_LAST_ACTION',
        ...(await command())
      })
      await commit(
        parity,
        'player bites a Character',
        player,
        await base.bite(base.companion.id, base.character.id)
      )
      await commit(parity, 'set current actor', gm, {
        type: 'SET_CURRENT_ACTOR',
        ...(await command()),
        actorId: base.enemy.id
      })
      await commit(parity, 'Dodge', gm, {
        type: 'USE_BASIC_ACTION',
        ...(await command()),
        actorId: base.enemy.id,
        definitionId: dodge!.id,
        allyActorId: null,
        acknowledgedWarnings: []
      })
      await commit(parity, 'revert Dodge', gm, { type: 'REVERT_LAST_ACTION', ...(await command()) })
    })
  }, 120_000)

  it('actions: attack-roll Bite with app dice, then a private enemy roll', async () => {
    await playControlScenario({ bite: 'ATTACK' }, async ({ base, parity, gm, command }) => {
      await commit(
        parity,
        'bite a Creature',
        gm,
        await base.bite(base.companion.id, base.enemy.id),
        [15]
      )
      await commit(parity, 'revert the bite', gm, {
        type: 'REVERT_LAST_ACTION',
        ...(await command())
      })
      await commit(
        parity,
        'bite a Character',
        gm,
        await base.bite(base.companion.id, base.character.id),
        [12]
      )
      if (!biteFeatureId) throw new Error('Missing wolf Bite feature.')
      await commit(
        parity,
        'private enemy roll',
        gm,
        {
          type: 'ROLL_ENEMY_ACTION',
          ...(await command()),
          actorId: base.companion.id,
          featureId: biteFeatureId,
          rollDefinitionId: BITE_ROLL_ID,
          visibility: 'PRIVATE'
        },
        [7]
      )
    })
  }, 120_000)

  it('actions: save-based Bite on a Creature and on a Character', async () => {
    await playControlScenario({ bite: 'SAVE' }, async ({ base, parity, gm, command }) => {
      await commit(parity, 'bite a Creature', gm, await base.bite(base.companion.id, base.enemy.id), [
        8
      ])
      await commit(parity, 'revert the bite', gm, {
        type: 'REVERT_LAST_ACTION',
        ...(await command())
      })
      await commit(
        parity,
        'bite a Character',
        gm,
        await base.bite(base.companion.id, base.character.id),
        [3]
      )
    })
  }, 120_000)

  it('prompted d20: pending attack settled by entered dice, then voided', async () => {
    await playControlScenario(
      { bite: 'ATTACK', promptRolls: true },
      async ({ base, parity, gm, command }) => {
        const asked = await commit(
          parity,
          'bite prompts',
          gm,
          await base.bite(base.companion.id, base.enemy.id)
        )
        const pending = asked.occurrence?.pending
        if (!asked.occurrence || pending?.kind !== 'D20_EVIDENCE')
          throw new Error('Expected a d20 prompt.')
        await commit(parity, 'enter dice', gm, {
          type: 'RESOLVE_RULE_OCCURRENCE',
          ...(await command()),
          occurrenceId: asked.occurrence.occurrenceId,
          expectedOccurrenceVersion: asked.occurrence.occurrenceVersion,
          correlationId: null,
          resolution: {
            kind: 'ENTER_DICE',
            requestId: pending.request.requestId,
            rawFaces: pending.request.rollMode === 'NORMAL' ? [14] : [14, 6],
            rollMode: pending.request.rollMode
          }
        })
        const second = await commit(parity, 'second bite prompts', gm, {
          ...(await base.bite(base.companion.id, base.character.id)),
          acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE']
        })
        if (!second.occurrence) throw new Error('Expected a second prompt.')
        await commit(parity, 'void the prompt', gm, {
          type: 'VOID_RULE_OCCURRENCE',
          ...(await command()),
          occurrenceId: second.occurrence.occurrenceId,
          expectedOccurrenceVersion: second.occurrence.occurrenceVersion
        })
      }
    )
  }, 120_000)

  it('roster commands: reinforce, remove, resources, complete', async () => {
    await playControlScenario({}, async ({ base, parity, gm, command }) => {
      // Reinforcing an active Run places the newcomer among scored participants.
      for (const [actorId, initiative] of [
        [base.companion.id, 20],
        [base.character.id, 15],
        [base.enemy.id, 10],
        [base.lurker.id, 5]
      ] as const)
        await commit(parity, 'score initiative', gm, {
          type: 'SET_INITIATIVE',
          ...(await command()),
          actorId,
          initiative,
          manualOrder: null
        })
      await commit(parity, 'reinforce', gm, {
        type: 'REINFORCE',
        ...(await command()),
        enemy: { kind: 'CUSTOM', label: 'Reinforcement', maxHitPoints: 5 },
        initiative: 3,
        public: true
      })
      await commit(parity, 'remove actor', gm, {
        type: 'REMOVE_ACTOR',
        ...(await command()),
        actorId: base.lurker.id
      })
      if (!biteFeatureId) throw new Error('Missing wolf Bite feature.')
      // The Wolf Bite has no limited resource: both paths must refuse it the same way.
      await parity.step('adjust feature resource', gm, {
        type: 'ADJUST_FEATURE_RESOURCE',
        ...(await command()),
        actorId: base.companion.id,
        featureId: biteFeatureId,
        direction: 'USE'
      })
      await commit(parity, 'complete', gm, { type: 'COMPLETE', ...(await command()) })
    })
  }, 120_000)

  it('START: actor-roll initiative evidence, then the first turns', async () => {
    const base = await fixture()
    const attackingWolf = companionCreature('ATTACK')
    const initiative = createEncounterInitiativeDefinitions([
      { procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' }
    ])
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: initiative.definitions
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...attackingWolf, subjectKind: 'CREATURE', document: attackingWolf })]
    })
    const campaign = await base.owner.caller.mutation(createCampaign, {
      name: 'Parity START fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const { version, updatedAt: _updatedAt, ...settings } = await base.owner.caller.query(
      getSettings,
      { campaignId: campaign.id }
    )
    await base.owner.caller.mutation(saveSettings, {
      ...settings,
      expectedVersion: version,
      automationMode: 'ASSISTED',
      manualReminderMode: 'OFF',
      initiativePolicyDefinitionId: initiative.policyIds[0]!,
      initiativeTieDefinitionId: null
    })
    // Assisted initiative prompts for evidence only while the GM's auto-roll is off.
    await setAutoRollDice(base.t, base.owner.userId, false)
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: campaign.gameSystemId,
      name: 'Parity START target',
      commandId: crypto.randomUUID(),
      enemies: [
        { kind: 'CREATURE', sourceId: wolf.id },
        { kind: 'CREATURE', sourceId: wolf.id }
      ]
    })
    const run = await base.owner.caller.mutation(createRun, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    const gm = { userId: base.owner.userId, caller: base.owner.caller }
    const { divergences, report } = await runRoomParity(
      { t: base.t, campaignId: campaign.id, encounterId: run.id },
      async (parity) => {
        const command = async () => ({
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await parity.version()
        })
        let started = await commit(parity, 'start', gm, { type: 'START', ...(await command()) })
        for (const value of [12, 11]) {
          const pending = started.occurrence?.pending
          if (!started.occurrence || pending?.kind !== 'INITIATIVE_EVIDENCE')
            throw new Error('Missing Assisted initiative evidence.')
          started = await commit(parity, `initiative evidence ${value}`, gm, {
            type: 'RESOLVE_RULE_OCCURRENCE',
            ...(await command()),
            occurrenceId: started.occurrence.occurrenceId,
            expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
            correlationId: null,
            resolution: { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value }
          })
        }
        await commit(parity, 'advance turn', gm, { type: 'ADVANCE_TURN', ...(await command()) })
        await commit(parity, 'advance turn again', gm, {
          type: 'ADVANCE_TURN',
          ...(await command())
        })
      }
    )
    expect(divergences, report).toEqual([])
  }, 120_000)

  it('Disarm: automatic contest won by the initiator', async () => {
    const base = await nativeDisarmFixture()
    const sourceFace = 10
    const targetFace =
      sourceFace + base.contest.initiator.modifier - base.contest.defender.modifier - 1
    const { divergences, report } = await runRoomParity(
      {
        t: base.t,
        campaignId: base.campaign.id,
        encounterId: base.run.id,
        epoch: base.authorityEpoch
      },
      async (parity) => {
        await commit(
          parity,
          'disarm',
          { userId: base.owner.userId, caller: base.owner.caller },
          base.command,
          [sourceFace, targetFace]
        )
      }
    )
    expect(divergences, report).toEqual([])
  }, 120_000)
})
