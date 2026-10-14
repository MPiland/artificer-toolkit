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
import type { CharacterSheetExecuteInput } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
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
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { cureWounds } from '@artificer-toolkit/source-data/srd/spells/cure-wounds.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
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

/** The dice healing outcome of the spell's Effect. */
function healOutcome(spell: SpellAuthored) {
  const path = spell.effects?.[0]?.paths?.[0]
  const found = path && 'resultBlock' in path ? path.resultBlock.outcomes[0] : undefined
  if (!found || found.effectKind !== 'HEAL' || found.valueKind !== 'DICE')
    throw new Error('Expected a dice healing outcome.')
  return found
}

/**
 * A Cure Wounds variant that needs no Scene geometry. Its heal scales per cast level, which the
 * dnd5e Effect-action compiler cannot execute yet; `edit` reshapes the copy, and `fixHeal` makes the
 * heal an exact unscaled amount, which it can.
 */
function healSpell(
  label: string,
  edit: (spell: SpellAuthored) => void = () => undefined
): SpellAuthored {
  const spell = rekeyed(cureWounds)
  spell.id = crypto.randomUUID()
  spell.label = label
  targetAnyCreatureAtAnyRange(spell)
  const healing = healOutcome(spell)
  if (healing.scalingKind !== 'PER_LEVEL') throw new Error('Expected a scaling heal.')
  healing.levels = Array.from({ length: 9 }, (_, index) => ({
    id: crypto.randomUUID(),
    level: index + 1,
    order: index + 1,
    diceConfig: index === 0 ? '1d2' : `${(index + 1) * 2}d2`
  }))
  delete healing.bonuses
  edit(spell)
  return spell
}

type SetupOptions = {
  /** One pact slot of this level (Pact Magic) instead of Wizard slots (two 1st, one 2nd). */
  pactLevel?: number
  /** Standard slots in place of the Wizard's two 1st and one 2nd. */
  slots?: readonly { spellLevel: number; slotCount: number }[]
  /** Slots the Sheet has already spent before the Encounter, in order. */
  spentSlots?: readonly string[]
  /** Class spells: known; those in `prepared` are also prepared. */
  known: readonly SpellAuthored[]
  prepared?: readonly SpellAuthored[]
  /** Feature-granted spells with the grant attributes. */
  granted?: readonly {
    spell: SpellAuthored
    attributes: readonly ('PREPARED' | 'RITUAL' | 'CAST_AT_WILL')[]
  }[]
  /** Seats an SRD Wolf and a second player's Character beside the target. */
  withOthers?: boolean
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
              spells: options.granted.map(({ spell, attributes }, order) => ({
                id: crypto.randomUUID(),
                grantKind: 'SPELL_GRANT' as const,
                selectionKind: 'GRANTED' as const,
                scalingKind: 'NONE' as const,
                authoringModeKind: 'SELECTED' as const,
                spellIds: [spell.id],
                attributes: [...attributes],
                order
              }))
            }
          }
        ]
      : []
  })
  for (const user of [base.owner, base.other]) await setAutoRollDice(base.t, user.userId, true)
  await base.t.mutation(internal.content.import.importSubjects, {
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
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...srdWolf, subjectKind: 'CREATURE', document: srdWolf })]
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
  targetActorId = fixture.actor.id
) {
  return {
    type: 'RESOLVE_ACTION' as const,
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
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

const EXHAUSTED_CAST = 'The committed Character action resource is unavailable or stale.'
const REPLACED_CONCENTRATION = "Undo can't restore a replaced maintained effect; adjust manually."
const SHEET_CHANGED = /'s Sheet changed after this action; adjust manually\./

describe('Character spell casting in an Encounter', () => {
  useLocalRoomWorker()

  it('offers a cast once per spell it can execute, never a granted ritual, an unprepared spell or a scaling heal', async () => {
    const mend = healSpell('Mend', (spell) => fixHeal(spell, 1))
    const grantedRite = healSpell('Granted Rite', (spell) => fixHeal(spell, 1))
    const unprepared = healSpell('Unprepared', (spell) => fixHeal(spell, 1))
    // Its heal scales per cast level, which the Encounter cannot execute: choosing it could only be refused.
    const scaling = healSpell('Scaling Mend')
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
      ['Fire Bolt', 'Mend (1st level)'].sort()
    )
    expect(new Set(choices.map(({ id }) => id)).size).toBe(choices.length)
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
    expect(after.record.state.spellSlots).toEqual([])
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
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([])
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
    expect((await storedCharacter(fixture, allyCharacterId)).record.state.spellSlots).toEqual([])
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
    expect((await storedCharacter(fixture)).record.state.spellSlots).toEqual([])

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
    // Both Effects merge into one choice, but the dnd5e compiler runs one entry per Effect action.
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
})
