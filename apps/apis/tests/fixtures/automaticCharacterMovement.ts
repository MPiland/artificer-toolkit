import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  createDnd5eMovementReactionEligibilityDefinition,
  createDnd5eMovementReactionChoiceDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { importedSubject } from './publication'
import { setupCharacterRun } from './encounterCharacter'
import { sourceImportBatches } from '../../convex/content/importBatches'
import { api, components, internal } from '../../convex/_generated/api'
import { setupReactionMovementScene } from './automaticSceneMovement'
import { activateFixtureRun } from './activeInitiative'

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

async function addFixturePlayer(base: Awaited<ReturnType<typeof setupCharacterRun>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Second Character controller',
          email: 'draft_123456abcde2@example.invalid',
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
  const caller = base.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Second Character controller identity is unavailable.')
  return { caller, userId: identity.userId }
}

function eligibility(policy: 'AUTOMATIC' | 'CHOICE', id: string) {
  const published = createDnd5eMovementReactionEligibilityDefinition({
    definitionId: id,
    stage: 'BEFORE_LEAVE_REACH'
  })
  const definition = structuredClone(published.definition)
  if (policy === 'AUTOMATIC') {
    const outputs = { ...definition.outputs }
    delete outputs.choiceDefinitionId
    outputs.selectionPolicy = { kind: 'LITERAL' as const, value: 'AUTOMATIC' }
    definition.outputs = outputs
  }
  return {
    ...published,
    id,
    definition: { ...definition, id },
    checksum: checksumRuleDocument({ ...definition, id })
  }
}

/** Character mover with independently published Creature reaction policies. */
export async function setupAutomaticCharacterMovement(
  policies: readonly ('AUTOMATIC' | 'CHOICE')[],
  stop = false,
  options: Parameters<typeof setupCharacterRun>[0] = {},
  includeAdditionalCharacter = false
) {
  const base = await setupCharacterRun(options)
  let additionalCharacter: typeof base.character | null = null
  let additionalPlayer: Awaited<ReturnType<typeof addFixturePlayer>> | null = null
  if (includeAdditionalCharacter) {
    additionalPlayer = await addFixturePlayer(base)
    const draft = await additionalPlayer.caller.mutation(api.characters.drafts.create, {
      id: crypto.randomUUID(),
      systemId: base.campaign.gameSystemId
    })
    const character = characterAuthoredDtoSchema.parse({
      ...draft.payload.character,
      label: 'Bryn',
      intent: structuredClone(base.character.intent)
    })
    await additionalPlayer.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const playerUserId = additionalPlayer.userId
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: playerUserId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    await additionalPlayer.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: base.campaign.id,
      characterId: character.id
    })

    additionalCharacter = character
  }
  const definitions = policies.map((policy) => eligibility(policy, crypto.randomUUID()))
  const choice = createDnd5eMovementReactionChoiceDefinition()
  for (const batch of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[...definitions, choice].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Character reaction policy',
      description: 'Fixture',
      document: published.definition,
      checksum: published.checksum
    }))
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })
  const creatures = definitions.map((definition, index) => {
    const id = crypto.randomUUID()
    const document = creatureAuthoredDtoSchema.parse({
      ...wolf,
      id,
      features: wolf.features?.map((feature) => ({
        ...feature,
        ...(feature.label === 'Bite'
          ? {
              rollDefinitions: [
                {
                  id: crypto.randomUUID(),
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
            triggerCode: 'MELEE_WEAPON_ATTACK' as const,
            activation: { code: 'REACTION' as const, amount: 1 },
            reactionMovementTrigger: {
              kind: 'MOVEMENT' as const,
              stage: 'BEFORE_LEAVE_REACH' as const,
              perceptionRequirement: null,
              eligibilityDefinitionId: definition.id,
              movementInterruption:
                stop && index === 0
                  ? { kind: 'STOP' as const, whenResultPath: 'ON_HIT' as const }
                  : null
            }
          },
          paths: effect.paths
            ?.filter(
              (path) =>
                'resultBlock' in path &&
                path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
            )
            .map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    resultBlock: {
                      ...path.resultBlock,
                      outcomes: path.resultBlock.outcomes.map((outcome) =>
                        outcome.effectKind === 'DAMAGE'
                          ? {
                              ...outcome,
                              valueKind: 'FIXED' as const,
                              scalingKind: 'NONE' as const,
                              bonuses: [],
                              amount: 1
                            }
                          : outcome
                      )
                    }
                  }
                : path
            )
        }))
      }))
    })
    return { id, document }
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: creatures.map(({ document }) =>
      importedSubject({ ...document, subjectKind: 'CREATURE', document })
    )
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Automatic Character movement',
    commandId: crypto.randomUUID(),
    enemies: creatures.map((creature) => ({ kind: 'CREATURE' as const, sourceId: creature.id }))
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const reactors = creatures.map((creature) => {
    const actor = run.actors.find(
      (candidate) => candidate.kind === 'CREATURE' && candidate.sourceId === creature.id
    )
    if (!actor) throw new Error('Character reaction source actor is unavailable.')
    return actor
  })
  const mover = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === base.character.id
  )
  const additionalCharacterActor = additionalCharacter
    ? run.actors.find(
        (actor) => actor.kind === 'CHARACTER' && actor.sourceId === additionalCharacter.id
      )
    : null
  if (
    reactors.length !== policies.length ||
    !mover ||
    (additionalCharacter && !additionalCharacterActor)
  )
    throw new Error('Character reaction actors are unavailable.')
  await base.t.run((ctx) =>
    activateFixtureRun(ctx, run.id, {
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: reactors[0]!.id
    })
  )
  const scene = await setupReactionMovementScene(
    {
      ...base,
      other: base.player,
      run,
      reactors,
      mover,
      additionalCharacter,
      additionalCharacterActor,
      additionalPlayer,
      policies
    },
    additionalCharacterActor
      ? [reactors[0]!, mover, additionalCharacterActor, ...reactors.slice(1)]
      : [reactors[0]!, mover, ...reactors.slice(1)],
    additionalCharacterActor
      ? [100, 300, ...reactors.slice(1).map((_, index) => 400 + index * 100)]
      : policies.map((_, index) => 50 + index * 100),
    [
      { x: 150, y: 50 },
      { x: 250 + policies.length * 100 + (additionalCharacterActor ? 200 : 0), y: 50 }
    ]
  )
  return { ...scene, additionalCharacter, additionalCharacterActor, additionalPlayer }
}
