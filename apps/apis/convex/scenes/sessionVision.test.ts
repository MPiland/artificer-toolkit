import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignSessionDto,
  SetCampaignSessionAttendanceInput,
  CampaignSessionAttendanceDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  SourceImportDefinitionsInput,
  SourceImportBatchResultDto
} from '@artificer-toolkit/schema/api/sourceImport'
import type {
  CharacterBuilderCommitOutput,
  CharacterBuilderResolveInput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  SceneSessionCharacterVisionInput,
  SceneSessionCharacterVisionResult,
  SceneSessionVisionRunsInput,
  SceneSessionVisionRunsPage,
  SceneSessionVisionBindingsInput,
  SceneSessionVisionBindingsPage,
  SceneSessionVisionCaptureInput,
  SceneSessionVisionScope
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type {
  CreateEncounterInputDto,
  EncounterGmProjectionDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto,
  EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  senseReusableDefinitionDocumentDtoSchema,
  type SenseReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/combatPerception'
import { sceneStoredDefinitionSaveSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { tiefling } from '@artificer-toolkit/source-data/srd/races/tiefling.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { withSceneVisionTracking } from '../lib/mutations'
import { readSceneVisionRevision } from './visionFreshness'
import { api, components, internal } from '../_generated/api'
import type { SceneGeometryExecuteInput } from '@artificer-toolkit/schema/api/sceneGeometry'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'

const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const setAttendance = makeFunctionReference<
  'mutation',
  SetCampaignSessionAttendanceInput,
  CampaignSessionAttendanceDto
>('campaigns/sessionAttendance:set')
const bindScene = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')
const bindToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')
const commit = makeFunctionReference<
  'mutation',
  CharacterBuilderResolveInput,
  CharacterBuilderCommitOutput
>('characters/commit:commit')
const importDefinitions = makeFunctionReference<
  'mutation',
  SourceImportDefinitionsInput,
  SourceImportBatchResultDto
>('content/import:importDefinitions')
const executeSheet = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const readVision = makeFunctionReference<
  'query',
  SceneSessionCharacterVisionInput,
  SceneSessionCharacterVisionResult
>('scenes/sessionVision:character')
const readRuns = makeFunctionReference<
  'query',
  SceneSessionVisionRunsInput,
  SceneSessionVisionRunsPage
>('scenes/sessionVision:runs')
const capture = makeFunctionReference<
  'query',
  SceneSessionVisionCaptureInput,
  SceneSessionVisionScope
>('scenes/sessionVision:capture')
const readBindings = makeFunctionReference<
  'query',
  SceneSessionVisionBindingsInput,
  SceneSessionVisionBindingsPage
>('scenes/sessionVision:bindings')

async function createCampaignPlayer(base: Awaited<ReturnType<typeof createEncounterSceneFixture>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Second player',
          email: 'second-player@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({
    subject: user._id,
    sessionId: session._id
  })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing second player identity.')
  return { caller, userId: identity.userId }
}
async function publishFixtureSceneSource(
  base: Awaited<ReturnType<typeof createEncounterSceneFixture>>
) {
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene.')
    const counts = {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: base.tokens.length
    }
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: base.saveId,
        commandId: scene.materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.other.userId,
        definitionId: scene.definitionId,
        expectedVersion: null,
        settings: {
          campaignId: scene.campaignId,
          name: scene.name,
          ambientIllumination: scene.ambientIllumination,
          fogMode: scene.fogMode,
          visionRevealMode: scene.visionRevealMode,
          grid: scene.grid,
          map: scene.map
        },
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: scene.id,
        entitiesRemoved: false,
        createdAt: scene.createdAt,
        expiresAt: Date.now() + 60_000
      })
    )
  })
}

