import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  LiveSessionCharacterRulesInput,
  LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import { internal } from '../_generated/api'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { insertActiveLiveAuthority } from '../../tests/fixtures/liveSessionWorker'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers
} from '../../tests/fixtures/playerControl'

const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')
const characterCapture = makeFunctionReference<
  'query',
  LiveSessionCharacterRulesInput,
  LiveSessionCharacterRulesResponse
>('liveSessions/characterRulesCapture:capture')

async function setup() {
  const base = await setupCharacterRun()
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
  )
  const input: LiveSessionEncounterRulesInput = {
    campaignId: base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER',
    encounterId: base.run.id,
    expectedVersion: base.run.version,
    request: { kind: 'INPUTS' }
  }
  return { ...base, input }
}

function effectDefinition(encounterId: string, actorId: string): ActiveRuleEffectDefinitionDto {
  const definitionId = crypto.randomUUID()
  const entryId = crypto.randomUUID()
  return {
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId: crypto.randomUUID(),
      rootCommandId: crypto.randomUUID(),
      sourceActorId: actorId
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: crypto.randomUUID(),
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'TICKS', initialRemaining: 3, decrementStage: 'END_OF_TURN' }
    }
  }
}

it('requires current GM authority and exact Run identity and version without any Session', async () => {
  const base = await setup()
  const response = await base.owner.caller.query(capture, base.input)
  expect(response).toMatchObject({ kind: 'INPUTS', state: { id: base.run.id } })
  expect(await base.owner.caller.query(capture, base.input)).toEqual(response)
  await expect(base.t.query(capture, base.input)).rejects.toThrow('Unauthenticated')
  await expect(
    base.player.caller.query(capture, { ...base.input, expectedUserId: base.player.userId })
  ).rejects.toThrow('role')
  await expect(
    base.owner.caller.query(capture, { ...base.input, expectedUserId: base.player.userId })
  ).rejects.toThrow('identity')
  await expect(
    base.owner.caller.query(capture, { ...base.input, authorityEpoch: crypto.randomUUID() })
  ).rejects.toThrow('stale')
  await expect(
    base.owner.caller.query(capture, { ...base.input, expectedVersion: base.run.version + 1 })
  ).rejects.toThrow('version mismatch')
  await expect(
    base.owner.caller.query(capture, { ...base.input, encounterId: crypto.randomUUID() })
  ).rejects.toThrow('not found')
  const campaignRow = await base.t.run((ctx) =>
    ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
  )
  if (!campaignRow) throw new Error('Missing Campaign fixture.')
  await base.t.run((ctx) => ctx.db.patch(campaignRow._id, { gameSystemId: crypto.randomUUID() }))
  await expect(base.owner.caller.query(capture, base.input)).rejects.toThrow('scope or version')
  await base.t.run((ctx) =>
    ctx.db.patch(campaignRow._id, { gameSystemId: base.campaign.gameSystemId })
  )
  await expect(base.owner.caller.query(capture, base.input)).resolves.toMatchObject({
    kind: 'INPUTS',
    state: { id: base.run.id }
  })
})

it('admits a player only with an admitted action for an actor they control', async () => {
  const base = await playerControlFixture()
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
  )
  const scopeFor = (command: ResolveEncounterActionInputDto) => ({
    campaignId: base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.other.userId,
    expectedRole: 'PLAYER' as const,
    encounterId: base.run.id,
    expectedVersion: command.expectedVersion,
    action: { kind: 'ACTION_COMMAND' as const, command }
  })
  const uncontrolled = await base.bite(base.companion.id, base.enemy.id)
  await expect(
    domainRejection(
      base.other.caller.query(capture, {
        ...scopeFor(uncontrolled),
        request: { kind: 'INPUTS' }
      })
    )
  ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
  const { action: _unadmitted, ...unscoped } = scopeFor(uncontrolled)
  await expect(
    base.other.caller.query(capture, { ...unscoped, request: { kind: 'INPUTS' } })
  ).rejects.toThrow('role')

  await setActorControllers(base, base.companion.id, [base.other.userId])
  const command = await base.bite(base.companion.id, base.enemy.id)
  await expect(
    base.other.caller.query(capture, { ...scopeFor(command), request: { kind: 'INPUTS' } })
  ).resolves.toMatchObject({ kind: 'INPUTS', state: { id: base.run.id } })
  await expect(
    base.other.caller.query(capture, {
      ...scopeFor(command),
      request: { kind: 'ACTION_COMMAND', command }
    })
  ).resolves.toMatchObject({ kind: 'ACTION_COMMAND', command })
  await expect(
    base.other.caller.query(capture, {
      ...scopeFor(command),
      request: { kind: 'ACTION_COMMAND', command: { ...command, commandId: crypto.randomUUID() } }
    })
  ).rejects.toThrow('action scope mismatch')
  await expect(
    base.other.caller.query(capture, {
      ...scopeFor(command),
      expectedRole: 'OWNER',
      request: { kind: 'INPUTS' }
    })
  ).rejects.toThrow()
  await expect(
    base.player.caller.query(capture, {
      ...scopeFor(command),
      expectedUserId: base.player.userId,
      request: { kind: 'INPUTS' }
    })
  ).rejects.toThrow()
}, 30000)

