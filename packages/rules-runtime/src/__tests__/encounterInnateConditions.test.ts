import { describe, expect, it } from 'vitest'

import { balor } from '@artificer-toolkit/source-data/srd/creatures/balor.js'
import { couatl } from '@artificer-toolkit/source-data/srd/creatures/couatl.js'
import { invisibleStalker } from '@artificer-toolkit/source-data/srd/creatures/invisible-stalker.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  creatureInnateConditionRows,
  heldConditionIds,
  innateConditionIds
} from '../encounterInnateConditions.js'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  dnd5eAttackTraitGrants,
  dnd5eGrantedAttackTraits
} from '../systems/dnd5e/attackDamageDefenses.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability
} from '../systems/dnd5e/modifierApplicability.js'
import { ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID } from '../encounterRollModeReasons.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdConditionId,
  srdDamageTypeId
} from './encounterCreatureAction.js'
import { srdCreatureActor } from '../testing/dnd5eSrdEncounter.js'

const SOURCE_ID = '00000000-0000-4000-8000-0000000e0001'
const TARGET_ID = '00000000-0000-4000-8000-0000000e0002'
const INVISIBLE = srdConditionId('INVISIBLE')

const innateInvisible = {
  modifierKind: 'ADD_OPTION',
  valueDomainCode: 'CONDITION',
  scope: 'GLOBAL',
  payload: { conditionTypeId: INVISIBLE }
}

describe('innate conditions (SPELLS-33.T4de)', () => {
  it('reads only global CONDITION options that add a condition type', () => {
    expect(
      innateConditionIds([
        innateInvisible,
        innateInvisible,
        { ...innateInvisible, scope: 'SELF' },
        { ...innateInvisible, modifierKind: 'REMOVE_OPTION' },
        { ...innateInvisible, valueDomainCode: 'DAMAGE_RESISTANCE' },
        { ...innateInvisible, payload: { conditionTypeId: ' ' } },
        { ...innateInvisible, payload: undefined }
      ])
    ).toEqual([INVISIBLE])
  })

  it('holds the applied conditions and the innate ones together, once each', () => {
    const state = { conditions: ['a', INVISIBLE] }
    expect(heldConditionIds({ state, innateConditionIds: [INVISIBLE, 'b'] } as never)).toEqual([
      'a',
      INVISIBLE,
      'b'
    ])
    expect(heldConditionIds({ state, innateConditionIds: [] } as never)).toBe(state.conditions)
  })

  it('shows the SRD Invisible Stalker’s innate condition as a row marked innate', () => {
    const actor = srdCreatureActor({ id: SOURCE_ID, creature: invisibleStalker })
    expect(creatureInnateConditionRows(actor.snapshot)).toEqual([
      { conditionTypeId: INVISIBLE, innate: true }
    ])
    expect(actor.conditions).toEqual([])
    expect(
      creatureInnateConditionRows(srdCreatureActor({ id: SOURCE_ID, creature: balor }).snapshot)
    ).toEqual([])
  })

  it('uses the SRD Invisible condition type', () => {
    expect(SRD_CONDITION_TYPES.some(({ code }) => code === 'INVISIBLE')).toBe(true)
  })
})

/** A Quill Beast, or `attacker` as the Creature, volleys at the Invisible Stalker. */
function volleyAtStalker(attacker?: typeof couatl) {
  return prepareCreatureAction({
    actor: creatureActor({
      id: SOURCE_ID,
      label: 'Attacker',
      ...(attacker ? { statBlock: attacker } : {}),
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
    }),
    target: srdCreatureActor({ id: TARGET_ID, creature: invisibleStalker }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true,
    attackPerception: true
  })
}

const sourceIds = (prepared: Awaited<ReturnType<typeof volleyAtStalker>>) =>
  prepared.relationshipContributors.map((contributor) => contributor.sourceId)

describe('the Invisible Stalker’s innate Invisibility in the attack flow', () => {
  it('rolls with disadvantage for an attacker that cannot see invisible creatures', async () => {
    expect(sourceIds(await volleyAtStalker())).toContain(
      ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID
    )
  })

  it('takes no disadvantage from an attacker whose Truesight sees invisible creatures', async () => {
    expect(sourceIds(await volleyAtStalker(couatl))).not.toContain(
      ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID
    )
  })
})

describe('Magic Weapons as an attack-trait grant (SPELLS-33.T4de)', () => {
  const piercing = srdDamageTypeId('PIERCING')

  /** The target's hit points after a Quill Volley (hit on a natural 10) at a Wolf immune to nonmagical piercing. */
  async function hitPointsAfterVolley(statBlock?: typeof balor) {
    const prepared = await prepareCreatureAction({
      actor: creatureActor({
        id: SOURCE_ID,
        label: 'Attacker',
        ...(statBlock ? { statBlock } : {}),
        features: [quillVolley({ charges: 3, cost: 1, rangeFeet: 60 })]
      }),
      target: creatureActor({
        id: TARGET_ID,
        label: 'Wolf',
        features: [],
        qualifiedDamageDefenses: [
          { kind: 'IMMUNITY', damageTypeIds: [piercing], bypassedBy: ['MAGICAL', 'SILVERED'] }
        ]
      }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    const { mechanics } = await settleCreatureAction({ prepared, rolls: [10] })
    return mechanics.mechanics.targetTransition.after.currentHitPoints
  }

  it('lets a Creature with the grant harm a nonmagical-immune target, as a Character with it would', async () => {
    expect(await hitPointsAfterVolley()).toBe(11)
    expect(await hitPointsAfterVolley(balor)).toBe(8)
    const { creatureFacts } = {
      creatureFacts: srdCreatureActor({ id: SOURCE_ID, creature: balor }).snapshot
    }
    const modifiers = (
      creatureFacts as { ruleFacts: { modifiers: CharacterGrantFoldOutput['modifiers'] } }
    ).ruleFacts.modifiers
    const grants = dnd5eAttackTraitGrants(modifiers, dnd5eAcceptedModifierApplicability)
    expect([...dnd5eGrantedAttackTraits(grants, DND5E_CHARACTER_WIDE_TARGET)]).toEqual(['MAGICAL'])
  })
})
