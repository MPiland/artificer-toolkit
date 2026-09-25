import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import {
  liveSessionEncounterActionCommitInputSchema,
  type LiveSessionEncounterActionCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { readRunActor, readRunState } from '../encounters/documents'

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
const commitAction = makeFunctionReference<
  'mutation',
  LiveSessionEncounterActionCommitInput,
  EncounterCommandResultDto
>('liveSessions/encounterActionCommit:commit')
const secret = 'private-live-character-fence-secret-at-least-32-bytes'
const environment = workerEnvironment(secret)
const planning = {
  runtime: createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Sealed action graphs must not load current definitions.')
      }
    }
  }),
  random: () => 0
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const bite = wolf.features?.find((feature) => feature.label === 'Bite')?.effects?.[0]
if (!bite || bite.invocation.kind !== 'ACTION') throw new Error('Missing Wolf Bite fixture.')
const invocation = bite.invocation
const creature = {
  ...wolf,
  id: crypto.randomUUID(),
  features: wolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: [
            {
              ...structuredClone(bite),
              invocation: {
                ...invocation,
                triggerCode: 'ACTIVATED' as const,
                range: { id: invocation.range.id, rangeKind: 'UNLIMITED' as const },
                targeting: {
                  selectionKind: 'SINGLE_TARGET' as const,
                  dispositionKind: 'ANY' as const
                }
              },
              paths: bite.paths?.slice(0, 1).map((path) => {
                if (!('resultBlock' in path)) return path
                return {
                  ...path,
                  pathCode: 'ON_USE' as const,
                  resultBlock: {
                    ...path.resultBlock,
                    outcomes: path.resultBlock.outcomes.map((outcome) => {
                      if (outcome.effectKind !== 'DAMAGE') throw new Error('Expected damage.')
                      return {
                        id: outcome.id,
                        effectKind: 'DAMAGE' as const,
                        damageTypeId: outcome.damageTypeId,
                        valueKind: 'FIXED' as const,
                        scalingKind: 'NONE' as const,
                        amount: 1
                      }
                    })
                  }
                }
              })
            }
          ]
        }
  )
}

async function setup() {
  const base = await setupCharacterRun()
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Live Character fence',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const enemy = run.actors.find((actor) => actor.kind === 'CREATURE')
  const hero = run.actors.find((actor) => actor.kind === 'CHARACTER')
  if (!enemy || !hero) throw new Error('Missing fence actors.')
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing fence Run.')
    const state = encounterRunStateSchema.parse({
      ...readRunState(row),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: enemy.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: state.status,
      automationMode: state.automationMode,
      round: state.round,
      currentActorId: state.currentActorId
    })
    await ctx.db.patch(row._id, {
      status: state.status,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(ctx, state, [enemy.id, hero.id])
    const capability = discoverEncounterFeatureActionCapabilities({
      actor: await readRunActor(ctx, state, enemy.id),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find((candidate) => candidate.mechanicFacts.invocation.triggerCode === 'ACTIVATED')
    if (!capability) throw new Error('Missing fence Creature action.')
    return capability.actionId
  })
  const authorityEpoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: authorityEpoch,
      createdAt: base.campaign.createdAt
    })
  )
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const commits: string[] = []
  stubLiveSessionFetch((pathname, init) => {
    if (
      pathname === LIVE_SESSION_ROUTE_PATHS.encounterActionCommit &&
      typeof init?.body === 'string'
    )
      commits.push(init.body)
    return base.owner.caller.fetch(pathname, init)
  })
  const command: ResolveEncounterActionInputDto = {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: run.version,
    actorId: enemy.id,
    targetActorId: hero.id,
    actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }
  const scope = {
    campaignId: base.campaign.id,
    authorityEpoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER' as const,
    encounterId: run.id,
    expectedVersion: run.version
  }
  return { ...base, run, hero, command, scope, commits }
}

async function storedHitPoints(fixture: Awaited<ReturnType<typeof setup>>) {
  return fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!row) throw new Error('Missing fence Character.')
    return characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson)).state.hitpoints.current
  })
}

it('refuses a room plan whose Character changed before commit and commits a re-captured plan', async () => {
  const fixture = await setup()
  const stale = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    fixture.scope,
    fixture.command,
    planning
  )
  if (stale.kind !== 'PLANNED') throw new Error('Expected a completed room plan.')
  const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
    id: fixture.character.id
  })
  if (!sheet) throw new Error('Missing fence Sheet.')
  await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: fixture.character.id,
    command: {
      type: 'ADJUST_HIT_POINTS',
      commandId: crypto.randomUUID(),
      expectedVersion: sheet.meta.streamVersion,
      mode: 'DAMAGE',
      amount: 2
    }
  })
  const edited = await storedHitPoints(fixture)
  expect(edited).toBe(fixture.hero.currentHitPoints - 2)
  await expect(
    commitNativeLiveEncounterAction(environment, 'fixture-access-token', fixture.scope, stale)
  ).rejects.toThrow()
  // The route hides the reason; the same transport input refuses on the Character revision fence.
  const staleInput = fixture.commits.at(-1)
  if (!staleInput) throw new Error('Missing stale commit input.')
  await expect(
    fixture.owner.caller.mutation(
      commitAction,
      liveSessionEncounterActionCommitInputSchema.parse(JSON.parse(staleInput))
    )
  ).rejects.toThrow('Live rules inputs changed before commit.')
  expect(await storedHitPoints(fixture)).toBe(edited)

  const current = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    fixture.scope,
    fixture.command,
    planning
  )
  if (current.kind !== 'PLANNED') throw new Error('Expected a re-captured room plan.')
  const committed = await commitNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    fixture.scope,
    current
  )
  expect(await storedHitPoints(fixture)).toBe(edited - 1)
  const hero = encounterGmProjectionDtoSchema
    .parse(committed.projection)
    .actors.find((actor) => actor.id === fixture.hero.id)
  expect(hero).toMatchObject({ currentHitPoints: edited - 1, sourceRevision: null })
}, 60_000)
