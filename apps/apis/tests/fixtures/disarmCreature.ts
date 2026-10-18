import { srdWolf as wolf } from './srdCreatures'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { toCreatureFeatureEffects } from './creatureWeaponEffects'

export const disarmHeldEntryId = '10000000-0000-4000-8000-000000000201'
export const disarmOtherEntryId = '10000000-0000-4000-8000-000000000202'
export const disarmShieldEntryId = '10000000-0000-4000-8000-000000000204'

// Pure authored records shared by transactional and real-backend Disarm proofs. Proofs without a
// Scene reach any creature; a proof on a Scene keeps the club's authored melee reach (`reach`).
export function createDisarmWeapon(
  id = '10000000-0000-4000-8000-000000000203',
  { reach = false }: { reach?: boolean } = {}
) {
  return {
    ...club,
    id,
    effects: club.effects?.map((effect) => ({
      ...effect,
      invocation: {
        ...effect.invocation,
        range: reach
          ? effect.invocation.range
          : { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
        targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
      }
    }))
  }
}

export function createDisarmCreature(weapon: typeof club, id = wolf.id, withShield = false) {
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('Missing Wolf Bite.')
  return {
    ...wolf,
    id,
    features: wolf.features?.map((feature) =>
      feature.id === bite.id
        ? {
            ...feature,
            effects: toCreatureFeatureEffects(weapon.effects),
            rollDefinitions: [
              {
                id: crypto.randomUUID(),
                label: 'Disarm weapon attack',
                kind: 'ATTACK' as const,
                expression: { count: 1, die: 20, modifier: 4 },
                rollMode: 'NORMAL' as const,
                chargeCost: null,
                order: 1
              }
            ]
          }
        : feature
    ),
    equipmentLoadout: [
      {
        id: disarmHeldEntryId,
        equipmentId: weapon.id,
        quantity: 1,
        useState: 'MAIN_HAND' as const,
        attuned: false,
        actionFeatureIds: [bite.id]
      },
      {
        id: disarmOtherEntryId,
        equipmentId: dagger.id,
        quantity: 1,
        useState: 'CARRIED' as const,
        attuned: false,
        actionFeatureIds: []
      },
      ...(withShield
        ? [
            {
              id: disarmShieldEntryId,
              equipmentId: shieldWood.id,
              quantity: 1,
              useState: 'OFF_HAND' as const,
              attuned: false,
              actionFeatureIds: []
            }
          ]
        : [])
    ]
  }
}
