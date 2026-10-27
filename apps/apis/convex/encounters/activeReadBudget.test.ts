// @vitest-environment node
import { expect, it } from 'vitest'
import { readEncounterSessionState } from '@artificer-toolkit/encounter-persistence/sessionReads'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { requireCampaignAuthority } from '../campaigns/authority'
import { encounterReadTransaction } from './encounterPorts'
import { readActiveRun } from './projectionReads'

it('PROBE active read cost', async () => {
  const fixture = await setupCharacterRun({}, undefined, true)
  await fixture.t.run((ctx) => activateFixtureRun(ctx, fixture.run.id))
  for (const [role, member] of [
    ['owner', fixture.owner],
    ['player', fixture.player]
  ] as const) {
    for (let pass = 0; pass < 2; pass += 1) {
      const started = performance.now()
      await member.caller.query(api.encounters.activeReads.active, {
        campaignId: fixture.campaign.id
      })
      console.log(`PROBE ${role} pass ${pass} query ms`, Math.round(performance.now() - started))
    }
    const totals = createDatabaseIoTotals()
    await member.caller.run(async (ctx) => {
      const counted = { ...ctx, db: countDatabaseIo(ctx.db, totals) }
      const { campaign, membership } = await requireCampaignAuthority(
        counted,
        fixture.campaign.id,
        member.userId
      )
      const started = performance.now()
      await readEncounterSessionState(encounterReadTransaction(counted), {
        row: await readActiveRun(counted, campaign.id),
        campaign,
        membership
      })
      console.log(`PROBE ${role} state ms`, Math.round(performance.now() - started))
    })
    console.log(
      `PROBE ${role} reads`,
      totals.reads.documents,
      totals.reads.bytes,
      JSON.stringify(totals.reads.byTable)
    )
  }
  expect(true).toBe(true)
}, 120000)
