import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from './srdCreatures'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../../convex/_generated/api'
import { seedActiveInitiative } from './activeInitiative'
import { setupCharacterRun } from './encounterCharacter'
import { createPartyPlayer } from './partyPlayer'
import { importedSubject } from './publication'
import { setAutoRollDice } from './rollPreferences'
import { executeInRoom } from './liveSessionWorker'

/**
 * How the companion's Bite resolves: `ACTIVATED` deals fixed damage with no roll, `ATTACK` needs the
 * source's attack d20, `SAVE` needs the target's Dexterity save.
 */
export type PlayerControlBite = 'ACTIVATED' | 'ATTACK' | 'SAVE'

const TRIGGER = {
  ACTIVATED: 'ACTIVATED',
  ATTACK: 'MELEE_WEAPON_ATTACK',
  SAVE: 'SAVING_THROW'
} as const

export function companionCreature(bite: PlayerControlBite) {
  const dexterityId = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')?.id
  if (!dexterityId) throw new Error('Missing Dexterity ability fixture.')
  return {
    ...wolf,
    features: wolf.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            ...(bite === 'ATTACK'
              ? {
                  rollDefinitions: [
                    {
                      id: '00000000-0000-4000-8000-000000000c95',
                      label: 'Bite attack',
                      kind: 'ATTACK' as const,
                      expression: { count: 1, die: 20, modifier: 4 },
                      rollMode: 'NORMAL' as const,
                      chargeCost: null,
                      order: 1
                    }
                  ]
                }
              : {}),
            effects: feature.effects?.map((effect) => ({
              ...effect,
              invocation: {
                ...effect.invocation,
                triggerCode: TRIGGER[bite],
                ...(bite === 'SAVE'
                  ? {
                      savingThrow: {
                        id: '00000000-0000-4000-8000-000000000c60',
                        dcMethod: 'FIXED_DC' as const,
                        abilityDefinitionId: dexterityId,
                        baseDc: 10
                      }
                    }
                  : {}),
                range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
                targeting: {
                  selectionKind: 'SINGLE_TARGET' as const,
                  dispositionKind: 'ANY' as const
                }
              },
              paths: effect.paths?.slice(0, 1).map((path) => {
                if (!('resultBlock' in path)) return path
                return {
                  ...path,
                  pathCode:
                    bite === 'ATTACK'
                      ? ('ON_HIT' as const)
                      : bite === 'SAVE'
                        ? ('ON_SAVE_FAIL' as const)
                        : ('ON_USE' as const),
                  resultBlock: {
                    ...path.resultBlock,
                    outcomes: path.resultBlock.outcomes.map((outcome) => {
                      if (outcome.effectKind !== 'DAMAGE') throw new Error('Expected Bite damage.')
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
            }))
          }
    )
  }
}

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
 * An ACTIVE Assisted Encounter with the GM (owner), a player whose assigned Character is in the Run,
 * a second player without a Character, a companion Creature and an enemy Creature (both GM-controlled
 * until granted) and a hidden custom actor. The companion acts first; everyone auto-rolls unless
 * `promptRolls` turns it off for the GM and both players. `additionalCreatures` adds more enemy
 * Creatures, which act last.
 */
export async function playerControlFixture(
  options: { bite?: PlayerControlBite; promptRolls?: boolean; additionalCreatures?: number } = {}
) {
  const bite = options.bite ?? 'ACTIVATED'
  const base = await setupCharacterRun()
  const other = await createPartyPlayer(base.t, base.campaign)
  await other.join()
  // App rolls post to the table chat, which needs a username.
  for (const [member, username] of [
    [base.owner, 'GameMaster'],
    [base.player, 'CharacterPlayer']
  ] as const)
    await member.caller.mutation(api.account.updateProfile, { username, bio: null })
  if (options.promptRolls)
    for (const userId of [base.owner.userId, base.player.userId, other.userId])
      await setAutoRollDice(base.t, userId, false)
  const creature = companionCreature(bite)
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
    name: 'Player control fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: creature.id },
      { kind: 'CREATURE', sourceId: creature.id },
      { kind: 'CUSTOM', label: 'Lurker', maxHitPoints: 10 },
      ...Array.from({ length: options.additionalCreatures ?? 0 }, () => ({
        kind: 'CREATURE' as const,
        sourceId: creature.id
      }))
    ]
  })
  const created = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const [companion, enemy, ...additional] = created.actors.filter(
    (actor) => actor.kind === 'CREATURE'
  )
  const lurker = created.actors.find((actor) => actor.kind === 'CUSTOM')
  const character = created.actors.find((actor) => actor.kind === 'CHARACTER')
  if (!companion || !enemy || !lurker || !character)
    throw new Error('Missing player control fixture actors.')
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', created.id))
      .unique()
    if (!row) throw new Error('Missing player control fixture Run.')
    const active = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: companion.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active)
    })
    await seedActiveInitiative(ctx, active, [
      companion.id,
      character.id,
      enemy.id,
      lurker.id,
      ...additional.map((actor) => actor.id)
    ])
    const actorRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', created.id).eq('id', companion.id)
      )
      .unique()
    if (!actorRow) throw new Error('Missing player control companion.')
    return discoverEncounterFeatureActionCapabilities({
      actor: encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson)),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find((candidate) => candidate.mechanicFacts.invocation.triggerCode === TRIGGER[bite])
      ?.actionId
  })
  if (!actionId) throw new Error('Missing player control companion action.')
  const fixture = {
    ...base,
    other,
    run: created,
    companion,
    enemy,
    lurker,
    character,
    actionId
  }
  return {
    ...fixture,
    /** The Run's current version, read fresh for each command. */
    version: () => readRunVersion(fixture),
    /** A GM command against the Run; returns the GM result. */
    gm: (command: EncounterCommandInputDto) => executeInRoom(base.owner.caller, { command }),
    /** A Bite from `actorId` at `targetActorId` at the Run's current version. */
    bite: async (
      actorId: string,
      targetActorId: string,
      overrides: Partial<ResolveEncounterActionInputDto> = {}
    ): Promise<ResolveEncounterActionInputDto> => ({
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await readRunVersion(fixture),
      actorId,
      targetActorId,
      actionId,
      optionalCombatIntent: null,
      sceneContext: null,
      ...overrides
    })
  }
}

export type PlayerControlFixture = Awaited<ReturnType<typeof playerControlFixture>>

async function readRunVersion(base: {
  t: Awaited<ReturnType<typeof setupCharacterRun>>['t']
  run: { id: string }
}): Promise<number> {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing player control fixture Run.')
    return row.version
  })
}

/** Rewrites the stored Run as if it had started in `automationMode`, which START freezes. */
export async function storeRunAutomationMode(
  t: Awaited<ReturnType<typeof setupCharacterRun>>['t'],
  runId: string,
  automationMode: 'MANUAL' | 'ASSISTED'
) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', runId))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const state = encounterRunStateSchema.parse({ ...JSON.parse(row.stateJson), automationMode })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  })
}

/** GM: sets the actor's granted controllers (UPDATE_ACTOR `controllerUserIds`). */
export async function setActorControllers(
  base: PlayerControlFixture,
  actorId: string,
  controllerUserIds: string[]
): Promise<EncounterCommandResultDto> {
  return base.gm({
    type: 'UPDATE_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId,
    controllerUserIds
  })
}

/** The domain rejection a command refused with; fails the test on success or a plain error. */
export async function domainRejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof ConvexError))
    throw new Error(`Expected a domain rejection, got ${String(error)}`)
  return domainRejectionErrorDataSchema.parse(error.data)
}
