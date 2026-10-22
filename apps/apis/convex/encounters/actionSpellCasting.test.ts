import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { RITUAL_CAST_REFUSAL } from '@artificer-toolkit/rules-runtime/character/characterSpellCastActions'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterRuleUsageUsed,
  withEncounterRuleUsageUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  fixHeal,
  targetAnyCreatureAtAnyRange
} from '@artificer-toolkit/rules-runtime/testing/fixedHealSpell'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { contactOtherPlane } from '@artificer-toolkit/source-data/srd/spells/contact-other-plane.js'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { cureWounds } from '@artificer-toolkit/source-data/srd/spells/cure-wounds.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { healingWord } from '@artificer-toolkit/source-data/srd/spells/healing-word.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { fly } from '@artificer-toolkit/source-data/srd/spells/fly.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { invisibility } from '@artificer-toolkit/source-data/srd/spells/invisibility.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { srdWolf } from '../../tests/fixtures/srdCreatures'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, components, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  executeSheetInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

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
const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
const normalizeValues = makeFunctionReference<
  'query',
  NodeRuntimeResolveRequestDto,
  NodeRuntimeNormalizeValuesResponseDto
>('authoring/nodeRuntime:normalizeValues')
const executeSheet = makeFunctionReference<'mutation', CharacterSheetExecuteInput, unknown>(
  'characters/sheetCommands:execute'
)

/** A copy of the document whose every row id is new, so variants import beside the original. */
function rekeyed<T>(document: T): T {
  const ids = new Map<string, string>()
  return JSON.parse(JSON.stringify(document), (key, value) => {
    if (key !== 'id' || typeof value !== 'string') return value
    const known = ids.get(value)
    if (known) return known
    const fresh = crypto.randomUUID()
    ids.set(value, fresh)
    return fresh
  })
}

/** An SRD spell on its own ids, exactly as authored: its range and heal are the SRD's. */
function srdSpell(source: SpellAuthored): SpellAuthored {
  const spell = rekeyed(source)
  spell.id = crypto.randomUUID()
  return spell
}

/** A Cure Wounds variant that needs no Scene geometry; `edit` reshapes the copy (`fixHeal` fixes its heal). */
function healSpell(label: string, edit: (spell: SpellAuthored) => void): SpellAuthored {
  const spell = srdSpell(cureWounds)
  spell.label = label
  targetAnyCreatureAtAnyRange(spell)
  edit(spell)
  return spell
}

type SetupOptions = {
  /** One pact slot of this level (Pact Magic) instead of Wizard slots (two 1st, one 2nd). */
  pactLevel?: number
  /** Standard slots in place of the Wizard's two 1st and one 2nd. */
  slots?: { spellLevel: number; slotCount: number }[]
  /** Slots the Sheet has already spent before the Encounter, in order. */
  spentSlots?: readonly string[]
  /** Class spells: known; those in `prepared` are also prepared. */
  known: readonly SpellAuthored[]
  prepared?: readonly SpellAuthored[]
  /** Feature-granted spells with the grant attributes. */
  granted?: readonly {
    spell: SpellAuthored
    attributes: readonly (
      | 'PREPARED'
      | 'RITUAL'
      | 'CAST_AT_WILL'
      | 'LIMITED_USE'
      | 'CAST_AT_LEVEL'
    )[]
    /** The grant's fixed uses per Long Rest, for a LIMITED_USE or CAST_AT_LEVEL grant. */
    uses?: number
    castAtLevel?: number
  }[]
  /** Seats an SRD Wolf and a second player's Character beside the target. */
  withOthers?: boolean
  /** Replaces the seated Wolf's creature type, by its System code. */
  wolfTypeCode?: string
}

async function setup(options: SetupOptions) {
  const spellcasting = {
    ...wizard.spellcasting!,
    // Pact Magic is the Wizard's spellbook casting recharging on a Short Rest, with one 1st-level slot.
    ...(options.pactLevel ? { charges: warlock.spellcasting!.charges } : {}),
    spellLimits: [
      {
        classLevel: 1,
        slots: options.pactLevel
          ? [{ spellLevel: options.pactLevel, slotCount: 1 }]
          : (options.slots ?? [
              { spellLevel: 1, slotCount: 2 },
              { spellLevel: 2, slotCount: 1 }
            ]),
        cantripsLimit: 0
      }
    ]
  }
  const base = await readyCharacterFixture({
    spellcasting,
    features: options.granted?.length
      ? [
          {
            id: crypto.randomUUID(),
            label: 'Granted Magic',
            description: '',
            availableAtLevel: 1,
            order: 0,
            grants: {
              spells: options.granted.map(({ spell, attributes, uses, castAtLevel }, order) => ({
                id: crypto.randomUUID(),
                grantKind: 'SPELL_GRANT' as const,
                selectionKind: 'GRANTED' as const,
                scalingKind: 'NONE' as const,
                authoringModeKind: 'SELECTED' as const,
                spellIds: [spell.id],
                attributes: [...attributes],
                ...(castAtLevel === undefined ? {} : { castAtLevel }),
                ...(uses === undefined
                  ? {}
                  : {
                      charges: {
                        id: crypto.randomUUID(),
                        resetKind: 'LONG_REST' as const,
                        limitKind: 'FIXED_AMOUNT' as const,
                        scalingKind: 'NONE' as const,
                        amount: uses
                      }
                    }),
                order
              }))
            }
          }
        ]
      : []
  })
  for (const user of [base.owner, base.other]) await setAutoRollDice(base.t, user.userId, true)
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [...options.known, ...(options.granted?.map(({ spell }) => spell) ?? [])].map(
      (spell) =>
        importedSubject({
          subjectKind: 'SPELL',
          ...spell,
          document: { ...spell, classIds: [base.baseClass.id] }
        })
    )
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  let characterVersion = 1
  for (const [type, spells] of [
    ['SET_KNOWN_SPELLS', options.known],
    ['SET_PREPARED_SPELLS', options.prepared ?? options.known]
  ] as const) {
    await base.owner.caller.mutation(executeSheet, {
      id: character.id,
      command: {
        type,
        commandId: crypto.randomUUID(),
        expectedVersion: characterVersion,
        classId: base.baseClass.id,
        spellIds: spells.map(({ id }) => id)
      }
    })
    characterVersion += 1
  }
  // The commit sets full hit points; the healing spells need room to heal.
  await base.owner.caller.mutation(executeSheet, {
    id: character.id,
    command: {
      type: 'SET_HIT_POINTS',
      commandId: crypto.randomUUID(),
      expectedVersion: characterVersion,
      current: 1,
      temp: 0
    }
  })
  characterVersion += 1
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_CONCENTRATION_DEFINITIONS
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  for (const slotKey of options.spentSlots ?? []) {
    await base.owner.caller.mutation(executeSheet, {
      id: character.id,
      command: {
        type: 'USE_SPELL_SLOT',
        commandId: crypto.randomUUID(),
        expectedVersion: characterVersion,
        slotKey
      }
    })
    characterVersion += 1
  }
  const gm = base.other
  const player = base.owner
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [gm.userId, player.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const campaign = await gm.caller.mutation(createCampaign, {
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
    {
      ownerUserId: gm.userId,
      playerUserId: player.userId,
      campaignId: campaign.id
    }
  )
  await player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: character.id
  })
  let allyCharacterId: string | null = null
  if (options.withOthers) {
    const allyPlayer = await createPartyPlayer(base.t, campaign)
    await allyPlayer.join()
    const allyDraft = await base.createCharacter(undefined, allyPlayer.caller)
    const ally = (
      await allyPlayer.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: allyDraft.draft.id,
        mode: 'create',
        character: { ...allyDraft.character, label: 'Ally' }
      })
    ).character
    await allyPlayer.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: campaign.id,
      characterId: ally.id
    })
    await allyPlayer.caller.mutation(executeSheet, {
      id: ally.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        current: 1,
        temp: 0
      }
    })
    const wolfTypeId = options.wolfTypeCode
      ? srdSystemRecord.creatureTypes?.find((type) => type.code === options.wolfTypeCode)?.id
      : srdWolf.creatureTypeId
    if (!wolfTypeId) throw new Error('Missing creature type.')
    const seatedWolf = { ...srdWolf, creatureTypeId: wolfTypeId }
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...seatedWolf, subjectKind: 'CREATURE', document: seatedWolf })]
    })
    allyCharacterId = ally.id
  }
  const blueprint = await gm.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Spell casting',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'Target', maxHitPoints: 3 },
      ...(options.withOthers ? [{ kind: 'CREATURE' as const, sourceId: srdWolf.id }] : [])
    ]
  })
  const run = await gm.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find(
    (value) => value.kind === 'CHARACTER' && value.sourceId === character.id
  )
  const target = run.actors.find((value) => value.kind === 'CUSTOM')
  const wolf = run.actors.find((value) => value.kind === 'CREATURE')
  const ally = run.actors.find(
    (value) => value.kind === 'CHARACTER' && value.sourceId === allyCharacterId
  )
  if (!actor || !target || (options.withOthers && (!wolf || !ally)))
    throw new Error('Missing Encounter actors.')
  await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, ...run.actors.filter((value) => value.id !== actor.id).map((value) => value.id)]
    )
  })
  await attachFixtureRoom(base.t, campaign.id)
  return {
    ...base,
    gm,
    player,
    campaign,
    character,
    run,
    actor,
    target,
    wolf,
    ally,
    allyCharacterId
  }
}