async function setup(includeSecondPlayer = false) {
  const darkvisionFeature = tiefling.features?.find((feature) => feature.label === 'Darkvision')
  if (!darkvisionFeature) throw new Error('Tiefling Darkvision feature is required.')
  const base = await createEncounterSceneFixture({
    features: [darkvisionFeature]
  })
  await base.t.mutation(importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_SENSE_DEFINITIONS.map((definition) => ({
      ...definition,
      definitionFamilyKey: 'sense'
    }))
  })
  const { draft, character } = await base.createCharacter()
  const committed = await base.owner.caller.mutation(commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', {
      campaignId: base.campaign.id,
      userId: base.owner.userId,
      characterId: character.id,
      assignedAt: base.campaign.createdAt
    })
  )
  let otherPlayerCharacter: typeof character | null = null
  if (includeSecondPlayer) {
    const otherPlayer = await createCampaignPlayer(base)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: otherPlayer.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const otherPlayerDraft = await otherPlayer.caller.mutation(api.characters.drafts.create, {
      id: crypto.randomUUID(),
      systemId: SRD_SYSTEM_ID
    })
    const nextOtherPlayerCharacter = characterAuthoredDtoSchema.parse({
      ...character,
      id: otherPlayerDraft.payload.character.id,
      userId: otherPlayer.userId,
      label: 'Second player Character',
      status: 'DRAFT'
    })
    otherPlayerCharacter = nextOtherPlayerCharacter
    await otherPlayer.caller.mutation(commit, {
      expectedDraftId: otherPlayerDraft.id,
      mode: 'create',
      character: nextOtherPlayerCharacter
    })
    await base.t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        userId: otherPlayer.userId,
        characterId: nextOtherPlayerCharacter.id,
        assignedAt: base.campaign.createdAt
      })
    )
  }
  const run = await base.other.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: base.blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find(
    (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === character.id
  )
  const otherPlayerActor = otherPlayerCharacter
    ? run.actors.find(
        (candidate) =>
          candidate.kind === 'CHARACTER' && candidate.sourceId === otherPlayerCharacter.id
      )
    : null
  if (!actor || (includeSecondPlayer && !otherPlayerActor))
    throw new Error('Missing Character Encounter actors.')
  await base.other.caller.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    commandId: crypto.randomUUID(),
    encounterId: run.id
  })
  const tokenBinding = await base.other.caller.mutation(bindToken, {
    input: {
      type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      commandId: crypto.randomUUID(),
      encounterId: run.id,
      expectedEncounterVersion: run.version,
      actorId: actor.id,
      sceneId: base.sceneId,
      tokenId: base.tokens[0]!.id
    }
  })
  let encounterVersion = tokenBinding.projection.version
  if (otherPlayerActor) {
    const otherPlayerTokenBinding = await base.other.caller.mutation(bindToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: run.id,
        expectedEncounterVersion: encounterVersion,
        actorId: otherPlayerActor.id,
        sceneId: base.sceneId,
        tokenId: base.tokens[1]!.id
      }
    })
    encounterVersion = otherPlayerTokenBinding.projection.version
  }
  const currentRun = { ...run, version: encounterVersion }
  await publishFixtureSceneSource(base)
  const captureInput: SceneSessionVisionCaptureInput = {
    campaignId: base.campaign.id,
    systemId: SRD_SYSTEM_ID,
    sceneId: base.sceneId,
    expectedSceneVersion: 0,
    expectedPresentationVersion: 0
  }
  const scope = await base.other.caller.query(capture, captureInput)
  const input: SceneSessionCharacterVisionInput = {
    ...scope,
    characterId: character.id,
    streamVersion: committed.streamVersion,
    encounterId: run.id,
    expectedEncounterVersion: currentRun.version,
    actorId: actor.id,
    tokenId: base.tokens[0]!.id
  }
  return {
    ...base,
    character,
    committed,
    otherPlayerCharacter,
    run: currentRun,
    actor,
    otherPlayerActor,
    input,
    scope,
    captureInput
  }
}

