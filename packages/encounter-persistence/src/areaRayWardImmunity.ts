import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSettledIncomingGateDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { snapshotCreatureTypeId } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { passedHeldWard } from '@artificer-toolkit/rules-runtime/encounterWardImmunity'

/** The source immunities among the grants a creature's outcome created: what a passed ward leaves. */
export function createdWardImmunities(
  created: readonly ActiveRuleEffectRecord[],
  grantEffectIds: readonly string[]
) {
  return created.filter(
    ({ id, definition }) =>
      grantEffectIds.includes(id) &&
      definition.stateContributions.some(({ kind }) => kind === 'SOURCE_IMMUNITY')
  )
}

/**
 * Proves the immunities an area's kept rays left are exactly the ones their passed wards owe: a ward
 * the holder still stores with a success immunity leaves one on its first passing ray and none on the
 * rest; a ward the holder stores without one leaves none; a ward the holder's features carry (not
 * stored as an effect) leaves at most one. Each must be the ward's own, the caster's, and on a pass of
 * that holder. The room's plan is never trusted: the ward is read from the holder's stored effects.
 */
export async function requireRayWardImmunities(input: {
  caster: EncounterRunActorState
  /** The kept caught entries in commit order. */
  entries: readonly {
    actorId: string
    passedGate: Pick<EncounterSettledIncomingGateDto, 'origin'> | undefined
    immunities: readonly ActiveRuleEffectRecord[]
  }[]
  readHolderEffects(actorId: string): Promise<readonly ActiveRuleEffectRecord[]>
}) {
  const { caster } = input
  const settled = new Set<string>()
  for (const { actorId, passedGate, immunities } of input.entries) {
    const origin = passedGate?.origin.kind === 'WARD' ? passedGate.origin : null
    const key = origin && `${actorId}:${origin.effectId}`
    const first = key !== null && !settled.has(key)
    if (key) settled.add(key)
    let allowed = 0
    if (origin && first) {
      if (origin.holderActorId !== actorId)
        throw new Error('Live Session ray ward holder mismatch.')
      const effects = await input.readHolderEffects(actorId)
      if (effects.some(({ id }) => id === origin.effectId)) {
        const ward = passedHeldWard({
          holderActorId: actorId,
          effects,
          grantFold: null,
          attackerCreatureTypeId: snapshotCreatureTypeId(caster),
          attacker: {
            actorId: caster.id,
            characterId: caster.kind === 'CHARACTER' ? caster.sourceId : null
          },
          passed: passedGate
        })
        allowed = ward?.payload.successImmunity ? 1 : 0
        // A stored ward's immunity is owed whole: a plan that left it out is refused.
        if (immunities.length !== allowed)
          throw new Error('Live Session ray ward immunity mismatch.')
      } else allowed = 1
    }
    if (
      immunities.length > allowed ||
      immunities.some(
        ({ definition }) =>
          definition.origin.kind !== 'ENCOUNTER' ||
          definition.origin.sourceActorId !== caster.id ||
          definition.stateContributions.some(
            (contribution) =>
              contribution.kind === 'SOURCE_IMMUNITY' &&
              (contribution.immuneToId !== origin?.effectId ||
                contribution.sourceCharacterId !==
                  (caster.kind === 'CHARACTER' ? caster.sourceId : null))
          )
      )
    )
      throw new Error('Live Session ray ward immunity mismatch.')
  }
}
