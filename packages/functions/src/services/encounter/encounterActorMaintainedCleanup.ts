import {
  createActiveRuleEffectRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  type DBLike,
  type EncounterRecord
} from '@artificer-toolkit/db'

import { advanceCharacterMechanicsProjectionCommandState } from '../character/characterMechanicsCompiler.js'
import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from '../character/campaignCharacterSheet.js'
import {
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
  compileCampaignCharacterMechanicsProjection
} from '../campaign/campaignCharacterMechanicsProjection.js'
import { lockCharacterAssignmentAuthority } from '../character/characterAssignmentAuthority.js'
import { EncounterConflictError } from './encounterErrors.js'

type CleanupEffect = Awaited<
  ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockDependentEffects']>
>[number]

type CleanupState = Awaited<
  ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockMaintainedStateById']>
>

function ownerKey(effect: CleanupEffect): string {
  return effect.owner.kind === 'CHARACTER'
    ? `CHARACTER:${effect.owner.characterId}`
    : `ENCOUNTER_ACTOR:${effect.owner.targetActorId}`
}

function effectReceipt(effect: CleanupEffect) {
  return {
    kind: effect.owner.kind,
    ownerId:
      effect.owner.kind === 'CHARACTER' ? effect.owner.characterId : effect.owner.targetActorId,
    activeEffectId: effect.id,
    createdOrdinal: effect.createdOrdinal,
    expectedVersion: effect.version,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum
  } as const
}

/**
 * Removes effects that cannot outlive a removed Encounter actor. Character
 * aggregate effects are explicitly deleted and their current projections are
 * advanced; the database cascade is only a final integrity backstop.
 */
