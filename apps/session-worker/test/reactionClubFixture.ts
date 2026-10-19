import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/authored'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import {
  EQUIPMENT_GRIP,
  meleeWeaponAbilityModifiers,
  meleeWeaponEffects
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'

import { testUuid } from '../src/testing/liveCaptureFixture.js'

const REACTION_CLUB_ID = testUuid(0xe120)

/** A one-handed weapon of `damageTypeCode` the Fighter attacks with as an opportunity attack, taken as a Reaction when a creature leaves its reach. */
export function reactionWeapon(damageTypeCode: string): EquipmentAuthored {
  const [attack] = meleeWeaponEffects(
    REACTION_CLUB_ID,
    damageTypeCode,
    '1d4',
    EQUIPMENT_GRIP.ONE_HANDED
  )
  if (!attack || attack.invocation.kind !== 'ACTION' || attack.invocation.triggerCode === 'CHECK')
    throw new Error('The melee attack is missing.')
  return {
    ...club,
    id: REACTION_CLUB_ID,
    label: 'Reaction Club',
    modifiers: meleeWeaponAbilityModifiers(REACTION_CLUB_ID),
    effects: [
      {
        ...attack,
        invocation: {
          ...attack.invocation,
          activation: { code: 'REACTION' as const, amount: 1 },
          reactionTrigger: {
            kind: 'MOVEMENT' as const,
            stage: 'BEFORE_LEAVE_REACH' as const,
            perceptionRequirement: null,
            eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
            movementInterruption: null
          }
        }
      }
    ]
  }
}

/** A Club the Fighter attacks with as an opportunity attack, taken as a Reaction when a creature leaves its reach. */
export const reactionClub = reactionWeapon('BLUDGEONING')
