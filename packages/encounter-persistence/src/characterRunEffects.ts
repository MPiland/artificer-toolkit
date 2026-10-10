import { planConcentrationCarriedGrantEnds } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * D81: leaving a Campaign ends what its Runs put on the Character. Each of the Character's effects
 * whose source Run `classifyRun` names goes, the conditions only those effects held end, and the
 * Character stream moves once. A maintained state left without dependents ends by its policy only
 * in a TERMINABLE Run; a room-held Run's states are the room's to settle.
 */
export async function endCharacterRunEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    characterId: string
    /** `null` leaves effects of a Run outside the departed Campaign. */
    classifyRun: (encounterId: string) => Promise<'TERMINABLE' | 'ROOM_HELD' | null>
    occurredAt: string
  }
): Promise<void> {
  const store = createActiveRuleEffectStore(ctx)
  const owner = { kind: 'CHARACTER', characterId: input.characterId } as const
  const runs = new Map<string, 'TERMINABLE' | 'ROOM_HELD' | null>()
  const removed: ActiveRuleEffectRecord[] = []
  for (const effect of await store.list(owner)) {
    const encounterId = effect.sourceEncounterId
    if (encounterId === null) continue
    if (!runs.has(encounterId)) runs.set(encounterId, await input.classifyRun(encounterId))
    if (runs.get(encounterId) !== null) removed.push(effect)
  }
  if (removed.length === 0) return
  const row = await ctx.ports.readCharacterRow(input.characterId)
  if (!row) throw new Error('Departing Character is unavailable.')
  for (const effect of removed)
    await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })

  const emptiedStates = new Map<string, string>()
  for (const effect of removed)
    if (
      effect.maintainedEffectStateId !== null &&
      runs.get(effect.sourceEncounterId!) === 'TERMINABLE'
    )
      emptiedStates.set(effect.maintainedEffectStateId, effect.sourceEncounterId!)
  for (const [stateId, encounterId] of emptiedStates) {
    // The room may have ended a state whose departed dependents it stopped counting.
    const state = await store.findMaintainedStateById({ encounterId, stateId })
    if (!state) continue
    const terminalWhenEmpty =
      state.descriptor.schemaVersion === 1 ||
      state.descriptor.emptyDependentPolicy === 'TERMINATE_WHEN_EMPTY'
    if (
      terminalWhenEmpty &&
      (await store.listDependentEffects({ encounterId, stateId })).length === 0
    )
      await store.deleteMaintainedStateCas({
        id: state.id,
        encounterId,
        ownerActorId: state.ownerActorId,
        expectedVersion: state.version
      })
  }

  await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: removed[0]!.sourceEncounterId!,
    maintenance: {
      removed,
      characterVersions: [
        { characterId: input.characterId, beforeStreamVersion: row.play.streamVersion }
      ]
    },
    actors: [],
    occurredAt: input.occurredAt
  })
}

/**
 * D99, SPELLS-5.7: a Character that started a Concentration ends the carried-over Concentration
 * grants stamped with it. The room ended them for the Characters it held; this ends them on every
 * other Character (the caster's index finds them; `includesHolder` picks the holders this call
 * settles), in the checkpoint that first carries the caster's id, or when the caster ends the
 * Concentration by choice. A holder's stream moves once and a hit-point maximum the grant raised
 * clamps the current hit points. A repeat finds nothing to end. Returns the ended effects.
 */