async function patchSense(
  base: Awaited<ReturnType<typeof setup>>,
  document: SenseReusableDefinitionDocumentDto,
  abort = false
) {
  await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const root = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', SRD_SENSE_DEFINITIONS[0]!.id))
      .unique()
    if (!root) throw new Error('Missing imported Sense.')
    const previousRevision = await readSceneVisionRevision(ctx, 'SYSTEM', root.gameSystemId)
    await ctx.db.patch(root._id, {
      document,
      checksum: checksumRuleDocument(document),
      version: root.version + 1,
      contractVersion: root.contractVersion ?? 1,
      publishedAt: root.publishedAt ?? new Date(root._creationTime).toISOString(),
      publishedBy: root.publishedBy ?? SRD_USER_ID
    })
    expect(await readSceneVisionRevision(ctx, 'SYSTEM', root.gameSystemId)).not.toBe(
      previousRevision
    )
    if (abort) throw new Error('Abort source update.')
  })
}

describe('play Character vision boundary', () => {
  it('hydrates assigned player vision and rejects mismatched admission identifiers or anonymous callers', async () => {
    const base = await setup(true)
    const discovery = {
      ...base.scope,
      paginationOpts: { cursor: null, numItems: 1 }
    }
    const bindingDiscovery = {
      ...discovery,
      paginationOpts: { cursor: null, numItems: 4 },
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version
    }
    await expect(base.owner.caller.query(readRuns, discovery)).resolves.toMatchObject({
      page: expect.any(Array)
    })
    await expect(base.t.query(readRuns, discovery)).rejects.toThrow()
    if (!base.otherPlayerCharacter) throw new Error('Missing second player Character.')
    const playerBindings = await base.owner.caller.query(readBindings, bindingDiscovery)
    expect(playerBindings.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ characterId: base.character.id }),
        expect.objectContaining({ characterId: base.otherPlayerCharacter.id })
      ])
    )
    await expect(
      Promise.all(
        playerBindings.page.map((binding) => base.owner.caller.query(readVision, binding))
      )
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: expect.objectContaining({ characterId: base.character.id })
        }),
        expect.objectContaining({
          binding: expect.objectContaining({
            characterId: base.otherPlayerCharacter.id
          })
        })
      ])
    )
    await expect(base.t.query(readBindings, bindingDiscovery)).rejects.toThrow()
    await expect(
      base.other.caller.query(readRuns, {
        ...discovery,
        expectedPresentationVersion: 1
      })
    ).rejects.toThrow('presentation is stale')
    const cases: Array<[string, SceneSessionCharacterVisionInput, 'gm' | 'anonymous']> = [
      ['Campaign', { ...base.input, campaignId: crypto.randomUUID() }, 'gm'],
      ['Scene version', { ...base.input, expectedSceneVersion: 1 }, 'gm'],
      ['presentation', { ...base.input, expectedPresentationVersion: 1 }, 'gm'],
      [
        'Run',
        {
          ...base.input,
          expectedEncounterVersion: base.input.expectedEncounterVersion + 1
        },
        'gm'
      ],
      ['actor', { ...base.input, actorId: crypto.randomUUID() }, 'gm'],
      ['token', { ...base.input, tokenId: crypto.randomUUID() }, 'gm'],
      ['anonymous', base.input, 'anonymous']
    ]
    await expect(base.owner.caller.query(readVision, base.input)).resolves.toMatchObject({
      binding: { characterId: base.character.id }
    })
    for (const [label, input, actor] of cases) {
      const call =
        actor === 'gm'
          ? base.other.caller.query(readVision, input)
          : base.t.query(readVision, input)
      await expect(call, label).rejects.toThrow()
    }
    const session = await base.other.caller.mutation(createSession, {
      campaignId: base.campaign.id
    })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignSessions')
        .withIndex('by_publicId', (q) => q.eq('id', session.id))
        .unique()
      if (!row) throw new Error('Missing Session.')
      await ctx.db.patch(row._id, {
        status: 'FINISHED',
        finishedAt: new Date().toISOString()
      })
    })
    await expect(base.other.caller.query(readVision, base.input)).resolves.toMatchObject({
      binding: { characterId: base.character.id }
    })
    await expect(base.other.caller.query(readRuns, discovery)).resolves.toMatchObject({
      page: expect.any(Array)
    })
    await expect(base.other.caller.query(readBindings, bindingDiscovery)).resolves.toMatchObject({
      page: expect.any(Array)
    })
  }, 60000)

  it('follows vision through binding, source updates, Character play, attendance and geometry publication', async () => {
    const base = await setup()
    const npc = base.run.actors.find((candidate) => candidate.kind !== 'CHARACTER')
    if (!npc) throw new Error('Missing fixture NPC.')
    const npcBinding = await base.other.caller.mutation(bindToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        actorId: npc.id,
        sceneId: base.sceneId,
        tokenId: base.tokens[1]!.id
      }
    })
    await expect(base.other.caller.query(readVision, base.input)).rejects.toThrow(
      'dependencies changed'
    )
    base.scope = await base.other.caller.query(capture, base.captureInput)
    base.input = {
      ...base.input,
      ...base.scope,
      expectedEncounterVersion: npcBinding.projection.version
    }
    const runs: SceneSessionVisionRunsPage['page'] = []
    const runCursors = new Set<string | null>()
    let cursor: string | null = null
    do {
      expect(runCursors.has(cursor)).toBe(false)
      runCursors.add(cursor)
      const page: SceneSessionVisionRunsPage = await base.other.caller.query(readRuns, {
        ...base.scope,
        paginationOpts: { cursor, numItems: 1 }
      })
      runs.push(...page.page)
      cursor = page.isDone ? null : page.continueCursor
    } while (cursor !== null)
    expect(runCursors.size).toBeGreaterThanOrEqual(2)
    let runScope = {
      ...base.scope,
      encounterId: base.run.id,
      expectedEncounterVersion: npcBinding.projection.version
    }
    expect(runs).toEqual([runScope])
    const bindings: SceneSessionVisionBindingsPage['page'] = []
    const bindingCursors = new Set<string | null>()
    do {
      expect(bindingCursors.has(cursor)).toBe(false)
      bindingCursors.add(cursor)
      const page: SceneSessionVisionBindingsPage = await base.other.caller.query(readBindings, {
        ...runScope,
        paginationOpts: { cursor, numItems: 1 }
      })
      bindings.push(...page.page)
      cursor = page.isDone ? null : page.continueCursor
    } while (cursor !== null)
    expect(bindingCursors.size).toBeGreaterThanOrEqual(2)
    expect(bindings).toEqual([{ ...base.input, tokenId: base.input.tokenId.toLowerCase() }])
    await expect(
      base.other.caller.query(readBindings, {
        ...runScope,
        expectedEncounterVersion: base.run.version,
        paginationOpts: { cursor: null, numItems: 4 }
      })
    ).rejects.toThrow('stale')
    const first = await base.other.caller.query(readVision, base.input)
    expect(first.binding).toEqual({
      encounterId: base.run.id,
      actorId: base.actor.id,
      characterId: base.character.id,
      tokenId: base.tokens[0]!.id.toLowerCase()
    })
    expect(first.characterVision).toEqual({
      characterId: base.character.id,
      dimRange: { amount: 60, unit: 'FEET' }
    })
    const sense = senseReusableDefinitionDocumentDtoSchema.parse(SRD_SENSE_DEFINITIONS[0]!.document)
    await expect(patchSense(base, sense, true)).rejects.toThrow('Abort source update')
    await expect(base.other.caller.query(readVision, base.input)).resolves.toEqual(first)
    await patchSense(base, {
      ...sense,
      capabilities: sense.capabilities.map((capability) => ({
        ...capability,
        channel: 'NONVISUAL'
      }))
    })
    await expect(base.other.caller.query(readVision, base.input)).rejects.toThrow(
      'dependencies changed'
    )
    base.scope = await base.other.caller.query(capture, base.captureInput)
    base.input = { ...base.input, ...base.scope }
    runScope = { ...runScope, ...base.scope }
    const changed = await base.other.caller.query(readVision, base.input)
    expect(changed.characterVision.dimRange).toBeNull()
    expect(changed.snapshotChecksum).not.toBe(first.snapshotChecksum)
    const readStoredRun = () =>
      base.t.run(async (ctx) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        const actor = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', base.actor.id)
          )
          .unique()
        if (!run || !actor) throw new Error('Missing Run or actor.')
        return {
          version: run.version,
          actor: encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
        }
      })
    const storedBeforePlay = await readStoredRun()
    const advanced = await base.owner.caller.mutation(executeSheet, {
      id: base.character.id,
      command: {
        type: 'SET_INSPIRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: base.committed.streamVersion,
        inspired: true
      }
    })
    expect(advanced.streamVersion).toBe(base.committed.streamVersion + 1)
    const currentInput = {
      ...base.input,
      streamVersion: advanced.streamVersion
    }
    const currentBindings = await base.other.caller.query(readBindings, {
      ...runScope,
      paginationOpts: { cursor: null, numItems: 4 }
    })
    expect(currentBindings.page).toEqual([
      { ...currentInput, tokenId: currentInput.tokenId.toLowerCase() }
    ])
    const afterPlay = await base.other.caller.query(readVision, currentInput)
    expect(afterPlay.characterVision.dimRange).toBeNull()
    expect(afterPlay.characterRevision).not.toBe(changed.characterRevision)
    // A Character write leaves unrelated play/source scopes independent.
    await expect(base.other.caller.query(capture, base.captureInput)).resolves.toEqual(base.scope)
    await expect(base.other.caller.query(readVision, base.input)).rejects.toThrow('stale')
    const stored = await readStoredRun()
    expect(stored.version).toBe(base.input.expectedEncounterVersion)
    expect(stored.actor).toMatchObject({
      kind: 'CHARACTER',
      sourceId: base.character.id
    })
    expect(stored).toEqual(storedBeforePlay)
    const session = await base.other.caller.mutation(createSession, {
      campaignId: base.campaign.id
    })
    await base.other.caller.mutation(setAttendance, {
      campaignId: base.campaign.id,
      sessionId: session.id,
      characterId: base.character.id,
      expectedVersion: session.version,
      present: false
    })
    await expect(base.other.caller.query(capture, base.captureInput)).resolves.toEqual(base.scope)
    await expect(
      base.other.caller.query(readBindings, {
        ...runScope,
        paginationOpts: { cursor: null, numItems: 4 }
      })
    ).resolves.toMatchObject({
      page: [
        {
          ...currentInput,
          ...base.scope,
          tokenId: currentInput.tokenId.toLowerCase()
        }
      ]
    })
    await expect(
      base.other.caller.query(readVision, { ...currentInput, ...base.scope })
    ).resolves.toMatchObject({
      characterVision: { dimRange: null }
    })

    const request = {
      presentation: { expectedPresentationVersion: 0 },
      input: {
        type: 'UPSERT_SCENE_TOKEN',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        token: {
          ...base.tokens[0]!,
          controlledByUserIds: [base.owner.userId],
          position: { x: 16, y: 16 }
        }
      }
    } satisfies SceneGeometryExecuteInput
    const pending = await base.other.caller.mutation(internal.scenes.geometryStaging.begin, request)
    if (pending.kind !== 'READY') throw new Error('Expected new geometry attempt.')
    await base.other.caller.mutation(internal.scenes.geometryStaging.observe, {
      saveId: pending.saveId,
      characterRevisions: [
        {
          characterId: base.character.id,
          revision: afterPlay.characterRevision
        }
      ]
    })
    await base.other.caller.mutation(internal.scenes.geometryStaging.stageFog, {
      saveId: pending.saveId,
      layer: {
        ownerUserId: base.owner.userId,
        width: 64,
        height: 64,
        chunks: [0, 1, 2, 3].map((index) => ({
          index,
          x: (index % 2) * 32,
          y: Math.floor(index / 2) * 32,
          width: 32,
          height: 32,
          data: Buffer.alloc(128, 255).toString('base64')
        }))
      }
    })
    const laterPlay = await base.owner.caller.mutation(executeSheet, {
      id: base.character.id,
      command: {
        type: 'SET_INSPIRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: advanced.streamVersion,
        inspired: false
      }
    })
    await expect(
      base.other.caller.mutation(internal.scenes.geometryCommands.finish, {
        saveId: pending.saveId,
        baseOrdinal: 0
      })
    ).rejects.toThrow('Character changed')
    const laterVision = await base.other.caller.query(readVision, {
      ...currentInput,
      ...base.scope,
      streamVersion: laterPlay.streamVersion
    })
    const refreshed = await base.other.caller.mutation(internal.scenes.geometryStaging.observe, {
      saveId: pending.saveId,
      characterRevisions: [
        {
          characterId: base.character.id,
          revision: laterVision.characterRevision
        }
      ]
    })
    expect(refreshed.saveId).not.toBe(pending.saveId)
    await expect(
      base.t.run(async (ctx) => {
        const save = await ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', refreshed.saveId))
          .unique()
        return save?.fogSaves
      })
    ).resolves.toEqual([])
    await patchSense(base, sense)
    await expect(
      base.other.caller.mutation(internal.scenes.geometryCommands.finish, {
        saveId: refreshed.saveId,
        baseOrdinal: 0
      })
    ).rejects.toThrow('dependencies changed')
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('sceneLiveStates')
          .withIndex('by_sceneId', (q) => q.eq('sceneId', base.sceneId))
          .unique()
      )
    ).resolves.toBeNull()

    const published = await base.other.caller.action(api.scenes.geometryActions.execute, request)
    expect(published.version).toBe(1)
    expect(published.fogPatches).toMatchObject([
      { ownerUserId: base.owner.userId, mode: 'REPLACE' }
    ])
    expect(published.fogPatches[0]!.chunkCount).toBeGreaterThan(0)
    await patchSense(base, {
      ...sense,
      capabilities: sense.capabilities.map((capability) => ({
        ...capability,
        channel: 'NONVISUAL'
      }))
    })
    await expect(
      base.other.caller.action(api.scenes.geometryActions.execute, request)
    ).resolves.toEqual({ ...published, replayed: true })
    await expect(
      base.owner.caller.action(api.scenes.geometryActions.execute, request)
    ).rejects.toThrow()

    await expect(
      base.other.caller.action(api.scenes.geometryActions.execute, {
        input: request.input
      })
    ).rejects.toThrow('different presentation')
    const explicit = await base.other.caller.action(api.scenes.geometryActions.execute, {
      ...request,
      input: {
        ...request.input,
        type: 'UPSERT_SCENE_TOKEN',
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 1,
        token: {
          ...base.tokens[0]!,
          controlledByUserIds: [base.owner.userId],
          vision: {
            enabled: false,
            brightRange: 0,
            dimRange: 3000,
            angleDegrees: 360,
            directionDegrees: 0
          }
        }
      }
    })
    expect(explicit.fogPatches).toEqual([])
    await expect(
      base.t.run(async (ctx) => {
        const save = await ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_sceneId_commandId', (q) =>
            q.eq('sceneId', base.sceneId).eq('commandId', explicit.commandId)
          )
          .unique()
        return save?.characterRevisions
      })
    ).resolves.toEqual([])
  }, 60000)

  it('rejects a corrupt Run actor checksum', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.actor.id)
        )
        .unique()
      if (!actor) throw new Error('Missing Run actor.')
      await ctx.db.patch(actor._id, { stateChecksum: '0'.repeat(64) })
    })
    await expect(base.other.caller.query(readVision, base.input)).rejects.toThrow('checksum')
    await expect(
      base.other.caller.query(readBindings, {
        ...base.scope,
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        paginationOpts: { cursor: null, numItems: 4 }
      })
    ).rejects.toThrow('checksum')
  }, 60000)
})
