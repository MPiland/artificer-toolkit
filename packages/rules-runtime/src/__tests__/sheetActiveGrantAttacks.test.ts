import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { shillelagh } from '@artificer-toolkit/source-data/srd/spells/shillelagh.js'

import { buildMovementTarget, type CharacterMovementFacts } from '../encounterMovementTargets.js'
import { projectCharacterTurnActions } from '../character/turnFacts.js'
import { prepareFixtureSheet, readyFighterFixture } from '../testing/characterContextFixtures.js'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  characterActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { blessEffect, plannedGrantEffect } from './antitoxinEffectFixture.js'

/**
 * SPELLS-8.6: the Sheet's attack and damage rows fold the Character's active grants through the
 * same code the room's turns read, so what the Sheet shows is what the room rolls.
 */
const HOLDER_ID = testUuid(0x8f01)
const SHILLELAGH_ID = testUuid(0x8f02)
const BLESS_ID = testUuid(0x8f03)
const CLUB_ITEM_ID = 'held-club'

/** Shillelagh as the real compiler plans it, bound to the Fighter's held Club. */
function shillelaghOnClub(): ActiveRuleEffectRecord {
  const planned = plannedGrantEffect({
    id: SHILLELAGH_ID,
    holderActorId: HOLDER_ID,
    effect: shillelagh.effects?.[0],
    sourceLabel: shillelagh.label
  })
  return {
    ...planned,
    definition: {
      ...planned.definition,
      stateContributions: planned.definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? {
              ...contribution,
              boundItem: {
                kind: 'EQUIPMENT_INSTANCE' as const,
                equipmentId: club.id,
                itemInstanceId: CLUB_ITEM_ID
              }
            }
          : contribution
      )
    }
  }
}

/** A Fighter holding a Club, with `activeEffects`: its Sheet, and the room's turn actions over it. */
async function fighterWithClub(activeEffects: ActiveRuleEffectRecord[]) {
  const fixture = readyFighterFixture()
  const character = {
    ...fixture.character,
    state: {
      ...fixture.character.state,
      equipment: {
        inventory: [{ id: CLUB_ITEM_ID, equipmentId: club.id, quantity: 1 }],
        equipped: [{ itemId: CLUB_ITEM_ID, slot: 'MAIN_HAND' as const }],
        attuned: []
      }
    }
  }
  const sheet = await prepareFixtureSheet({
    character,
    documents: fixture.documents,
    activeEffects
  })
  const characterFacts: CharacterMovementFacts = {
    active: { id: character.id, checksum: 'a'.repeat(64), play: { streamVersion: 1 } },
    character: sheet.prepared.character,
    campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
    prepared: sheet.prepared,
    ruleEvaluation: sheet.ruleEvaluation
  }
  const target = buildMovementTarget({
    actor: characterActor({ id: HOLDER_ID, characterId: character.id }),
    activeEffects,
    characterFacts,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID
  })
  if (!target.effectiveRulePolicyOutput) throw new Error('The room built no Character policy.')
  const roomActions = projectCharacterTurnActions(
    { ...sheet, ...characterFacts, sheetState: sheet.sheetState, activeEffects },
    target.effectiveRulePolicyOutput,
    []
  )
  const clubRow = (items: typeof roomActions) => {
    const row = items.find((action) => action.label.includes(club.label) && action.mechanic)
    if (!row?.mechanic) throw new Error('No Club attack row.')
    return row.mechanic
  }
  return { sheet: clubRow(sheet.sheet.actions.items), room: clubRow(roomActions) }
}

const damageOf = (mechanic: Awaited<ReturnType<typeof fighterWithClub>>['sheet']) =>
  mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')

describe('Sheet attack rows under active grants (SPELLS-8.6)', () => {
  it('rolls the Club d8 under Shillelagh, as the room does, and its d4 without it', async () => {
    const plain = await fighterWithClub([])
    expect(damageOf(plain.sheet)?.expression).toMatch(/^1d4\b/)

    const shillelagh = await fighterWithClub([shillelaghOnClub()])
    expect(damageOf(shillelagh.sheet)?.expression).toMatch(/^1d8\b/)
    expect(shillelagh.sheet.attackBonus).toBe(shillelagh.room.attackBonus)
    expect(damageOf(shillelagh.sheet)).toEqual(damageOf(shillelagh.room))
  })

  it('shows the d4 Bless adds to the attack roll, the dice the room adds', async () => {
    const blessed = await fighterWithClub([blessEffect({ id: BLESS_ID, holderActorId: HOLDER_ID })])
    expect(blessed.sheet.attackAddedDice).toEqual([
      { label: 'Bless', count: 1, faces: 4, sign: 'ADD' }
    ])
    expect(blessed.sheet).toEqual(blessed.room)
  })

  it('matches the room row for row with no active grant', async () => {
    const plain = await fighterWithClub([])
    expect(plain.sheet).toEqual(plain.room)
  })
})