export async function endCarriedGrantsOfConcentratingCasters(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    encounterId: string | null
    casterCharacterIds: readonly string[]
    /** The holders this call settles; a room settles its own Characters, a checkpoint the rest. */
    includesHolder: (characterId: string) => boolean
    /** Characters whose stream this transaction already moved once (the command's own Character). */
    advancedCharacterIds?: ReadonlySet<string>
    occurredAt: string
  }
): Promise<ActiveRuleEffectRecord[]> {
  const store = createActiveRuleEffectStore(ctx)
  const carried = new Map<string, ActiveRuleEffectRecord>()
  for (const casterCharacterId of input.casterCharacterIds)
    for (const effect of planConcentrationCarriedGrantEnds({
      casterCharacterId,
      effects: await store.listCarriedByCaster(casterCharacterId)
    }))
      if (effect.owner.kind === 'CHARACTER' && input.includesHolder(effect.owner.characterId))
        carried.set(effect.id, effect)
  const byHolder = new Map<string, ActiveRuleEffectRecord[]>()
  for (const effect of carried.values()) {
    const holderId = effect.owner.kind === 'CHARACTER' ? effect.owner.characterId : ''
    byHolder.set(holderId, [...(byHolder.get(holderId) ?? []), effect])
  }
  const ended: ActiveRuleEffectRecord[] = []
  for (const [characterId, removed] of [...byHolder].sort(([a], [b]) => a.localeCompare(b))) {
    const owner = { kind: 'CHARACTER', characterId } as const
    const row = await ctx.ports.readCharacterRow(characterId)
    if (!row) throw new Error('Carried-grant Character is unavailable.')
    for (const effect of removed)
      await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
    await reconcileNativeMaintenanceOwners(ctx, {
      encounterId: input.encounterId,
      maintenance: {
        removed,
        characterVersions: [
          {
            characterId,
            beforeStreamVersion:
              row.play.streamVersion - (input.advancedCharacterIds?.has(characterId) ? 1 : 0)
          }
        ]
      },
      actors: [],
      occurredAt: input.occurredAt
    })
    ended.push(...removed)
  }
  return ended
}

/**
 * A completing Run ends what it put on its Characters for the Encounter only (the effects it
 * sources); grants that outlast the Encounter stay (D99). A Concentration grant is one of them: it
 * is detached from the Run's maintained state and stamped with the Character that cast it (null for
 * a Creature), so the Campaign clock carries it on (SPELLS-5.7).
 */
export async function endCompletedRunCharacterEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: { state: EncounterRunState; occurredAt: string }
): Promise<void> {
  const store = createActiveRuleEffectStore(ctx)
  const actors = await readRunActors(ctx, input.state)
  const removed: ActiveRuleEffectRecord[] = []
  const characterVersions: { characterId: string; beforeStreamVersion: number }[] = []
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const owner = { kind: 'CHARACTER', characterId: actor.sourceId } as const
    const sourced = (await store.list(owner)).filter(
      ({ sourceEncounterId }) => sourceEncounterId === input.state.id
    )
    const isConcentrationGrant = ({ definition }: ActiveRuleEffectRecord) =>
      definition.recurrence.lifetimeScope === 'OWNER'
    for (const effect of sourced.filter(isConcentrationGrant)) {
      if (!effect.maintainedEffectStateId)
        throw new Error('A Run-sourced grant that outlasts its Run needs a maintained state.')
      const maintained = await store.findMaintainedStateById({
        encounterId: input.state.id,
        stateId: effect.maintainedEffectStateId
      })
      if (!maintained) throw new Error('Maintained effect state is unavailable.')
      const caster = actors.find(({ id }) => id === maintained.ownerActorId)
      await store.detachMaintainedCas({
        id: effect.id,
        characterId: actor.sourceId,
        expectedVersion: effect.version,
        lifecycle: {
          ...effect.lifecycle,
          concentrationCasterCharacterId: caster?.kind === 'CHARACTER' ? caster.sourceId : null
        }
      })
    }
    const ended = sourced.filter((effect) => !isConcentrationGrant(effect))
    if (ended.length === 0) continue
    const row = await ctx.ports.readCharacterRow(actor.sourceId)
    if (!row) throw new Error('Run Character is unavailable.')
    characterVersions.push({
      characterId: actor.sourceId,
      beforeStreamVersion: row.play.streamVersion
    })
    for (const effect of ended)
      await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
    removed.push(...ended)
  }
  if (removed.length === 0) return
  await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: input.state.id,
    maintenance: { removed, characterVersions },
    actors,
    occurredAt: input.occurredAt
  })
}