it('captures only current Run members and current assigned Character actors', async () => {
  const base = await setup()
  const characterRead = await base.owner.caller.query(capture, {
    ...base.input,
    request: { kind: 'ACTOR', actorId: base.actor.id }
  })
  expect(characterRead).toMatchObject({
    kind: 'ACTOR',
    actor: { id: base.actor.id },
    effects: [],
    continueAfter: null
  })
  await expect(
    base.owner.caller.query(capture, {
      ...base.input,
      request: { kind: 'ACTOR', actorId: crypto.randomUUID() }
    })
  ).rejects.toThrow('not found')
  const actorRow = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
  )
  if (!actorRow) throw new Error('Missing actor fixture.')
  const wrongSystemActor = {
    ...encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson)),
    systemId: crypto.randomUUID()
  }
  await base.t.run((ctx) =>
    ctx.db.patch(actorRow._id, {
      stateJson: JSON.stringify(wrongSystemActor),
      stateChecksum: checksumCanonicalJson(wrongSystemActor)
    })
  )
  await expect(
    base.owner.caller.query(capture, {
      ...base.input,
      request: { kind: 'ACTOR', actorId: base.actor.id }
    })
  ).rejects.toThrow('does not match the Run')
  await base.t.run((ctx) =>
    ctx.db.patch(actorRow._id, {
      stateJson: actorRow.stateJson,
      stateChecksum: actorRow.stateChecksum
    })
  )
  const characterRow = await base.t.run((ctx) =>
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
  )
  if (!characterRow) throw new Error('Missing Character fixture.')
  await base.t.run((ctx) =>
    ctx.db.patch(characterRow._id, { streamVersion: characterRow.streamVersion + 1 })
  )
  await expect(
    base.owner.caller.query(capture, {
      ...base.input,
      request: { kind: 'ACTOR', actorId: base.actor.id }
    })
  ).resolves.toMatchObject({ kind: 'ACTOR', actor: { id: base.actor.id } })
  // The Character actor keeps no stream version; the capture returns the current Character.
  await expect(
    base.owner.caller.query(characterCapture, {
      campaignId: base.campaign.id,
      authorityEpoch: base.input.authorityEpoch,
      expectedUserId: base.owner.userId,
      expectedRole: 'OWNER',
      characterId: base.character.id,
      request: { kind: 'INPUTS' }
    })
  ).resolves.toMatchObject({ kind: 'INPUTS', streamVersion: characterRow.streamVersion + 1 })
  await base.t.run((ctx) => ctx.db.patch(characterRow._id, { status: 'DRAFT' }))
  await expect(
    base.owner.caller.query(capture, {
      ...base.input,
      request: { kind: 'ACTOR', actorId: base.actor.id }
    })
  ).rejects.toThrow('Stored Character identity mismatch')
  await base.t.run((ctx) =>
    ctx.db.patch(characterRow._id, { streamVersion: characterRow.streamVersion, status: 'ACTIVE' })
  )
  const assignment = await base.t.run((ctx) =>
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
      .unique()
  )
  if (!assignment) throw new Error('Missing Character assignment fixture.')
  await base.t.run((ctx) => ctx.db.delete(assignment._id))
  await expect(
    base.owner.caller.query(capture, {
      ...base.input,
      request: { kind: 'ACTOR', actorId: base.actor.id }
    })
  ).rejects.toThrow('Assigned Character')
})

