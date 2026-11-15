import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { LOOT_RANGE_REFUSAL } from '@artificer-toolkit/shared/vtt/lootTable'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { getCampaignEncounters, getEncounter } from '#app/data/encounters/queries'
import { writesTo } from '#app/test/storybook/storyWrites'
import { SeededCampaign } from '../stories/SeededCampaign'
import { STORY_CAMPAIGN } from '../../../../../apis/tests/developmentReviewDataScenarios'
import { CampaignLootEditor } from './CampaignLootEditor'

/** The loot editor on the story Run's creature, found as the Encounter page finds it. */
function SeededCreatureLoot({ campaign }: { campaign: CampaignDetailDto }) {
  const encounters = useQuery(getCampaignEncounters(campaign.id))
  const run = encounters.data?.find(({ name }) => name === STORY_CAMPAIGN.blueprintName)
  const projection = useQuery(getEncounter(run?.id ?? null))
  const actor = projection.data?.actors.find(({ label }) => label === STORY_CAMPAIGN.enemyLabel)
  return run && actor ? (
    <CampaignLootEditor
      gameSystemId={campaign.gameSystemId}
      owner={{
        kind: 'ENCOUNTER_ACTOR',
        campaignId: campaign.id,
        encounterId: run.id,
        actorId: actor.id
      }}
      subject='Creature'
    />
  ) : null
}

function CreatureLootFixture() {
  return <SeededCampaign>{(campaign) => <SeededCreatureLoot campaign={campaign} />}</SeededCampaign>
}

// Reads the story account's seeded Run and its creature's loot table (D218, D221); writes are spies.
const meta = {
  title: 'Domains/Campaigns/Loot Editor',
  component: CreatureLootFixture,
  parameters: { a11y: { test: 'error' }, layout: 'fullscreen' }
} satisfies Meta<typeof CreatureLootFixture>

export default meta

type Story = StoryObj<typeof meta>

export const EncounterCreature: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByRole('region', { name: 'Creature loot tables' })
    const table = await within(editor).findByRole('group', {
      name: `Loot table ${STORY_CAMPAIGN.lootTable.name}`
    })
    await expect(within(table).getByLabelText('Amount')).toHaveValue(
      String(STORY_CAMPAIGN.lootTable.coinAmount)
    )

    const revised = `${STORY_CAMPAIGN.lootTable.name} revised`
    await userEvent.type(within(table).getByLabelText('Table name'), ' revised')
    await userEvent.click(within(editor).getByRole('button', { name: 'Save loot' }))
    await waitFor(() =>
      expect(writesTo(api.loot.tables.save)).toEqual([
        expect.objectContaining({
          owner: expect.objectContaining({ kind: 'ENCOUNTER_ACTOR' }),
          expectedVersion: 1,
          tables: [expect.objectContaining({ name: revised })]
        })
      ])
    )
    await expect(
      await within(editor).findByRole('group', { name: `Loot table ${revised}` })
    ).toBeVisible()
  }
}

/** Adds a second table with an item and coins from the real catalogue and System, then overlaps its ranges. */
export const AuthorsTableAndRefusesOverlap: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByRole('region', { name: 'Creature loot tables' })
    await within(editor).findByRole('group', {
      name: `Loot table ${STORY_CAMPAIGN.lootTable.name}`
    })

    await userEvent.click(within(editor).getByRole('button', { name: 'Add loot table' }))
    const [, name] = within(editor).getAllByRole('textbox', { name: 'Table name' })
    await userEvent.clear(name!)
    await userEvent.type(name!, 'Guard room')
    const table = within(editor).getByRole('group', { name: 'Loot table Guard room' })
    const first = within(table).getByRole('group', { name: 'Table 2 range 1' })
    // The equipment catalogue loads from content snapshots after the manifest, so the picker fills late.
    await waitFor(
      () => expect(within(first).getByRole('button', { name: 'Add item' })).toBeEnabled(),
      { timeout: 15_000 }
    )
    await userEvent.click(within(first).getByRole('button', { name: 'Add item' }))
    await userEvent.click(within(first).getByRole('button', { name: 'Add coins' }))
    await expect(within(first).getByRole('combobox', { name: 'Item' })).not.toHaveValue('')
    await expect(within(first).getByRole('combobox', { name: 'Coin' })).not.toHaveValue('')

    await userEvent.click(within(editor).getByRole('button', { name: 'Save loot' }))
    await waitFor(() =>
      expect(writesTo(api.loot.tables.save)).toEqual([
        expect.objectContaining({
          expectedVersion: 1,
          tables: [
            expect.objectContaining({ name: STORY_CAMPAIGN.lootTable.name }),
            expect.objectContaining({
              name: 'Guard room',
              ranges: [
                expect.objectContaining({
                  entries: [
                    expect.objectContaining({ kind: 'ITEM' }),
                    expect.objectContaining({ kind: 'COIN' })
                  ]
                })
              ]
            })
          ]
        })
      ])
    )
    await waitFor(() =>
      expect(within(editor).getByRole('button', { name: 'Save loot' })).toBeDisabled()
    )

    await userEvent.click(within(table).getByRole('button', { name: 'Add range' }))
    const second = within(table).getByRole('textbox', { name: 'Table 2 range 2 roll from' })
    await userEvent.clear(second)
    await userEvent.type(second, '1')
    await expect(await within(editor).findByRole('alert')).toHaveTextContent(
      LOOT_RANGE_REFUSAL.OVERLAP
    )
    await expect(within(editor).getByRole('button', { name: 'Save loot' })).toBeDisabled()
  }
}