type Fixture = Awaited<ReturnType<typeof setup>>

/** The spell action choices the Character is offered at the Run version, as the given member reads them. */
async function spellChoices(
  fixture: Fixture,
  expectedVersion: number,
  reader: Fixture['gm'] = fixture.gm
) {
  const choices = await reader.caller.query(actionChoices, {
    encounterId: fixture.run.id,
    expectedVersion,
    actorId: fixture.actor.id
  })
  return (choices?.actions ?? []).filter(({ id }) => id.startsWith('spell-cast:'))
}

function castCommand(
  fixture: Fixture,
  actionId: string,
  expectedVersion: number,
  commandId = crypto.randomUUID(),
  targetActorId = fixture.actor.id,
  acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = []
) {
  return {
    type: 'RESOLVE_ACTION' as const,
    acceptedWieldConflict: null,
    acknowledgedWarnings,
    encounterId: fixture.run.id,
    commandId,
    expectedVersion,
    actorId: fixture.actor.id,
    target: { kind: 'ACTOR' as const, actorId: targetActorId },
    actionId,
    optionalCombatIntent: null,
    sceneContext: null
  } satisfies ResolveEncounterActionInputDto
}

async function choiceId(
  fixture: Fixture,
  label: string,
  expectedVersion: number,
  reader: Fixture['gm'] = fixture.gm
) {
  const choice = (await spellChoices(fixture, expectedVersion, reader)).find(
    (value) => value.label === label
  )
  if (!choice) throw new Error(`The Character is not offered ${label}.`)
  return choice.id
}

function revert(fixture: Fixture, expectedVersion: number) {
  return executeInRoom(fixture.gm.caller, {
    command: {
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion
    }
  })
}

/** A Character's stored state, after the room publishes what it holds (D85). */
async function storedCharacter(fixture: Fixture, characterId = fixture.character.id) {
  await checkpointLiveRoom(fixture.campaign.id)
  const row = await fixture.t.run((ctx) => readCharacterRow(ctx, characterId))
  if (!row) throw new Error('Missing Character row.')
  return { row, record: readCharacterRecord(row) }
}

/** The Run's maintained-effect records, as the owner and definition they are kept under. */
async function maintainedEffects(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  const rows = await fixture.t.run((ctx) =>
    ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) => q.eq('encounterId', fixture.run.id))
      .take(16)
  )
  return rows.map(({ id, ownerActorId, maintenanceDefinitionId }) => ({
    id,
    ownerActorId,
    maintenanceDefinitionId
  }))
}

async function concentrationCasterIds(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  const run = await fixture.t.run((ctx) =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
      .unique()
  )
  return run?.concentrationCasterCharacterIds
}

/** The Character's own active-effect rows (a Character holder keeps its grants there), by maintained effect. */
async function characterActiveEffects(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  const rows = await fixture.t.run((ctx) =>
    ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) =>
        q.eq('characterId', fixture.character.id)
      )
      .take(16)
  )
  return rows.map(({ maintainedEffectStateId }) => ({ maintainedEffectStateId }))
}

/** The Run's active-effect rows, as the target and maintained effect they are held under. */
async function activeEffects(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  const rows = await fixture.t.run((ctx) =>
    ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', fixture.run.id)
      )
      .take(16)
  )
  return rows.map(({ targetActorId, maintainedEffectStateId }) => ({
    targetActorId,
    maintainedEffectStateId
  }))
}

/** An SRD Concentration spell on its own ids, aimed at one creature at any distance (no Scene geometry). */
function concentrationSpell(source: SpellAuthored): SpellAuthored {
  const spell = srdSpell(source)
  targetAnyCreatureAtAnyRange(spell)
  return spell
}

/** Advances turns until `actorId` is the current actor, as the Run's turn order has it. */
async function advanceToTurnOf(
  fixture: Fixture,
  from: Awaited<ReturnType<typeof advanceTurn>>,
  actorId: string
) {
  let result = from
  for (let turns = 0; result.projection.currentActorId !== actorId; turns += 1) {
    if (turns > fixture.run.actors.length) throw new Error('The actor never takes a turn.')
    result = await advanceTurn(fixture, result.projection.version)
  }
  return result
}

function advanceTurn(fixture: Fixture, expectedVersion: number) {
  return executeInRoom(fixture.gm.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion
    }
  })
}

/** A Creature's current hit points, after the room publishes what it holds. */
async function creatureHitPoints(fixture: Fixture, actorId: string) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', fixture.run.id).eq('id', actorId))
      .unique()
    if (!row) throw new Error('Creature actor is unavailable.')
    const actor = await readTestActor(ctx, row)
    if (actor.kind !== 'CREATURE') throw new Error('Expected a Creature actor.')
    return actor.currentHitPoints
  })
}

/** Releases the room so the direct write below is what its next command hydrates. */
async function wound(fixture: Fixture, actorId: string, currentHitPoints: number) {
  await closeRoom(fixture.campaign.id)
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', fixture.run.id).eq('id', actorId))
      .unique()
    if (!row) throw new Error('Creature actor is unavailable.')
    const actor = await readTestActor(ctx, row)
    await writeRunActor(
      { db: createConvexEncounterStore(ctx) },
      row._id,
      encounterRunActorStateSchema.parse({ ...actor, currentHitPoints })
    )
  })
}

/** How much of an allowance (Action, Bonus Action, Reaction) the Character actor has spent this turn. */
async function allowanceUsed(fixture: Fixture, definitionId: string) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
      )
      .unique()
    if (!row) throw new Error('Character actor is unavailable.')
    return encounterRuleUsageUsed(await readTestActor(ctx, row), definitionId)
  })
}

/** The Sheet's spell-source pool of the granted Mend ("Mend uses"), after the room publishes its state. */
async function mendUses(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
    id: fixture.character.id
  })
  const pools = sheet?.resources.items.filter((item) => item.label === 'Mend uses') ?? []
  const [pool] = pools
  if (!pool || pools.length > 1) throw new Error('Expected exactly one Mend uses pool.')
  return pool
}

/** Releases the room so the direct write below is what its next command hydrates. */
async function resetActionAllowance(fixture: Fixture) {
  await closeRoom(fixture.campaign.id)
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
      )
      .unique()
    if (!row) throw new Error('Character actor is unavailable.')
    const actor = await readTestActor(ctx, row)
    const reset = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 0)
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, reset)
  })
}

const EXHAUSTED_CAST = 'That action is no longer available; refresh and choose again.'
const REPLACED_CONCENTRATION = "Undo can't restore a replaced maintained effect; adjust manually."
const SHEET_CHANGED = /'s Sheet changed after this action; adjust manually\./

