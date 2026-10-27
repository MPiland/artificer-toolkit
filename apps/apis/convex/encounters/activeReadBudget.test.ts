// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readEncounterSessionState } from '@artificer-toolkit/encounter-persistence/sessionReads'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import { encounterReadTransaction } from './encounterPorts'
import { readActiveRun } from './projectionReads'

/**
 * The Builder-owned Character collections and draft: a Character with a large inventory or spell
 * list must not make the tabletop's session read heavier, so the read checks the build checksum
 * and never hydrates them.
 */
const CHARACTER_STRUCTURE_TABLES = [
  'characterDrafts',
  'characterInventoryItems',
  'characterCurrencyGroups',
  'characterClassSpellStates',
  'characterSpellCustomizations',
  'characterCreatureInstances',
  'characterVehicleInstances',
  'characterNotes',
  'characterNoteGroups',
  'characterExtraEquipment'
]

/**
 * Measured 2026-10-27 on this fixture (two Characters, one custom enemy): the GM's read was 113 KB
 * with each Character's structure hydrated twice and about 75 KB without; the System document is
 * 34 KB of it.
 */
const SESSION_READ_BYTES = 90_000

describe('Encounter session read budget', () => {
  it('reads no Character structure and stays within its byte budget for the GM and a player', async () => {
    const fixture = await setupCharacterRun({}, undefined, true)
    await fixture.t.run((ctx) => activateFixtureRun(ctx, fixture.run.id))
    for (const member of [fixture.owner, fixture.player]) {
      const totals = createDatabaseIoTotals()
      const state = await member.caller.run(async (ctx) => {
        const counted = { ...ctx, db: countDatabaseIo(ctx.db, totals) }
        const { campaign, membership } = await requireCampaignAuthority(
          counted,
          fixture.campaign.id,
          member.userId
        )
        return readEncounterSessionState(encounterReadTransaction(counted), {
          row: await readActiveRun(counted, campaign.id),
          campaign,
          membership
        })
      })
      expect(state.encounter?.actors.length).toBeGreaterThan(0)
      expect(
        Object.keys(totals.reads.byTable).filter((table) =>
          CHARACTER_STRUCTURE_TABLES.includes(table)
        )
      ).toEqual([])
      expect(totals.reads.bytes).toBeLessThanOrEqual(SESSION_READ_BYTES)
    }
  }, 120000)
})