it('pages four current owner effects and changes the checksum when the page changes', async () => {
  const base = await setup()
  const target = base.run.actors.find((actor) => actor.kind !== 'CHARACTER')
  if (!target) throw new Error('Missing Encounter target fixture.')
  const actorRequest = { kind: 'ACTOR' as const, actorId: target.id }
  const empty = await base.owner.caller.query(capture, {
    ...base.input,
    request: actorRequest
  })
  expect(empty).toMatchObject({ effects: [], continueAfter: null })
  await base.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore(ctx)
    for (let index = 0; index < 5; index += 1)
      await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: base.run.id, targetActorId: target.id },
        definition: effectDefinition(base.run.id, target.id),
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      })
  })
  const first = await base.owner.caller.query(capture, {
    ...base.input,
    request: actorRequest
  })
  expect(first.readChecksum).not.toBe(empty.readChecksum)
  if (first.kind !== 'ACTOR') throw new Error('Expected actor and first effect page.')
  expect(first.effects).toHaveLength(4)
  expect(first.continueAfter).toBe(first.effects[3]!.id)
  const second = await base.owner.caller.query(capture, {
    ...base.input,
    request: { kind: 'EFFECTS', actorId: target.id, afterEffectId: first.continueAfter }
  })
  if (second.kind !== 'EFFECTS') throw new Error('Expected effect page.')
  expect(second.effects).toHaveLength(1)
  expect(second.continueAfter).toBeNull()
  expect(new Set([...first.effects, ...second.effects].map((effect) => effect.id)).size).toBe(5)
  const terminal = await base.owner.caller.query(capture, {
    ...base.input,
    request: { kind: 'EFFECTS', actorId: target.id, afterEffectId: second.effects[0]!.id }
  })
  expect(terminal).toMatchObject({ effects: [], continueAfter: null })
})

it('captures current definitions and fingerprints missing and removed definitions', async () => {
  const base = await setup()
  const definition = maintenanceDefinitionFixture({ id: crypto.randomUUID() })
  const request = { kind: 'DEFINITION' as const, definitionId: definition.id }
  const missing = await base.owner.caller.query(capture, { ...base.input, request })
  expect(missing).toMatchObject({ kind: 'DEFINITION', definition: null })
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [definition]
  })
  const current = await base.owner.caller.query(capture, { ...base.input, request })
  expect(current.readChecksum).not.toBe(missing.readChecksum)
  expect(current).toMatchObject({ definition: { id: definition.id, version: 1 } })
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', definition.id))
      .unique()
  )
  if (!row) throw new Error('Missing definition fixture.')
  await base.t.run((ctx) =>
    ctx.db.patch(row._id, {
      version: 2,
      contractVersion: 1,
      publishedAt: new Date().toISOString(),
      publishedBy: srdSystemRecord.userId
    })
  )
  const revised = await base.owner.caller.query(capture, { ...base.input, request })
  expect(revised).toMatchObject({ definition: { version: 2 } })
  expect(revised.readChecksum).not.toBe(current.readChecksum)
  const source = await base.t.run((ctx) =>
    ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', SRD_CONTENT_SOURCE.id))
      .unique()
  )
  if (!source) throw new Error('Missing definition source fixture.')
  const foreignDocument = {
    ...ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse(definition.document),
    gameSystemId: crypto.randomUUID()
  }
  await base.t.run(async (ctx) => {
    await ctx.db.patch(source._id, { gameSystemId: foreignDocument.gameSystemId })
    await ctx.db.patch(row._id, {
      gameSystemId: foreignDocument.gameSystemId,
      document: foreignDocument,
      checksum: checksumRuleDocument(foreignDocument)
    })
  })
  await expect(base.owner.caller.query(capture, { ...base.input, request })).rejects.toThrow(
    'System mismatch'
  )
  await base.t.run(async (ctx) => {
    await ctx.db.patch(source._id, { gameSystemId: source.gameSystemId })
    await ctx.db.patch(row._id, {
      gameSystemId: row.gameSystemId,
      document: row.document,
      checksum: row.checksum
    })
  })
  await base.t.run(async (ctx) => {
    await ctx.db.patch(source._id, { kind: 'USER', ownerUserId: base.player.userId })
    await ctx.db.patch(row._id, { ownerUserId: base.player.userId })
  })
  await expect(base.owner.caller.query(capture, { ...base.input, request })).rejects.toThrow(
    'unavailable'
  )
  await base.t.run((ctx) => ctx.db.delete(row._id))
  const removed = await base.owner.caller.query(capture, { ...base.input, request })
  expect(removed).toEqual({ ...missing, revisions: removed.revisions })
  expect(removed.revisions).not.toEqual(missing.revisions)
})