export async function cleanupRemovedEncounterActorMaintainedEffects(input: {
  trx: DBLike
  encounter: EncounterRecord
  removedActorId: string
  attunementSlotOverride: number | null
}): Promise<{
  result: {
    terminatedStates: readonly {
      id: string
      ownerActorId: string
      maintenanceDefinitionId: string
      expectedVersion: number
      descriptorChecksum: string
    }[]
    removedEffects: readonly ReturnType<typeof effectReceipt>[]
    characterOwnerTransitions: readonly {
      characterId: string
      beforeStreamVersion: number
      afterStreamVersion: number
    }[]
  } | null
  changedCharacterActors: readonly EncounterRecord['actors'][number][]
}> {
  const effects = createActiveRuleEffectRepository(input.trx)
  // This is deliberately non-locking. It is the complete Character root set
  // required before any maintained/effect row is locked below.
  const characterIds = await effects.listCharacterOwnersForActorRemovalCleanup({
    encounterId: input.encounter.id,
    removedActorId: input.removedActorId
  })
  const lockedCharacters = new Map<
    string,
    {
      streamVersion: number
      mechanics: Awaited<
        ReturnType<
          ReturnType<typeof createCharacterMechanicsProjectionRepository>['requireCurrent']
        >
      >
      overlay: Awaited<
        ReturnType<
          ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
        >
      > | null
    }
  >()
  for (const characterId of characterIds) {
    await lockCharacterAssignmentAuthority(input.trx, characterId)
  }
  const assignmentPresentByCharacterId = new Map<string, boolean>()
  for (const characterId of characterIds) {
    assignmentPresentByCharacterId.set(
      characterId,
      await createCampaignCharacterMechanicsProjectionRepository(input.trx).lockAssignmentIfPresent(
        {
          campaignId: input.encounter.campaignId,
          characterId
        }
      )
    )
  }
  for (const characterId of characterIds) {
    const assignmentPresent = assignmentPresentByCharacterId.get(characterId)
    if (assignmentPresent === undefined)
      throw new EncounterConflictError(
        'Maintained-effect Character assignment lock is unavailable.'
      )
    const character = await input.trx
      .selectFrom('characters')
      .select(['id', 'status', 'stream_version'])
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()
    // A locator can race a prior Character cleanup/cascade. It is harmless
    // unless a subsequently locked effect still names this owner.
    if (!character || character.status !== 'ACTIVE') continue
    const mechanics = await createCharacterMechanicsProjectionRepository(input.trx).requireCurrent({
      characterId,
      expectedStreamVersion: character.stream_version
    })
    const overlay = assignmentPresent
      ? await (async () => {
          const context = await resolveCharacterLiveSessionRuleContext(input.trx, characterId, {
            id: input.encounter.campaignId,
            attunementSlotOverride: input.attunementSlotOverride
          })
          if (!context)
            throw new EncounterConflictError('A maintained-effect Character context is stale.')
          return createCampaignCharacterMechanicsProjectionRepository(input.trx).requireCurrent({
            campaignId: input.encounter.campaignId,
            characterId,
            expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
            expectedCharacterStreamVersion: character.stream_version,
            expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
              adjustments: context.adjustments,
              attunementSlotOverride: context.attunementSlotOverride
            }),
            expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
            baseMechanicsProjection: mechanics
          })
        })()
      : null
    lockedCharacters.set(characterId, {
      streamVersion: character.stream_version,
      mechanics,
      overlay
    })
  }

  const ownedStates = await effects.lockMaintainedStatesByOwner({
    encounterId: input.encounter.id,
    ownerActorId: input.removedActorId
  })
  const states = new Map<string, NonNullable<CleanupState>>()
  for (const state of ownedStates) states.set(state.id, state)
  const effectsToDelete = new Map<string, CleanupEffect>()
  const inspectedCharacterOwners = new Set<string>()
  const inspectCharacterOwners = (rows: readonly CleanupEffect[]) => {
    for (const row of rows)
      if (row.owner.kind === 'CHARACTER') inspectedCharacterOwners.add(row.owner.characterId)
  }
  const addEffects = (rows: readonly CleanupEffect[]) => {
    inspectCharacterOwners(rows)
    for (const effect of rows) effectsToDelete.set(`${ownerKey(effect)}:${effect.id}`, effect)
  }
  for (const state of ownedStates)
    addEffects(
      await effects.lockDependentEffects({ stateId: state.id, encounterId: input.encounter.id })
    )

  // Effects directly owned by the removed Encounter actor end with that actor.
  const actorOwned = await effects.lockByOwner({
    kind: 'ENCOUNTER_ACTOR',
    encounterId: input.encounter.id,
    targetActorId: input.removedActorId
  })
  addEffects(actorOwned)

  // A removed actor can be a dependent of another actor's maintained state.
  for (const effect of actorOwned) {
    if (!effect.maintainedEffectStateId || states.has(effect.maintainedEffectStateId)) continue
    const state = await effects.lockMaintainedStateById({
      encounterId: input.encounter.id,
      stateId: effect.maintainedEffectStateId
    })
    if (!state)
      throw new EncounterConflictError('Maintained effect state changed before actor removal.')
    states.set(state.id, state)
    inspectCharacterOwners(
      await effects.lockDependentEffects({ stateId: state.id, encounterId: input.encounter.id })
    )
  }
  if ([...inspectedCharacterOwners].some((characterId) => !lockedCharacters.has(characterId)))
    throw new EncounterConflictError(
      'A maintained-effect Character owner changed before actor removal.'
    )

  if (effectsToDelete.size === 0 && states.size === 0)
    return { result: null, changedCharacterActors: [] }

  // All rows were locked through their exact maintained state/owner before mutation.
  for (const effect of [...effectsToDelete.values()].sort((left, right) =>
    `${ownerKey(left)}:${left.createdOrdinal.toString().padStart(10, '0')}:${left.id}`.localeCompare(
      `${ownerKey(right)}:${right.createdOrdinal.toString().padStart(10, '0')}:${right.id}`
    )
  ))
    await effects.deleteCas({ id: effect.id, owner: effect.owner, expectedVersion: effect.version })

  // A foreign maintained state only ends when its final dependent was removed.
  const terminated: NonNullable<CleanupState>[] = []
  for (const state of [...states.values()].sort((left, right) =>
    `${left.ownerActorId}:${left.id}`.localeCompare(`${right.ownerActorId}:${right.id}`)
  )) {
    const remaining = await effects.lockDependentEffects({
      stateId: state.id,
      encounterId: input.encounter.id
    })
    if (
      remaining.length !== 0 ||
      (state.descriptor?.schemaVersion === 2 &&
        state.descriptor.emptyDependentPolicy !== 'TERMINATE_WHEN_EMPTY')
    )
      continue
    await effects.deleteMaintainedStateCas({
      id: state.id,
      encounterId: input.encounter.id,
      ownerActorId: state.ownerActorId,
      expectedVersion: state.version
    })
    terminated.push(state)
  }

  const changedCharacterIds = [
    ...new Set(
      [...effectsToDelete.values()].flatMap((effect) =>
        effect.owner.kind === 'CHARACTER' ? [effect.owner.characterId] : []
      )
    )
  ].sort()
  const transitions: {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }[] = []
  const changedCharacterActors: EncounterRecord['actors'][number][] = []
  for (const characterId of changedCharacterIds) {
    const locked = lockedCharacters.get(characterId)
    if (!locked)
      throw new EncounterConflictError('Maintained-effect Character lock is unavailable.')
    const afterStreamVersion = await createCharacterRepository(input.trx).patchSheetState(
      characterId,
      [],
      {
        expectedStreamVersion: locked.streamVersion,
        afterPersist: async (db, nextStreamVersion) => {
          const nextMechanics = advanceCharacterMechanicsProjectionCommandState({
            characterCommandState: locked.mechanics.commandState,
            characterStreamVersion: nextStreamVersion,
            current: locked.mechanics
          })
          await createCharacterMechanicsProjectionRepository(db).advanceLiveCommandState({
            expectedPriorProjectionChecksum: locked.mechanics.projectionChecksum,
            expectedPriorStreamVersion: locked.mechanics.characterStreamVersion,
            projection: nextMechanics
          })
          if (locked.overlay)
            await createCampaignCharacterMechanicsProjectionRepository(db).publish({
              expectedPriorOverlayChecksum: locked.overlay.projectionChecksum,
              projection: compileCampaignCharacterMechanicsProjection({
                campaignId: locked.overlay.campaignId,
                characterId,
                characterStreamVersion: nextStreamVersion,
                baseMechanicsProjectionChecksum: nextMechanics.projectionChecksum,
                mechanicalContextChecksum: locked.overlay.mechanicalContextChecksum,
                manualMaximumModifierOwner: locked.overlay.manualMaximumModifierOwner,
                ...(locked.overlay.kind === 'MATERIALIZED'
                  ? {
                      rulePolicyInput: locked.overlay.rulePolicyInput,
                      rulePolicyOutput: locked.overlay.rulePolicyOutput
                    }
                  : {})
              })
            })
        }
      }
    )
    transitions.push({ characterId, beforeStreamVersion: locked.streamVersion, afterStreamVersion })
    const encounterActor = input.encounter.actors.find(
      (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
    )
    if (encounterActor && encounterActor.id !== input.removedActorId)
      changedCharacterActors.push({ ...encounterActor, sourceRevision: afterStreamVersion })
  }

  return {
    result: {
      terminatedStates: terminated.map((state) => ({
        id: state.id,
        ownerActorId: state.ownerActorId,
        maintenanceDefinitionId: state.maintenanceDefinitionId,
        expectedVersion: state.version,
        descriptorChecksum: state.descriptorChecksum
      })),
      removedEffects: [...effectsToDelete.values()]
        .map(effectReceipt)
        .sort((left, right) =>
          `${left.kind}:${left.ownerId}:${left.createdOrdinal.toString().padStart(10, '0')}:${left.activeEffectId}`.localeCompare(
            `${right.kind}:${right.ownerId}:${right.createdOrdinal.toString().padStart(10, '0')}:${right.activeEffectId}`
          )
        ),
      characterOwnerTransitions: transitions
    },
    changedCharacterActors
  }
}