describe('Character spell casting in an Encounter', () => {
  useLocalRoomWorker()

  it('offers a cast once per spell it can execute, never a granted ritual or an unprepared spell', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const grantedRite = healSpell('Granted Rite', (spell) => fixHeal(spell, 1))
    const unprepared = healSpell('Unprepared', (spell) => fixHeal(spell, 1))
    // Its heal scales per cast level: it is offered once for each slot level the Character can cast it at.
    const scaling = srdSpell(cureWounds)
    const fixture = await setup({
      known: [mend, unprepared, scaling],
      prepared: [mend, scaling],
      granted: [
        { spell: grantedRite, attributes: ['RITUAL'] },
        { spell: fireBolt, attributes: ['CAST_AT_WILL'] }
      ]
    })
    const choices = await spellChoices(fixture, 0)
    // A spell granted as a ritual is not offered; an unprepared spell is refused as the Sheet refuses it.
    expect(choices.map(({ label }) => label).sort()).toEqual(
      ['Cure Wounds (1st level)', 'Cure Wounds (2nd level)', 'Fire Bolt', 'Mend (1st level)'].sort()
    )
    expect(new Set(choices.map(({ id }) => id)).size).toBe(choices.length)
  }, 60000)

  it('refuses a granted ritual by name, listing it unavailable and spending no slot (D171)', async () => {
    const grantedRite = healSpell('Granted Rite', (spell) => fixHeal(spell, 1))
    const fixture = await setup({
      known: [],
      granted: [{ spell: grantedRite, attributes: ['RITUAL'] }]
    })
    const choices = await fixture.gm.caller.query(actionChoices, {
      encounterId: fixture.run.id,
      expectedVersion: 0,
      actorId: fixture.actor.id
    })
    expect(choices?.actions.filter(({ id }) => id.startsWith('spell-cast:'))).toEqual([])
    const [ritual] = choices?.unavailableActions ?? []
    expect(ritual).toMatchObject({
      label: 'Granted Rite (1st level) (ritual)',
      reason: RITUAL_CAST_REFUSAL
    })

    await expect(
      executeInRoom(fixture.player.caller, { command: castCommand(fixture, ritual!.id, 0) })
    ).rejects.toThrow(RITUAL_CAST_REFUSAL)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()
  }, 60000)

  it('offers a spell that does not read its cast level at its own level only, beside one that does at each owned higher level', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    // Counterspell compares its slot with the cast spell's level, so it is cast with any slot of 3rd level or more.
    const counter = srdSpell(counterspell)
    const fixture = await setup({
      known: [mend, counter],
      prepared: [mend, counter],
      slots: [
        { spellLevel: 1, slotCount: 1 },
        { spellLevel: 3, slotCount: 1 },
        { spellLevel: 4, slotCount: 1 }
      ]
    })
    expect((await spellChoices(fixture, 0)).map(({ label }) => label).sort()).toEqual([
      'Counterspell (3rd level)',
      'Counterspell (4th level)',
      'Mend (1st level)'
    ])
  }, 60000)

  it('shows each cast choice its spell components and enforces none of them (D171)', async () => {
    const rite = healSpell('Rite', (spell) => {
      spell.components = ['VERBAL', 'SOMATIC', 'MATERIAL']
      spell.materialDescription = 'a pearl worth at least 100 gp'
    })
    const whisper = healSpell('Whisper', (spell) => {
      spell.components = ['VERBAL']
      spell.materialDescription = undefined
    })
    const fixture = await setup({ known: [rite, whisper] })
    const choices = await spellChoices(fixture, 0)
    const componentsOf = (label: string) =>
      choices.find((choice) => choice.label === label)?.componentsLabel
    expect(componentsOf('Rite (1st level)')).toBe('V, S, M (a pearl worth at least 100 gp)')
    expect(componentsOf('Whisper (1st level)')).toBe('V')

    // The material component is neither carried nor checked: the cast resolves and spends its slot.
    const cast = await executeInRoom(fixture.player.caller, {
      command: castCommand(fixture, await choiceId(fixture, 'Rite (1st level)', 0), 0)
    })
    expect(cast.occurrence?.status).toBe('COMPLETE')
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 1 }
    ])
  }, 60000)

  it('spends the slot with the outcome in one Character version and GM undo restores both', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const fixture = await setup({ known: [mend] })
    const before = await storedCharacter(fixture)
    expect(before.record.state.hitpoints.current).toBe(1)
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0)

    const cast = await executeInRoom(fixture.player.caller, {
      command: castCommand(fixture, actionId, 0)
    })
    expect(cast.occurrence?.status).toBe('COMPLETE')
    const cast1 = await storedCharacter(fixture)
    expect(cast1.record.state.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
    expect(cast1.record.state.hitpoints.current).toBe(2)
    expect(cast1.row.play.streamVersion).toBe(before.row.play.streamVersion + 1)

    const undone = await revert(fixture, cast.projection.version)
    expect(undone.projection.version).toBe(cast.projection.version + 1)
    const after = await storedCharacter(fixture)
    expect(after.record.state.spellSlots).toBeUndefined()
    expect(after.record.state.hitpoints.current).toBe(1)
  }, 60000)

  it('spends a pact slot, then stops offering and refuses the exhausted cast', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const fixture = await setup({ pactLevel: 1, known: [mend] })
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0)
    const cast = await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, actionId, 0)
    })
    expect(cast.occurrence?.status).toBe('COMPLETE')
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'PACT', used: 1 }
    ])

    await resetActionAllowance(fixture)
    const version = cast.projection.version
    expect(await spellChoices(fixture, version)).toEqual([])
    await expect(
      executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, actionId, version)
      })
    ).rejects.toThrow(EXHAUSTED_CAST)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'PACT', used: 1 }
    ])
  }, 60000)

  it('casts a 1st-level spell with a 3rd-level pact slot and spends that pact slot, undone to nothing', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const fixture = await setup({ pactLevel: 3, known: [mend] })
    expect((await spellChoices(fixture, 0)).map(({ label }) => label)).toEqual(['Mend (1st level)'])
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0)
    const cast = await executeInRoom(fixture.player.caller, {
      command: castCommand(fixture, actionId, 0)
    })
    expect(cast.occurrence?.status).toBe('COMPLETE')
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'PACT', used: 1 }
    ])
    await revert(fixture, cast.projection.version)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()
  }, 60000)

  it('offers Fireball at its own level and every higher level it scales to that the Character has a slot for', async () => {
    const slots = [3, 4, 5, 6, 7, 8, 9].map((spellLevel) => ({ spellLevel, slotCount: 1 }))
    const fixture = await setup({ slots, known: [fireball] })
    expect((await spellChoices(fixture, 0)).map(({ label }) => label)).toEqual([
      'Fireball (3rd level)',
      'Fireball (4th level)',
      'Fireball (5th level)',
      'Fireball (6th level)',
      'Fireball (7th level)',
      'Fireball (8th level)',
      'Fireball (9th level)'
    ])
  }, 60000)

  it("lists a spell on the Sheet at the levels of the Character's owned slots, standard and Pact Magic", async () => {
    const readLevels = async (fixture: Fixture) =>
      (await fixture.player.caller.query(api.characters.sheet.get, {
        id: fixture.character.id
      }))!.spells.activeGroups.map(({ level }) => level)
    const standard = await setup({
      slots: [3, 5, 9].map((spellLevel) => ({ spellLevel, slotCount: 1 })),
      known: [fireball]
    })
    expect(await readLevels(standard)).toEqual([3, 5, 9])
    const pact = await setup({ pactLevel: 5, known: [fireball] })
    expect(await readLevels(pact)).toEqual([3, 5])
  }, 60000)

  it('offers prepared, always prepared and granted spells and not an unprepared one', async () => {
    const prepared = healSpell('Prepared', (spell) => fixHeal(spell, 1))
    const unprepared = healSpell('Unprepared', (spell) => fixHeal(spell, 1))
    const always = healSpell('Always', (spell) => fixHeal(spell, 1))
    const granted = healSpell('Granted', (spell) => fixHeal(spell, 1))
    const fixture = await setup({
      known: [prepared, unprepared],
      prepared: [prepared],
      granted: [
        { spell: always, attributes: ['PREPARED'] },
        { spell: granted, attributes: [] }
      ]
    })
    expect((await spellChoices(fixture, 0)).map(({ label }) => label).sort()).toEqual([
      'Always (1st level)',
      'Granted (1st level)',
      'Prepared (1st level)'
    ])
  }, 60000)

  it('heals a Creature and an ally with the caster\u2019s slot, not the caster', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 2))
    const fixture = await setup({ known: [mend], withOthers: true })
    const { wolf, allyCharacterId } = fixture
    if (!wolf || !allyCharacterId) throw new Error('Missing the Wolf or the ally.')
    const ally = fixture.ally
    if (!ally) throw new Error('Missing the ally actor.')
    await wound(fixture, wolf.id, 3)
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0)

    const onWolf = await executeInRoom(fixture.player.caller, {
      command: castCommand(fixture, actionId, 0, crypto.randomUUID(), wolf.id)
    })
    expect(onWolf.occurrence?.status).toBe('COMPLETE')
    expect(await creatureHitPoints(fixture, wolf.id)).toBe(5)
    expect((await storedCharacter(fixture)).record.state.hitpoints.current).toBe(1)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 1 }
    ])

    await resetActionAllowance(fixture)
    const onAlly = await executeInRoom(fixture.player.caller, {
      command: castCommand(
        fixture,
        actionId,
        onWolf.projection.version,
        crypto.randomUUID(),
        ally.id
      )
    })
    expect(onAlly.occurrence?.status).toBe('COMPLETE')
    expect((await storedCharacter(fixture, allyCharacterId)).record.state.hitpoints.current).toBe(3)
    expect((await storedCharacter(fixture)).record.state.hitpoints.current).toBe(1)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 2 }
    ])
    expect(
      (await storedCharacter(fixture, allyCharacterId)).record.state.spellSlots
    ).toBeUndefined()
  }, 90000)

  it('appends the spent slot after the slots already used and restores only that one on undo', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const fixture = await setup({ known: [mend], spentSlots: ['STANDARD:2'] })
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0)
    const cast = await executeInRoom(fixture.player.caller, {
      command: castCommand(fixture, actionId, 0)
    })
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:2', used: 1 },
      { slotKey: 'STANDARD:1', used: 1 }
    ])
    await revert(fixture, cast.projection.version)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:2', used: 1 }
    ])
  }, 60000)

  it('starts Concentration, ends the previous one, and undoes only a start that replaced nothing', async () => {
    const concentration = (label: string) =>
      healSpell(label, (spell) => {
        fixHeal(spell, 1)
        spell.attributes = ['CONCENTRATION']
        const path = spell.effects?.[0]?.paths?.[0]
        if (!path || !('resultBlock' in path)) throw new Error('Expected a result block.')
        path.resultBlock = {
          ...path.resultBlock,
          maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
          duration: {
            id: crypto.randomUUID(),
            durationKind: 'ROUND',
            amount: 3
          },
          lifecycle: { recurringKind: 'START_OF_TURN' }
        }
      })
    const focus = concentration('Focus')
    const steady = concentration('Steady')
    const fixture = await setup({ known: [focus, steady] })
    const focusId = await choiceId(fixture, 'Focus (1st level)', 0)

    const started = await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, focusId, 0)
    })
    expect(started.occurrence?.status).toBe('COMPLETE')
    expect(await concentrationCasterIds(fixture)).toEqual([fixture.character.id])
    expect(await maintainedEffects(fixture)).toEqual([
      {
        id: expect.any(String),
        ownerActorId: fixture.actor.id,
        maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      }
    ])

    // Undoing a start that ended nothing removes the Concentration and returns the slot.
    const undone = await revert(fixture, started.projection.version)
    expect(await concentrationCasterIds(fixture)).toEqual([])
    expect(await maintainedEffects(fixture)).toEqual([])
    expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()

    // A second Concentration spell replaces the first (D99); the replacement has no GM undo.
    await resetActionAllowance(fixture)
    const first = await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, focusId, undone.projection.version)
    })
    const [firstConcentration] = await maintainedEffects(fixture)
    await resetActionAllowance(fixture)
    const steadyId = await choiceId(fixture, 'Steady (1st level)', first.projection.version)
    const replaced = await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, steadyId, first.projection.version)
    })
    expect(replaced.occurrence?.status).toBe('COMPLETE')
    expect(await concentrationCasterIds(fixture)).toEqual([fixture.character.id])
    // Exactly one record remains, the replacement's, under the same owner and definition.
    const [replacement, ...others] = await maintainedEffects(fixture)
    expect(others).toEqual([])
    expect(replacement).toEqual({
      id: expect.any(String),
      ownerActorId: fixture.actor.id,
      maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    })
    expect(replacement?.id).not.toBe(firstConcentration?.id)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 2 }
    ])
    await expect(revert(fixture, replaced.projection.version)).rejects.toThrow(
      REPLACED_CONCENTRATION
    )
  }, 120000)

  it('derives Concentration from the CONCENTRATION attribute alone, and not for a spell without it', async () => {
    const author = (label: string, attributes: SpellAuthored['attributes']) =>
      healSpell(label, (spell) => {
        fixHeal(spell, 1)
        spell.attributes = attributes
        const path = spell.effects?.[0]?.paths?.[0]
        if (!path || !('resultBlock' in path)) throw new Error('Expected a result block.')
        path.resultBlock = {
          ...path.resultBlock,
          duration: { id: crypto.randomUUID(), durationKind: 'ROUND', amount: 3 },
          lifecycle: { recurringKind: 'START_OF_TURN' }
        }
      })
    const focus = author('Focus', ['CONCENTRATION'])
    const plain = author('Plain', [])
    const fixture = await setup({ known: [focus, plain] })
    // The Spell node map accepts the author's document as written: it clears nothing and adds no maintenance.
    const normalized = await fixture.gm.caller.query(normalizeValues, {
      mapId: 'spell',
      systemId: focus.systemId,
      values: { ...focus, classIds: [fixture.baseClass.id] }
    })
    expect(normalized.clearedPaths).toEqual([])
    expect(JSON.stringify(normalized.values)).not.toContain('maintenanceDefinitionId')

    const plainId = await choiceId(fixture, 'Plain (1st level)', 0)
    const cast = await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, plainId, 0)
    })
    expect(cast.occurrence?.status).toBe('COMPLETE')
    expect(await maintainedEffects(fixture)).toEqual([])
    expect(await concentrationCasterIds(fixture)).toEqual([])

    await resetActionAllowance(fixture)
    const focusId = await choiceId(fixture, 'Focus (1st level)', cast.projection.version)
    await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, focusId, cast.projection.version)
    })
    expect(await concentrationCasterIds(fixture)).toEqual([fixture.character.id])
    expect(await maintainedEffects(fixture)).toEqual([
      {
        id: expect.any(String),
        ownerActorId: fixture.actor.id,
        maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      }
    ])
  }, 120000)

  describe('Hold Person', () => {
    const SLOTS = [
      { spellLevel: 2, slotCount: 2 },
      { spellLevel: 3, slotCount: 2 }
    ]
    // Hold Person affects only a Humanoid and the SRD Wolf is a Beast, so the GM overrides the warning.
    const NOT_A_HUMANOID: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [
      'TARGET_CREATURE_TYPE_EXCLUDED'
    ]

    async function castFlyThenHoldPerson() {
      const flight = concentrationSpell(fly)
      const hold = concentrationSpell(holdPerson)
      // A Custom actor has no saving throws; the SRD Wolf is the target that rolls the Wisdom save.
      const fixture = await setup({ known: [flight, hold], slots: SLOTS, withOthers: true })
      const wolf = fixture.wolf
      if (!wolf) throw new Error('Missing the Wolf.')
      const flyId = await choiceId(fixture, 'Fly (3rd level)', 0)
      const flying = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, flyId, 0)
      })
      expect(flying.occurrence?.status).toBe('COMPLETE')
      expect(await characterActiveEffects(fixture)).toHaveLength(1)
      const [flyConcentration] = await maintainedEffects(fixture)
      expect(flyConcentration?.maintenanceDefinitionId).toBe(
        SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      )

      // Every d20 lands on 1: the target fails its Wisdom save against the caster's DC.
      await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: 1 })
      await resetActionAllowance(fixture)
      const holdId = await choiceId(fixture, 'Hold Person (2nd level)', flying.projection.version)
      const held = await executeInRoom(fixture.gm.caller, {
        command: castCommand(
          fixture,
          holdId,
          flying.projection.version,
          undefined,
          wolf.id,
          NOT_A_HUMANOID
        )
      })
      return { fixture, wolf, flyId, flyConcentration, held }
    }

    it('replaces Fly, leaves the target Paralyzed, and ends the condition on a successful repeat save', async () => {
      const { fixture, wolf, flyConcentration, held } = await castFlyThenHoldPerson()
      expect(held.occurrence?.status).toBe('COMPLETE')
      expect(await concentrationCasterIds(fixture)).toEqual([fixture.character.id])
      const [replacement, ...others] = await maintainedEffects(fixture)
      expect(others).toEqual([])
      expect(replacement?.id).not.toBe(flyConcentration?.id)
      // Fly's grant ended with its Concentration; the Paralyzed condition is the only effect left.
      expect(await characterActiveEffects(fixture)).toEqual([])
      expect(await activeEffects(fixture)).toEqual([
        { targetActorId: wolf.id, maintainedEffectStateId: replacement?.id }
      ])

      // The Wolf's turn ends while its save keeps failing: the condition holds.
      const targetTurn = await advanceToTurnOf(fixture, held, wolf.id)
      const failedRepeat = await advanceTurn(fixture, targetTurn.projection.version)
      expect(failedRepeat.occurrence?.status).toBe('COMPLETE')
      expect(await activeEffects(fixture)).toHaveLength(1)

      // A natural 20 (raw die 19) on the next end-of-turn save ends the condition, and Concentration with it.
      await queueRoomRolls(fixture.campaign.id, { rolls: [14, 14], repeat: 9 })
      const targetAgain = await advanceToTurnOf(fixture, failedRepeat, wolf.id)
      const saved = await advanceTurn(fixture, targetAgain.projection.version)
      expect(saved.occurrence?.status).toBe('COMPLETE')
      expect(await activeEffects(fixture)).toEqual([])
      expect(await characterActiveEffects(fixture)).toEqual([])
      expect(await maintainedEffects(fixture)).toEqual([])
    }, 180000)

    it('is dropped with its condition when the next Concentration spell is cast', async () => {
      const { fixture, flyId, held } = await castFlyThenHoldPerson()
      expect(await activeEffects(fixture)).toHaveLength(1)
      await resetActionAllowance(fixture)
      const recast = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, flyId, held.projection.version)
      })
      expect(recast.occurrence?.status).toBe('COMPLETE')
      expect(await concentrationCasterIds(fixture)).toEqual([fixture.character.id])
      const [flight, ...others] = await maintainedEffects(fixture)
      expect(others).toEqual([])
      // The Paralyzed condition ended with the Hold Person Concentration; only Fly's grant remains.
      expect(await activeEffects(fixture)).toEqual([])
      expect(await characterActiveEffects(fixture)).toEqual([
        { maintainedEffectStateId: flight?.id }
      ])
    }, 180000)
  })

  describe('Invisibility ends on its holder’s attack roll or spell cast (SPELLS-27.1)', () => {
    const invisibleId = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'INVISIBLE'
    )?.id

    async function conditionIds(fixture: Fixture) {
      const { record } = await storedCharacter(fixture)
      return (record.state.conditions ?? []).map((entry) => entry.conditionTypeId)
    }

    it('grants advantage on the roll, then ends the effect, its condition and its Concentration; a GM undo gives all three back', async () => {
      const unseen = concentrationSpell(invisibility)
      const bolt = srdSpell(fireBolt)
      targetAnyCreatureAtAnyRange(bolt)
      const fixture = await setup({
        known: [unseen],
        granted: [{ spell: bolt, attributes: ['CAST_AT_WILL'] }],
        withOthers: true
      })
      const wolf = fixture.wolf
      if (!wolf || !invisibleId) throw new Error('Missing the Wolf or the Invisible condition.')

      const invisibleCast = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, await choiceId(fixture, 'Invisibility (2nd level)', 0), 0)
      })
      expect(invisibleCast.occurrence?.status).toBe('COMPLETE')
      const [concentration, ...others] = await maintainedEffects(fixture)
      expect(others).toEqual([])
      expect(await characterActiveEffects(fixture)).toEqual([
        { maintainedEffectStateId: concentration?.id }
      ])
      expect(await conditionIds(fixture)).toContain(invisibleId)

      // The caster rolls by hand, so the attack shows as a pending d20 while the effect still holds.
      for (const user of [fixture.owner, fixture.other])
        await setAutoRollDice(fixture.t, user.userId, false)
      await invalidateRoomInputs(fixture.campaign.id, ['PREFERENCES'])
      await resetActionAllowance(fixture)
      const attacked = await executeInRoom(fixture.gm.caller, {
        command: castCommand(
          fixture,
          await choiceId(fixture, 'Fire Bolt', invisibleCast.projection.version),
          invisibleCast.projection.version,
          undefined,
          wolf.id
        )
      })
      const pending = attacked.occurrence?.pending
      if (attacked.occurrence?.status !== 'PENDING' || pending?.kind !== 'D20_EVIDENCE')
        throw new Error('Expected the caster’s attack roll.')
      expect(pending.request).toMatchObject({ rollMode: 'ADVANTAGE' })
      expect(pending.request.derivedRollModeReasons).toContain('Unseen attacker')
      expect(await characterActiveEffects(fixture)).toHaveLength(1)

      // The caster rolls each pending die with the app and settles it; a hit leaves its damage dice to
      // roll too, and the effect ends when the action completes. Queued values are zero-based die indices: 19 is a natural 20, 9 the top of a d10.
      await queueRoomRolls(fixture.campaign.id, { rolls: [19], repeat: 9 })
      let rolled = attacked
      for (let step = 0; step < 3 && rolled.occurrence?.status === 'PENDING'; step += 1) {
        const awaiting = rolled.occurrence.pending
        if (awaiting?.kind !== 'D20_EVIDENCE' && awaiting?.kind !== 'ACTION_OUTCOME_EVIDENCE')
          throw new Error('Expected a roll for the caster.')
        const dice = await executeInRoom(fixture.gm.caller, {
          command: {
            type: 'ROLL_RULE_EVIDENCE',
            encounterId: fixture.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: awaiting.encounterVersion,
            occurrenceId: awaiting.occurrenceId,
            expectedOccurrenceVersion: awaiting.occurrenceVersion,
            requestId: awaiting.request.requestId,
            rollMode: null
          }
        })
        if (!dice.evidenceRoll) throw new Error('Expected an app roll.')
        rolled = await executeInRoom(fixture.gm.caller, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: fixture.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: awaiting.encounterVersion,
            correlationId: null,
            occurrenceId: awaiting.occurrenceId,
            expectedOccurrenceVersion: awaiting.occurrenceVersion,
            resolution: {
              kind: 'SYSTEM_ROLL',
              requestId: awaiting.request.requestId,
              rollId: dice.evidenceRoll.rollId
            }
          }
        })
      }
      expect(rolled.occurrence?.status).toBe('COMPLETE')
      expect(await characterActiveEffects(fixture)).toEqual([])
      expect(await maintainedEffects(fixture)).toEqual([])
      expect(await conditionIds(fixture)).not.toContain(invisibleId)

      await revert(fixture, rolled.projection.version)
      expect(await maintainedEffects(fixture)).toEqual([concentration])
      expect(await characterActiveEffects(fixture)).toEqual([
        { maintainedEffectStateId: concentration?.id }
      ])
      expect(await conditionIds(fixture)).toContain(invisibleId)
    }, 240000)

    const RANGE_UNCHECKED: NonNullable<ResolveEncounterActionInputDto['acknowledgedWarnings']> = [
      'TARGET_RANGE_UNCHECKED'
    ]

    async function castInvisibleThenHeal(
      targetsWolf: boolean,
      source: SpellAuthored = invisibility,
      choiceLabel = 'Invisibility (2nd level)'
    ) {
      const fixture = await setup({
        known: [concentrationSpell(source), srdSpell(cureWounds)],
        withOthers: true
      })
      const wolf = fixture.wolf
      if (!wolf || !invisibleId) throw new Error('Missing the Wolf or the Invisible condition.')
      const invisibleCast = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, await choiceId(fixture, choiceLabel, 0), 0)
      })
      expect(invisibleCast.occurrence?.status).toBe('COMPLETE')
      const [concentration, ...others] = await maintainedEffects(fixture)
      expect(others).toEqual([])
      expect(await conditionIds(fixture)).toContain(invisibleId)

      await resetActionAllowance(fixture)
      const healed = await executeInRoom(fixture.gm.caller, {
        command: castCommand(
          fixture,
          await choiceId(fixture, 'Cure Wounds (1st level)', invisibleCast.projection.version),
          invisibleCast.projection.version,
          undefined,
          targetsWolf ? wolf.id : undefined,
          RANGE_UNCHECKED
        )
      })
      expect(healed.occurrence?.status).toBe('COMPLETE')
      return { fixture, healed, concentration }
    }

    it.each([
      ['another creature', true],
      ['themself', false]
    ])(
      'ends on a spell cast at %s: the effect, its condition and its Concentration end, and a GM undo gives all three back',
      async (_target, targetsWolf) => {
        const { fixture, healed, concentration } = await castInvisibleThenHeal(targetsWolf)
        expect(await characterActiveEffects(fixture)).toEqual([])
        expect(await maintainedEffects(fixture)).toEqual([])
        expect(await conditionIds(fixture)).not.toContain(invisibleId)

        await revert(fixture, healed.projection.version)
        expect(await maintainedEffects(fixture)).toEqual([concentration])
        expect(await characterActiveEffects(fixture)).toEqual([
          { maintainedEffectStateId: concentration?.id }
        ])
        expect(await conditionIds(fixture)).toContain(invisibleId)
      },
      240000
    )

    // The new Concentration replaces the old one, which already ends Invisibility as its dependent:
    // the cast must end it once, not twice. Undoing a replaced Concentration is refused whatever it
    // ended (D95), so the Invisibility is not given back.
    it('ends once when the cast is another Concentration spell, and the undo stays refused', async () => {
      const fixture = await setup({
        known: [concentrationSpell(invisibility), concentrationSpell(fly)],
        slots: [
          { spellLevel: 2, slotCount: 1 },
          { spellLevel: 3, slotCount: 1 }
        ]
      })
      if (!invisibleId) throw new Error('Missing the Invisible condition.')
      const unseen = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, await choiceId(fixture, 'Invisibility (2nd level)', 0), 0)
      })
      expect(unseen.occurrence?.status).toBe('COMPLETE')
      const [invisibleConcentration] = await maintainedEffects(fixture)
      expect(await characterActiveEffects(fixture)).toEqual([
        { maintainedEffectStateId: invisibleConcentration?.id }
      ])

      await resetActionAllowance(fixture)
      const flying = await executeInRoom(fixture.gm.caller, {
        command: castCommand(
          fixture,
          await choiceId(fixture, 'Fly (3rd level)', unseen.projection.version),
          unseen.projection.version
        )
      })
      expect(flying.occurrence?.status).toBe('COMPLETE')
      const [flightConcentration, ...others] = await maintainedEffects(fixture)
      expect(others).toEqual([])
      expect(flightConcentration?.id).not.toBe(invisibleConcentration?.id)
      expect(await characterActiveEffects(fixture)).toEqual([
        { maintainedEffectStateId: flightConcentration?.id }
      ])
      expect(await conditionIds(fixture)).not.toContain(invisibleId)

      await expect(revert(fixture, flying.projection.version)).rejects.toThrow(
        REPLACED_CONCENTRATION
      )
      expect(await maintainedEffects(fixture)).toEqual([flightConcentration])
      expect(await conditionIds(fixture)).not.toContain(invisibleId)
    }, 240000)

    /** Invisibility as an author builds it in the Spell form: its own id and label, ending on a cast only. */
    function castOnlyVariant() {
      const variant = srdSpell(invisibility)
      variant.label = 'Veil of Shadows'
      const path = variant.effects?.[0]?.paths?.[0]
      if (!path || !('resultBlock' in path)) throw new Error('Expected a result block.')
      path.resultBlock = {
        ...path.resultBlock,
        lifecycle: { ...path.resultBlock.lifecycle, endOnEvents: ['ON_CAST_SPELL'] }
      }
      return variant
    }

    // ADR 0038 decision 1: the end trigger is authored from core options, so an author builds what the SRD does.
    it('keeps the SRD record and an author’s variant through the Spell form, and the variant ends on a cast as the SRD does', async () => {
      const variant = castOnlyVariant()
      const { fixture } = await castInvisibleThenHeal(false, variant, 'Veil of Shadows (2nd level)')
      for (const spell of [invisibility, variant]) {
        const authored = { ...spell, classIds: [fixture.baseClass.id] }
        const normalized = await fixture.gm.caller.query(normalizeValues, {
          mapId: 'spell',
          systemId: spell.systemId,
          values: authored
        })
        expect(normalized.clearedPaths).toEqual([])
        expect(normalized.values).toHaveProperty('effects', authored.effects)
      }
      expect(await characterActiveEffects(fixture)).toEqual([])
      expect(await maintainedEffects(fixture)).toEqual([])
      expect(await conditionIds(fixture)).not.toContain(invisibleId)

      // An end event the System does not list is cleared by the same map; the valid one stays.
      const invalid = castOnlyVariant()
      const validEffects = structuredClone(invalid.effects)
      const invalidPath = invalid.effects?.[0]?.paths?.[0]
      if (!invalidPath || !('resultBlock' in invalidPath))
        throw new Error('Expected a result block.')
      invalidPath.resultBlock = {
        ...invalidPath.resultBlock,
        lifecycle: {
          ...invalidPath.resultBlock.lifecycle,
          endOnEvents: ['ON_CAST_SPELL', 'ON_NOT_A_LISTED_EVENT' as 'ON_CAST_SPELL']
        }
      }
      const cleaned = await fixture.gm.caller.query(normalizeValues, {
        mapId: 'spell',
        systemId: invalid.systemId,
        values: { ...invalid, classIds: [fixture.baseClass.id] }
      })
      expect(JSON.stringify(cleaned.values)).not.toContain('ON_NOT_A_LISTED_EVENT')
      expect(cleaned.values).toHaveProperty('effects', validEffects)
    }, 240000)

    // The cast alone ends the effect: a cantrip spends no slot, and the variant ignores the attack roll,
    // so the Sheet's only change is the release.
    it('ends on a cantrip that spends no slot, and a GM undo gives the effect back', async () => {
      const variant = concentrationSpell(castOnlyVariant())
      const bolt = srdSpell(fireBolt)
      targetAnyCreatureAtAnyRange(bolt)
      const fixture = await setup({
        known: [variant],
        granted: [{ spell: bolt, attributes: ['CAST_AT_WILL'] }],
        withOthers: true
      })
      const wolf = fixture.wolf
      if (!wolf || !invisibleId) throw new Error('Missing the Wolf or the Invisible condition.')
      const unseen = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, await choiceId(fixture, 'Veil of Shadows (2nd level)', 0), 0)
      })
      expect(unseen.occurrence?.status).toBe('COMPLETE')
      const [concentration] = await maintainedEffects(fixture)
      expect(await conditionIds(fixture)).toContain(invisibleId)

      await resetActionAllowance(fixture)
      const cantrip = await executeInRoom(fixture.gm.caller, {
        command: castCommand(
          fixture,
          await choiceId(fixture, 'Fire Bolt', unseen.projection.version),
          unseen.projection.version,
          undefined,
          wolf.id
        )
      })
      expect(cantrip.occurrence?.status).toBe('COMPLETE')
      expect(await characterActiveEffects(fixture)).toEqual([])
      expect(await maintainedEffects(fixture)).toEqual([])
      expect(await conditionIds(fixture)).not.toContain(invisibleId)

      await revert(fixture, cantrip.projection.version)
      expect(await maintainedEffects(fixture)).toEqual([concentration])
      expect(await conditionIds(fixture)).toContain(invisibleId)
    }, 240000)
  })

  it('does not offer a multi-Effect spell the Encounter cannot execute as one action', async () => {
    const twin = healSpell('Twin Mend', (spell) => {
      fixHeal(spell, 1)
      const [first] = spell.effects ?? []
      if (!first) throw new Error('Expected an Effect.')
      const second = rekeyed(first)
      second.order = 2
      spell.effects = [first, second]
      fixHeal(spell, 4, 1)
    })
    const fixture = await setup({ known: [twin] })
    // One cast is one action and the compiler executes one Effect per action: two Effects offer no choice.
    expect(await spellChoices(fixture, 0)).toEqual([])
  }, 60000)

  it('refuses the undo once the Sheet has spent that slot again', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const fixture = await setup({ known: [mend] })
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0)
    const cast = await executeInRoom(fixture.gm.caller, {
      command: castCommand(fixture, actionId, 0)
    })
    const { row } = await storedCharacter(fixture)
    await executeSheetInRoom(fixture.player.caller, {
      scope: 'CHARACTER_SHEET',
      characterId: fixture.character.id,
      encounterId: fixture.run.id,
      command: {
        type: 'USE_SPELL_SLOT',
        commandId: crypto.randomUUID(),
        expectedVersion: row.play.streamVersion,
        slotKey: 'STANDARD:1'
      }
    })
    await expect(revert(fixture, cast.projection.version)).rejects.toThrow(SHEET_CHANGED)
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 2 }
    ])
  }, 60000)

  it('journey: a player casts a leveled spell on their own Character, the Sheet shows the slot, the GM undoes it', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const fixture = await setup({ known: [mend] })
    const actionId = await choiceId(fixture, 'Mend (1st level)', 0, fixture.player)
    const sheetSlots = async () => {
      await checkpointLiveRoom(fixture.campaign.id)
      const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
        id: fixture.character.id
      })
      return sheet?.spells.slots.map(({ slotKey, used, max }) => ({
        slotKey,
        used,
        max
      }))
    }
    expect(await sheetSlots()).toEqual([
      { slotKey: 'STANDARD:1', used: 0, max: 2 },
      { slotKey: 'STANDARD:2', used: 0, max: 1 }
    ])

    const cast = await executeInRoom(fixture.player.caller, {
      command: castCommand(fixture, actionId, 0)
    })
    expect(cast.occurrence?.status).toBe('COMPLETE')
    expect(await sheetSlots()).toEqual([
      { slotKey: 'STANDARD:1', used: 1, max: 2 },
      { slotKey: 'STANDARD:2', used: 0, max: 1 }
    ])

    await revert(fixture, cast.projection.version)
    expect(await sheetSlots()).toEqual([
      { slotKey: 'STANDARD:1', used: 0, max: 2 },
      { slotKey: 'STANDARD:2', used: 0, max: 1 }
    ])
  }, 60000)

  describe('a spell granted for limited uses (SPELLS-8.T8)', () => {
    const grants = [
      { attributes: ['LIMITED_USE'], castAtLevel: undefined, label: 'Mend (1st level)' },
      { attributes: ['CAST_AT_LEVEL'], castAtLevel: 2, label: 'Mend (2nd level)' },
      // The SRD's Infernal Legacy shape: a limited-use grant cast at a fixed higher level.
      { attributes: ['LIMITED_USE', 'CAST_AT_LEVEL'], castAtLevel: 2, label: 'Mend (2nd level)' }
    ] as const

    function grantedMend(
      attributes: (typeof grants)[number]['attributes'],
      castAtLevel?: number,
      uses?: number
    ) {
      return setup({
        known: [],
        granted: [
          {
            spell: healSpell('Mend', (spell) => fixHeal(spell, 1)),
            attributes,
            ...(uses === undefined ? {} : { uses }),
            ...(castAtLevel === undefined ? {} : { castAtLevel })
          }
        ]
      })
    }

    it.each(grants)(
      'journey: a $attributes grant is cast from its use and not a slot, and GM undo restores the use',
      async ({ attributes, castAtLevel, label }) => {
        const fixture = await grantedMend(attributes, castAtLevel, 2)
        expect((await spellChoices(fixture, 0)).map((choice) => choice.label)).toEqual([label])
        expect(await mendUses(fixture)).toMatchObject({ used: 0, remaining: 2 })
        const actionId = await choiceId(fixture, label, 0, fixture.player)

        const cast = await executeInRoom(fixture.player.caller, {
          command: castCommand(fixture, actionId, 0)
        })
        expect(cast.occurrence?.status).toBe('COMPLETE')
        expect(await mendUses(fixture)).toMatchObject({ used: 1, remaining: 1 })
        expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()

        await revert(fixture, cast.projection.version)
        expect(await mendUses(fixture)).toMatchObject({ used: 0, remaining: 2 })
        expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()
      },
      120000
    )

    it('casts a CAST_AT_LEVEL grant without charges for free, spending neither a use nor a slot', async () => {
      const fixture = await grantedMend(['CAST_AT_LEVEL'], 2)
      const actionId = await choiceId(fixture, 'Mend (2nd level)', 0)
      const cast = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, actionId, 0)
      })
      expect(cast.occurrence?.status).toBe('COMPLETE')
      expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()
      await resetActionAllowance(fixture)
      expect(
        (await spellChoices(fixture, cast.projection.version)).map(({ label }) => label)
      ).toEqual(['Mend (2nd level)'])
    }, 120000)

    it('stops offering the cast once its last use is spent, and refuses the exhausted cast', async () => {
      const fixture = await grantedMend(['LIMITED_USE'], undefined, 2)
      const actionId = await choiceId(fixture, 'Mend (1st level)', 0)
      const first = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, actionId, 0)
      })
      await resetActionAllowance(fixture)
      const second = await executeInRoom(fixture.gm.caller, {
        command: castCommand(fixture, actionId, first.projection.version)
      })
      expect(second.occurrence?.status).toBe('COMPLETE')
      expect(await mendUses(fixture)).toMatchObject({ used: 2, remaining: 0 })

      await resetActionAllowance(fixture)
      const version = second.projection.version
      expect(await spellChoices(fixture, version)).toEqual([])
      await expect(
        executeInRoom(fixture.gm.caller, { command: castCommand(fixture, actionId, version) })
      ).rejects.toThrow(EXHAUSTED_CAST)
      expect(await mendUses(fixture)).toMatchObject({ used: 2, remaining: 0 })
      expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()
    }, 120000)
  })

  describe('a scaling heal (SPELLS-8.1)', () => {
    const RANGE_UNCHECKED: NonNullable<ResolveEncounterActionInputDto['acknowledgedWarnings']> = [
      'TARGET_RANGE_UNCHECKED'
    ]
    const EXCLUDED_TYPE = 'TARGET_CREATURE_TYPE_EXCLUDED'

    it('heals the dice of the cast level the Character chose, on the SRD Cure Wounds as authored', async () => {
      const fixture = await setup({ known: [srdSpell(cureWounds)] })
      expect((await spellChoices(fixture, 0)).map(({ label }) => label).sort()).toEqual([
        'Cure Wounds (1st level)',
        'Cure Wounds (2nd level)'
      ])
      const first = await choiceId(fixture, 'Cure Wounds (1st level)', 0)
      const second = await choiceId(fixture, 'Cure Wounds (2nd level)', 0)

      // One die, then two; a raw roll is the face less one, and the Wizard's spellcasting modifier is +1.
      await queueRoomRolls(fixture.campaign.id, { rolls: [2, 0, 2], repeat: 0 })
      const oneDie = await executeInRoom(fixture.player.caller, {
        command: castCommand(fixture, first, 0, undefined, undefined, RANGE_UNCHECKED)
      })
      expect(oneDie.occurrence?.status).toBe('COMPLETE')
      const afterOne = await storedCharacter(fixture)
      expect(afterOne.record.state.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
      expect(afterOne.record.state.hitpoints.current - 1).toBe(3 + 1)

      await resetActionAllowance(fixture)
      const twoDice = await executeInRoom(fixture.player.caller, {
        command: castCommand(
          fixture,
          second,
          oneDie.projection.version,
          undefined,
          undefined,
          RANGE_UNCHECKED
        )
      })
      expect(twoDice.occurrence?.status).toBe('COMPLETE')
      const afterTwo = await storedCharacter(fixture)
      expect(afterTwo.record.state.spellSlots).toEqual([
        { slotKey: 'STANDARD:1', used: 1 },
        { slotKey: 'STANDARD:2', used: 1 }
      ])
      expect(
        afterTwo.record.state.hitpoints.current - afterOne.record.state.hitpoints.current
      ).toBe(1 + 3 + 1)
    }, 120000)

    it('heals an ally with Healing Word as authored, at a Creature of a permitted type', async () => {
      const fixture = await setup({ known: [srdSpell(healingWord)], withOthers: true })
      const wolf = fixture.wolf
      if (!wolf) throw new Error('Missing the Wolf.')
      await wound(fixture, wolf.id, 1)
      const actionId = await choiceId(fixture, 'Healing Word (1st level)', 0)
      await queueRoomRolls(fixture.campaign.id, { rolls: [2], repeat: 0 })
      // A Beast raises no creature-type warning: the range, which this Scene-less Run cannot measure, is the only one.
      const healed = await executeInRoom(fixture.player.caller, {
        command: castCommand(fixture, actionId, 0, undefined, wolf.id, RANGE_UNCHECKED)
      })
      expect(healed.occurrence?.status).toBe('COMPLETE')
      expect(await creatureHitPoints(fixture, wolf.id)).toBe(1 + 3 + 1)
    }, 120000)

    it('journey: Healing Word is cast as a bonus action, spends the bonus action and not the action, and undo restores it', async () => {
      const fixture = await setup({ known: [srdSpell(healingWord)], withOthers: true })
      const wolf = fixture.wolf
      if (!wolf) throw new Error('Missing the Wolf.')
      await wound(fixture, wolf.id, 1)
      const actionId = await choiceId(fixture, 'Healing Word (1st level)', 0)
      const offered = (await spellChoices(fixture, 0)).find(({ id }) => id === actionId)
      expect(offered?.actionCost).toBe('BONUS_ACTION')
      expect(await allowanceUsed(fixture, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
      expect(await allowanceUsed(fixture, SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)

      await queueRoomRolls(fixture.campaign.id, { rolls: [2], repeat: 0 })
      const healed = await executeInRoom(fixture.player.caller, {
        command: castCommand(fixture, actionId, 0, undefined, wolf.id, RANGE_UNCHECKED)
      })
      expect(healed.occurrence?.status).toBe('COMPLETE')
      expect(await allowanceUsed(fixture, SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
      expect(await allowanceUsed(fixture, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)

      await revert(fixture, healed.projection.version)
      expect(await allowanceUsed(fixture, SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
      expect(await allowanceUsed(fixture, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
    }, 120000)

    it('offers an Action spell as an Action and a reaction spell as a Reaction', async () => {
      const fixture = await setup({
        known: [srdSpell(cureWounds), srdSpell(shield)],
        withOthers: true
      })
      const choices = await spellChoices(fixture, 0)
      expect(choices.find(({ label }) => label === 'Cure Wounds (1st level)')?.actionCost).toBe(
        'ACTION'
      )
      expect(choices.find(({ label }) => label === 'Shield (1st level)')?.actionCost).toBe(
        'REACTION'
      )
    }, 120000)

    it('warns, overridably, when a heal targets an excluded creature type, and heals once overridden', async () => {
      const fixture = await setup({
        known: [srdSpell(cureWounds)],
        withOthers: true,
        wolfTypeCode: 'UNDEAD'
      })
      const wolf = fixture.wolf
      if (!wolf) throw new Error('Missing the Wolf.')
      await wound(fixture, wolf.id, 1)
      const actionId = await choiceId(fixture, 'Cure Wounds (1st level)', 0)
      const refused = await executeInRoom(fixture.player.caller, {
        command: castCommand(fixture, actionId, 0, undefined, wolf.id, RANGE_UNCHECKED)
      }).then(
        () => null,
        (caught: unknown) => caught
      )
      expect(`${String(refused)} ${JSON.stringify(refused)}`).toContain(EXCLUDED_TYPE)
      expect(await creatureHitPoints(fixture, wolf.id)).toBe(1)
      expect((await storedCharacter(fixture)).record.state.spellSlots).toBeUndefined()

      await queueRoomRolls(fixture.campaign.id, { rolls: [2], repeat: 0 })
      const healed = await executeInRoom(fixture.player.caller, {
        command: castCommand(fixture, actionId, 0, undefined, wolf.id, [
          ...RANGE_UNCHECKED,
          EXCLUDED_TYPE
        ])
      })
      expect(healed.occurrence?.status).toBe('COMPLETE')
      expect(await creatureHitPoints(fixture, wolf.id)).toBe(1 + 3 + 1)
      expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([
        { slotKey: 'STANDARD:1', used: 1 }
      ])
    }, 120000)
  })

  describe('a self save whose failure holds a condition until a long rest (SPELLS-4.T2a1b)', () => {
    const incapacitatedId = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'INCAPACITATED'
    )?.id

    async function streamVersion(fixture: Fixture) {
      await closeRoom(fixture.campaign.id)
      return fixture.t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, fixture.character.id)
        if (!row) throw new Error('Missing Character row.')
        return row.play.streamVersion
      })
    }

    async function longRest(fixture: Fixture) {
      const input = {
        restKind: 'LONG' as const,
        expectedVersion: await streamVersion(fixture),
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC' as const,
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        requestRoll: false as const
      }
      const preview = await fixture.player.caller.query(api.characters.rest.preview, {
        id: fixture.character.id,
        input
      })
      await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
        id: fixture.character.id,
        command: characterSheetCommandInputDtoSchema.parse({
          ...input,
          type: 'COMPLETE_REST',
          commandId: crypto.randomUUID(),
          previewFingerprint: preview.previewFingerprint
        })
      })
    }

    it('deals the psychic damage, holds Incapacitated with no Concentration and releases it on a long rest', async () => {
      const fixture = await setup({
        known: [srdSpell(contactOtherPlane)],
        slots: [{ spellLevel: 5, slotCount: 1 }]
      })
      if (!incapacitatedId) throw new Error('Missing the Incapacitated condition.')
      // Room for the 6d6 psychic damage without dropping to 0 hit points.
      await fixture.owner.caller.mutation(executeSheet, {
        id: fixture.character.id,
        command: {
          type: 'SET_HIT_POINTS',
          commandId: crypto.randomUUID(),
          expectedVersion: await streamVersion(fixture),
          current: 11,
          temp: 0
        }
      })

      // A natural 1 on the Intelligence save against DC 15, then every d6 lands on 1.
      await queueRoomRolls(fixture.campaign.id, { rolls: [0, 0, 0, 0, 0, 0, 0], repeat: 0 })
      const cast = await executeInRoom(fixture.player.caller, {
        command: castCommand(
          fixture,
          await choiceId(fixture, 'Contact Other Plane (5th level)', 0),
          0
        )
      })
      expect(cast.occurrence?.status).toBe('COMPLETE')
      const afterCast = await storedCharacter(fixture)
      expect(afterCast.record.state.hitpoints.current).toBe(11 - 6)
      expect(
        (afterCast.record.state.conditions ?? []).map((entry) => entry.conditionTypeId)
      ).toEqual([incapacitatedId])
      // Nothing maintains it: no Concentration.
      expect(await maintainedEffects(fixture)).toEqual([])
      expect(await characterActiveEffects(fixture)).toHaveLength(1)

      await longRest(fixture)
      const afterLongRest = await storedCharacter(fixture)
      expect(afterLongRest.record.state.conditions ?? []).toEqual([])
      expect(await characterActiveEffects(fixture)).toEqual([])
    }, 180000)
  })
})
