import { describe, expect, it } from 'vitest'
import { buildCharacterHandRuleFacts } from '../character/characterHandRuleFacts.js'
import { buildCharacterItemMechanicsRuleFacts } from '../character/characterItemMechanicsRuleFacts.js'
import { unarmedStrike } from '@artificer-toolkit/source-data/srd/equipment/unarmed-strike.js'

import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

const UNARMED_LABEL = unarmedStrike.label

const unarmedRow = (sheet: Awaited<ReturnType<typeof prepareFixtureSheet>>) =>
  sheet.sheet.actions.items.find((action) => action.label.includes(UNARMED_LABEL))

describe('Character Unarmed Strike (SPELLS-31.T4l2)', () => {
  it('gives every Character a strike for 1 + Strength bludgeoning, proficient, with nothing held', async () => {
    const fixture = readyFighterFixture()
    const sheet = await prepareFixtureSheet({
      character: fixture.character,
      documents: fixture.documents
    })

    const damage = unarmedRow(sheet)?.mechanic?.outcomes.find(
      (outcome) => outcome.kind === 'DAMAGE'
    )
    expect(damage).toMatchObject({ expression: '3' })
  })

  it('has no strike when the System names no default (no fallback)', async () => {
    const fixture = readyFighterFixture()
    const sheet = await prepareFixtureSheet({
      character: fixture.character,
      documents: fixture.documents,
      gameSystem: {
        ...system,
        defaults: { ...system.defaults!, unarmedStrikeEquipmentId: undefined }
      }
    })

    expect(unarmedRow(sheet)).toBeUndefined()
  })

  it('keeps the natural weapon out of the inventory, rule items, attunement and Builder', async () => {
    const fixture = readyFighterFixture()
    const sheet = await prepareFixtureSheet({
      character: fixture.character,
      documents: fixture.documents
    })

    expect(sheet.sheet.inventory.items.map((item) => item.equipmentId)).not.toContain(
      unarmedStrike.id
    )
    expect(sheet.ruleEvaluation.snapshot.equipmentItems).toEqual([])
    expect(sheet.ruleEvaluation.snapshot.naturalWeapon?.contentRef.definitionId).toBe(
      unarmedStrike.id
    )
    expect(sheet.ruleEvaluation.snapshot.naturalWeapon).not.toHaveProperty('attuned')

    const builder = await prepareFixtureBuilder({
      character: fixture.character,
      documents: fixture.documents
    })
    expect(builder.context.catalog.equipment.map(({ id }) => id)).not.toContain(unarmedStrike.id)
  })

  it('counts the natural weapon in no hand, grip or carried weight', async () => {
    const fixture = readyFighterFixture()
    const sheet = await prepareFixtureSheet({
      character: fixture.character,
      documents: fixture.documents
    })
    const { snapshot } = sheet.ruleEvaluation
    const naturalId = snapshot.naturalWeapon?.instanceId
    expect(naturalId).toBeDefined()

    const heldIds = buildCharacterHandRuleFacts(snapshot).handFacts.items.map(
      (item) => item.itemInstanceId
    )
    const weighedIds = buildCharacterItemMechanicsRuleFacts(snapshot).itemMechanicsFacts.items.map(
      (item) => item.itemInstanceId
    )
    expect(heldIds).not.toContain(naturalId)
    expect(weighedIds).not.toContain(naturalId)
    expect(unarmedRow(sheet)).toBeDefined()
  })
})
