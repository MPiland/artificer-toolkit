import { afterEach, expect, it, vi } from 'vitest'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { LiveSessionDomainRejectionError } from '../../../session-worker/src/liveSessionRoutes'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterActionCurrentnessChecksum } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { seedTurnSaveEffect } from '../../tests/fixtures/turnActiveEffectFixtures'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import {
  readRunActors,
  readRunState,
  writeRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { createEncounterInitiativeStore } from '@artificer-toolkit/encounter-persistence/initiativeStore'
import { loadMovementTargets } from '../encounters/movementTargets'
import { prepareNativeEncounterActionMechanics } from '../encounters/actionMechanicsPreparation'
import { readNativeActionSceneContext } from '../encounters/actionSceneContext'
import { prepareNativeActionEconomy } from '../encounters/actionEconomy'
import { readEncounterRulesCapture } from './encounterRulesCapture'
import { readCharacterRulesCapture } from './characterRulesCapture'
import {
  createActiveRuleEffectStore,
  listActiveRuleEffects
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { withSceneVisionTracking } from '../lib/mutations'
import { ensureSystemVocabularySnapshot } from '../content/systemVocabulary'
import { assertLiveSessionRulesRevisions, readLiveSessionRulesRevisions } from './rulesRevisions'
import { api, internal } from '../_generated/api'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom
} from '../../tests/fixtures/liveSessionWorker'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('plans the same Character action and target facts in the Worker using private raw reads', async () => {
  const fixture = await setupCharacterRun()
  const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
    id: fixture.character.id
  })
  const clubItem = sheet?.inventory.items.find((item) => item.equipmentId === club.id)
  if (!sheet || !clubItem) throw new Error('Missing fixture Club.')
  const equipped = await executeInRoom(fixture.owner.caller, {
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: fixture.run.version,
      actorId: fixture.actor.id,
      characterCommand: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        itemId: clubItem.id
      }
    }
  })
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const reinforced = await executeInRoom(fixture.owner.caller, {
    command: {
      type: 'REINFORCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: equipped.projection.version,
      enemy: { kind: 'CREATURE', sourceId: wolf.id },
      public: false
    }
  })
  const runVersion = reinforced.projection.version
  await fixture.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  const authorityEpoch = crypto.randomUUID()
  const target = encounterGmProjectionDtoSchema
    .parse(reinforced.projection)
    .actors.find((actor) => actor.sourceId === wolf.id)
  if (!target) throw new Error('Missing defended Creature target.')
  const sceneId = crypto.randomUUID()
  const definitionId = crypto.randomUUID()
  const saveId = crypto.randomUUID()
  const materializationCommandId = crypto.randomUUID()
  const tokens = [0, 1].map((index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: index === 0 ? 'Source token' : 'Target token',
    locked: false,
    position: { x: index * 100, y: 0 },
    rotationDegrees: 0,
    vision: null,
    width: 1
  }))
  await fixture.t.run(async (ctx) => {
    await insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      epoch: authorityEpoch,
      createdAt: fixture.campaign.createdAt
    })
    await activateFixtureRun(ctx, fixture.run.id, {
      automationMode: 'ASSISTED',
      currentActorId: fixture.actor.id,
      round: 1
    })
    const now = new Date().toISOString()
    const settings = {
      campaignId: fixture.campaign.id,
      name: 'Action preparation Scene',
      ambientIllumination: 'BRIGHT' as const,
      fogMode: 'SHARED_PARTY' as const,
      visionRevealMode: 'ON_DRAG' as const,
      grid: {
        kind: 'SQUARE' as const,
        origin: { x: 0, y: 0 },
        cellSize: 100,
        distancePerCell: 5,
        diagonalPolicy: 'EQUAL' as const,
        unit: 'FEET' as const
      },
      map: { assetId: crypto.randomUUID(), width: 500, height: 500, tileManifestAssetId: null }
    }
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId: saveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: saveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: fixture.owner.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 2 },
        received: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 2 },
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60_000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: fixture.run.id,
        actorId: ordinal === 0 ? fixture.actor.id : target.id,
        sceneId,
        tokenId: entity.id
      })
    }
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: fixture.run.id,
      campaignId: fixture.campaign.id,
      sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  const effect = await seedTurnSaveEffect(
    { ...fixture, run: { ...fixture.run, actors: [target] } },
    { stage: 'END_OF_TURN', ticks: 3, damage: 1 }
  )
  await fixture.t.run(async (ctx) => {
    for (const suffix of [4, 3, 2, 1])
      await createActiveRuleEffectStore(ctx).create({
        id: `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`,
        owner: effect.owner,
        definition: effect.definition,
        lifecycle: effect.lifecycle
      })
  })
  const actionId = await fixture.owner.caller.run(async (ctx) => {
    const targets = await loadMovementTargets(ctx, {
      encounterId: fixture.run.id,
      expectedEncounterVersion: runVersion,
      targetActorIds: [fixture.actor.id, target.id],
      includeReactionSources: true
    })
    const entry = targets
      .get(fixture.actor.id)
      ?.characterReactionSource?.mechanics.compiledActionEntryPoints.find(
        (value) => value.kind === 'CHARACTER_ACTION' && value.compilation.kind === 'COMPILED'
      )
    if (!entry) throw new Error('Missing fixture Character action.')
    return entry.actionId
  })
  expect(actionId).toContain(clubItem.id)
  const scope = {
    campaignId: fixture.campaign.id,
    authorityEpoch,
    expectedUserId: fixture.owner.userId,
    expectedRole: 'OWNER' as const,
    encounterId: fixture.run.id,
    expectedVersion: runVersion
  }
  const initiative = await fixture.owner.caller.run((ctx) =>
    readEncounterRulesCapture(ctx, { ...scope, request: { kind: 'INITIATIVE_ROUND' } })
  )
  if (initiative.kind !== 'INITIATIVE_ROUND' || !initiative.state)
    throw new Error('Missing current normalized initiative capture.')
  expect(initiative.state).toEqual(
    await fixture.t.run((ctx) =>
      createEncounterInitiativeStore(ctx).lockInitiativeRound({
        encounterId: fixture.run.id,
        round: 1
      })
    )
  )
  expect(initiative.state.round.round).toBe(1)
  expect(initiative.state.sides).toEqual([])
  await expect(
    fixture.owner.caller.run((ctx) =>
      readEncounterRulesCapture(ctx, {
        ...scope,
        expectedVersion: runVersion + 1,
        request: { kind: 'INITIATIVE_ROUND' }
      })
    )
  ).rejects.toThrow(/stale|version/i)
  await expect(
    fixture.player.caller.run((ctx) =>
      readEncounterRulesCapture(ctx, {
        ...scope,
        expectedUserId: fixture.player.userId,
        request: { kind: 'INITIATIVE_ROUND' }
      })
    )
  ).rejects.toThrow()
  const command = {
    type: 'RESOLVE_ACTION' as const,
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    commandId: crypto.randomUUID(),
    sceneContext: {
      sceneId,
      expectedSceneVersion: 0,
      sourceTokenId: tokens[0]!.id,
      targetTokenId: tokens[1]!.id
    },
    encounterId: fixture.run.id,
    expectedVersion: runVersion,
    actorId: fixture.actor.id,
    targetActorId: target.id,
    actionId
  }
  const secret = 'private-encounter-rules-test-secret-at-least-32-bytes'
  const executionOptions = {
    runtime: createPlatformRulesRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: {
        async requireCurrent() {
          throw new Error('Sealed action graphs must not read external definitions.')
        }
      }
    }),
    random: (maximum: number) => maximum - 1
  }
  const storedRecords = () =>
    fixture.t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
          .unique(),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', fixture.run.id))
          .collect(),
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
          .unique(),
        ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', fixture.run.id))
          .collect(),
        ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', fixture.run.id))
          .collect(),
        ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', fixture.run.id))
          .collect(),
        ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', fixture.run.id))
          .collect()
      ])
    )
  const beforePlanning = await storedRecords()
  const vocabularyRow = await fixture.t.run((ctx) =>
    ctx.db
      .query('systemVocabularySnapshots')
      .withIndex('by_systemId_snapshotVersion', (q) =>
        q.eq('systemId', fixture.campaign.gameSystemId)
      )
      .order('desc')
      .first()
  )
  if (!vocabularyRow) throw new Error('Missing imported System vocabulary snapshot.')
  const {
    _id: vocabularyRowId,
    _creationTime: _vocabularyCreationTime,
    ...storedVocabulary
  } = vocabularyRow
  const systemRevisionRow = () =>
    fixture.t.run((ctx) =>
      ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) =>
          q.eq('scope', 'SYSTEM').eq('id', fixture.campaign.gameSystemId)
        )
        .unique()
    )
  const beforeVocabularyCaptureRevision = await systemRevisionRow()
  const vocabularyCapture = await fixture.owner.caller.run(async (ctx) => {
    const captured = await readEncounterRulesCapture(ctx, {
      ...scope,
      request: { kind: 'SYSTEM_VOCABULARY' }
    })
    if (captured.kind !== 'SYSTEM_VOCABULARY') throw new Error('Missing vocabulary capture.')
    expect(captured.snapshot).toEqual(storedVocabulary)
    expect(captured.snapshot).toEqual(
      await ensureSystemVocabularySnapshot(ctx, fixture.campaign.gameSystemId)
    )
    return captured
  })
  expect(await fixture.t.run((ctx) => ctx.db.get(vocabularyRowId))).toEqual(vocabularyRow)
  expect(await systemRevisionRow()).toEqual(beforeVocabularyCaptureRevision)
  expect(await storedRecords()).toEqual(beforePlanning)
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  stubLiveSessionFetch(async (pathname, init) => {
    expect(['/live-sessions/encounter-rules', '/live-sessions/character-rules']).toContain(pathname)
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-access-token')
    return fixture.owner.caller.fetch(pathname, init)
  })
  const actual = await planNativeLiveEncounterAction(
    workerEnvironment(secret),
    'fixture-access-token',
    scope,
    command,
    executionOptions
  )
  expect(actual.kind).toBe('PLANNED')
  if (actual.kind !== 'PLANNED') throw new Error('Expected completed action plan.')
  expect(await storedRecords()).toEqual(beforePlanning)
  await fixture.owner.caller.run(async (ctx) => {
    const expectedEffects = await listActiveRuleEffects(ctx, effect.owner)
    expect(actual.activeEffectsByActorId.get(target.id)).toEqual(expectedEffects)
    expect(expectedEffects).toHaveLength(5)
    expect(
      actual.dependencies.filter((dependency) => dependency.request.kind === 'EFFECTS')
    ).toHaveLength(1)
    expect(
      actual.dependencies.filter((dependency) => dependency.request.kind === 'ACTION_SCENE')
    ).toHaveLength(1)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
      .unique()
    if (!row) throw new Error('Missing Encounter.')
    const state = readRunState(row)
    const expectedSceneContext = await readNativeActionSceneContext(ctx, state, command)
    expect(actual.sceneContext).toEqual(expectedSceneContext)
    const actors = await readRunActors(ctx, state)
    const expected = await prepareNativeEncounterActionMechanics(ctx, {
      state,
      actors,
      actor: actors.find((actor) => actor.id === fixture.actor.id)!,
      target: actors.find((actor) => actor.id === target.id)!,
      actionId,
      wieldConflictAcceptance: { kind: 'PROMPTED', accepted: null },
      overridable: true,
      campaignOwnerUserId: fixture.owner.userId
    })
    if (expected.source.kind !== 'CHARACTER_ACTION') throw new Error('Expected Club action.')
    const expectedSourceId = expected.source.candidate.sourceId
    const strength = expected.source.effectivePolicyOutput.abilityModifiers.find(
      (ability) => ability.ability === 'STRENGTH'
    )?.value
    expect(expected.binding.actionMechanic.attackBonus).toBe(strength)
    expect(
      expected.source.effectivePolicyOutput.modifierGroups.some(
        (group) =>
          group.domainKey === 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=MELEE' &&
          group.contributions.some(
            (contribution) =>
              contribution.sourceId === expectedSourceId && contribution.state === 'APPLIED'
          )
      )
    ).toBe(true)
    const activation = expected.source.candidate.mechanicFacts.invocation.activation
    if (!activation || activation.amount === null) throw new Error('Missing action activation.')
    const expectedActionEconomy = await prepareNativeActionEconomy(ctx, {
      actor: expected.actor,
      state,
      userId: fixture.owner.userId,
      activation: { code: activation.code, amount: activation.amount },
      target: expected.movementTargets.get(expected.actor.id)
    })
    expect(actual.actionEconomy).toEqual(expectedActionEconomy)
    expect(actual.currentnessChecksum).toBe(
      encounterActionCurrentnessChecksum({
        prepared: expected,
        actionEconomy: expectedActionEconomy,
        maintenance: actual.maintenance,
        sceneContext: expectedSceneContext
      })
    )
    expect(actual.mechanics).toEqual(
      planNativeEncounterActionMechanics(
        {
          prepared: expected,
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          occurrenceId: actual.occurrenceId,
          sourceCommandId: command.commandId,
          commandId: command.commandId,
          occurredAt: actual.occurredAt,
          applications: [
            ...actual.execution.applications,
            ...actual.preparedEffects.relationshipConditionApplications
          ],
          forceTargetVersionAdvance:
            expected.target.kind === 'CHARACTER' &&
            (actual.preparedEffects.stateEffect !== null ||
              actual.preparedEffects.recurringEffect !== null)
        },
        fixture.owner.userId
      )
    )
    const updatedTarget = actual.mechanics.targetPlan.updatedActor
    expect(updatedTarget.id).toBe(target.id)
    if (updatedTarget.kind === 'CHARACTER') throw new Error('Expected a Creature target.')
    expect(updatedTarget.currentHitPoints).toBeLessThan(target.currentHitPoints)
    for (const key of [
      'binding',
      'source',
      'plan',
      'actorRules',
      'targetPolicy',
      'characterActionState',
      'resourceUse',
      'featureResource',
      'featureUsed',
      'relationshipContributors'
    ] as const)
      expect(actual.prepared[key]).toEqual(expected[key])
    for (const dependency of actual.dependencies)
      expect(
        (await readEncounterRulesCapture(ctx, { ...scope, request: dependency.request }))
          .readChecksum
      ).toBe(dependency.readChecksum)
    for (const facts of actual.prepared.movementTargets.values()) {
      if (!facts.characterFacts) continue
      for (const dependency of facts.characterFacts.dependencies)
        expect(
          (
            await readCharacterRulesCapture(ctx, {
              campaignId: scope.campaignId,
              authorityEpoch,
              expectedUserId: scope.expectedUserId,
              expectedRole: scope.expectedRole,
              characterId: facts.characterFacts.active.id,
              request: dependency.request
            })
          ).readChecksum
        ).toBe(dependency.readChecksum)
    }
  })

  // With the allowance spent, the DO planner and the Convex fallback raise the same warning.
  const economy = actual.actionEconomy
  if (!economy) throw new Error('Missing action economy consumption.')
  const spendAllowance = (used: number) =>
    fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing action source actor.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const next = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, economy.definitionId, used)
      })
      await writeRunActor(ctx, row._id, next)
      return row
    })
  const unspent = await spendAllowance(economy.maximum)
  const plannerError = await planNativeLiveEncounterAction(
    workerEnvironment(secret),
    'fixture-access-token',
    scope,
    command,
    executionOptions
  ).then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(plannerError instanceof LiveSessionDomainRejectionError))
    throw new Error('Expected the DO planner to raise rule warnings.')
  expect(plannerError.rejection).toMatchObject({
    reason: 'RULE_WARNINGS',
    warnings: [{ code: 'ACTION_ECONOMY_UNAVAILABLE' }]
  })
  await fixture.t.run(async (ctx) => {
    await ctx.db.patch(unspent._id, {
      stateJson: unspent.stateJson,
      stateChecksum: unspent.stateChecksum
    })
  })
  expect(await storedRecords()).toEqual(beforePlanning)

  const playRevision = async () =>
    (
      await fixture.owner.caller.run((ctx) =>
        readLiveSessionRulesRevisions(ctx, {
          systemId: fixture.campaign.gameSystemId,
          campaignId: fixture.campaign.id
        })
      )
    ).find((entry) => entry.scope === 'PLAY')?.revision
  for (const table of ['encounterInitiativeRounds', 'encounterInitiativeParticipants'] as const) {
    const beforeRevision = await playRevision()
    await fixture.t.run(async (rawCtx) => {
      const ctx = withSceneVisionTracking(rawCtx)
      if (table === 'encounterInitiativeRounds') {
        const row = await ctx.db
          .query(table)
          .withIndex('by_encounterId_round', (q) =>
            q.eq('encounterId', fixture.run.id).eq('round', 1)
          )
          .unique()
        if (!row) throw new Error('Missing current initiative round.')
        await ctx.db.patch(row._id, {
          updatedAt: new Date(Date.parse(row.updatedAt) + 1).toISOString()
        })
      } else {
        const row = await ctx.db
          .query(table)
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', fixture.run.id).eq('round', 1)
          )
          .first()
        if (!row) throw new Error('Missing current initiative participant.')
        await ctx.db.patch(row._id, {
          updatedAt: new Date(Date.parse(row.updatedAt) + 1).toISOString()
        })
      }
    })
    expect(await playRevision()).not.toBe(beforeRevision)
  }
  const initiativeHeader = await fixture.t.run((ctx) =>
    ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', fixture.run.id).eq('round', 1))
      .unique()
  )
  if (!initiativeHeader) throw new Error('Current initiative round is unavailable.')
  // The Worker action plan does not read initiative; the PLAY fence refuses a plan made before the
  // round changed, and the Convex commit refuses a Run whose current round is missing or corrupt.
  const expectCommitRefused = async () => {
    const planned = await planNativeLiveEncounterAction(
      workerEnvironment(secret),
      'fixture-access-token',
      scope,
      command,
      executionOptions
    )
    if (planned.kind !== 'PLANNED') throw new Error('Expected completed action plan.')
    const beforeCommit = await storedRecords()
    await expect(
      commitNativeLiveEncounterAction(
        workerEnvironment(secret),
        'fixture-access-token',
        scope,
        planned
      )
    ).rejects.toThrow('Live Session route request failed.')
    expect(await storedRecords()).toEqual(beforeCommit)
  }
  const beforeHeaderDeletion = await fixture.owner.caller.run((ctx) =>
    readLiveSessionRulesRevisions(ctx, {
      systemId: fixture.campaign.gameSystemId,
      campaignId: fixture.campaign.id
    })
  )
  await fixture.t.run((rawCtx) => withSceneVisionTracking(rawCtx).db.delete(initiativeHeader._id))
  await expect(
    fixture.owner.caller.run((ctx) =>
      assertLiveSessionRulesRevisions(ctx, beforeHeaderDeletion, {
        systemId: fixture.campaign.gameSystemId,
        campaignId: fixture.campaign.id,
        characterIds: []
      })
    )
  ).rejects.toThrow('changed before commit')
  stubLiveSessionFetch((pathname, init) => fixture.owner.caller.fetch(pathname, init))
  await expectCommitRefused()
  await fixture.t.run(async (rawCtx) => {
    const { _id, _creationTime, ...stored } = initiativeHeader
    await withSceneVisionTracking(rawCtx).db.insert('encounterInitiativeRounds', stored)
  })
  const restoredHeader = await fixture.t.run((ctx) =>
    ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', fixture.run.id).eq('round', 1))
      .unique()
  )
  if (!restoredHeader) throw new Error('Current initiative round was not restored.')
  await fixture.t.run((rawCtx) =>
    withSceneVisionTracking(rawCtx).db.patch(restoredHeader._id, {
      policySnapshotChecksum: '0'.repeat(64)
    })
  )
  await expect(
    fixture.owner.caller.run((ctx) =>
      readEncounterRulesCapture(ctx, { ...scope, request: { kind: 'INITIATIVE_ROUND' } })
    )
  ).rejects.toThrow(/initiative|policy|checksum/i)
  await expectCommitRefused()
  await fixture.t.run((rawCtx) =>
    withSceneVisionTracking(rawCtx).db.patch(restoredHeader._id, {
      policySnapshotChecksum: initiativeHeader.policySnapshotChecksum
    })
  )

  for (const sceneContext of [
    { ...command.sceneContext, expectedSceneVersion: 1 },
    { ...command.sceneContext, sourceTokenId: tokens[1]!.id }
  ])
    await expect(
      fixture.owner.caller.run((ctx) =>
        readEncounterRulesCapture(ctx, {
          ...scope,
          request: {
            kind: 'ACTION_SCENE',
            command: {
              actorId: command.actorId,
              targetActorId: command.targetActorId,
              sceneContext
            }
          }
        })
      )
    ).rejects.toThrow(/stale/i)

  // Deletion from a page already read must invalidate the entire prepared action.
  let deleted = false
  stubLiveSessionFetch(async (pathname, init) => {
    if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
    const input: { request: { kind: string } } = JSON.parse(init.body)
    if (input.request.kind === 'EFFECTS' && !deleted) {
      deleted = true
      await fixture.t.run(async (rawCtx) => {
        const ctx = withSceneVisionTracking(rawCtx)
        const first = await ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (q) =>
            q.eq('encounterId', fixture.run.id).eq('targetActorId', target.id)
          )
          .first()
        if (!first) throw new Error('Missing effect.')
        await ctx.db.delete(first._id)
      })
    }
    return fixture.owner.caller.fetch(pathname, init)
  })
  await expect(
    planNativeLiveEncounterAction(
      workerEnvironment(secret),
      'fixture-access-token',
      scope,
      command,
      executionOptions
    )
  ).rejects.toThrow(/revision|changed/i)
  expect(deleted).toBe(true)

  const beforeVocabularyChange = await fixture.owner.caller.run((ctx) =>
    readLiveSessionRulesRevisions(ctx, {
      systemId: fixture.campaign.gameSystemId,
      campaignId: fixture.campaign.id
    })
  )
  await fixture.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    await ctx.db.patch(vocabularyRowId, { checksum: '0'.repeat(64) })
  })
  const afterVocabularyChange = await fixture.owner.caller.run((ctx) =>
    readLiveSessionRulesRevisions(ctx, {
      systemId: fixture.campaign.gameSystemId,
      campaignId: fixture.campaign.id
    })
  )
  expect(afterVocabularyChange.find((entry) => entry.scope === 'SYSTEM')?.revision).not.toBe(
    beforeVocabularyChange.find((entry) => entry.scope === 'SYSTEM')?.revision
  )
  await expect(
    fixture.owner.caller.run((ctx) =>
      assertLiveSessionRulesRevisions(ctx, beforeVocabularyChange, {
        systemId: fixture.campaign.gameSystemId,
        campaignId: fixture.campaign.id,
        characterIds: []
      })
    )
  ).rejects.toThrow('changed before commit')
  await expect(
    fixture.owner.caller.run((ctx) =>
      readEncounterRulesCapture(ctx, { ...scope, request: { kind: 'SYSTEM_VOCABULARY' } })
    )
  ).rejects.toThrow('checksum mismatch')
  expect(vocabularyCapture.snapshot.checksum).toBe(storedVocabulary.checksum)
})
