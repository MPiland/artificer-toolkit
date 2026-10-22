import { expect, it } from 'vitest'
import type { LiveLoot, LootTable } from '@artificer-toolkit/schema/api/lootTables'
import { listDefeatedCreatureLoot, listSceneLootTables } from './CampaignLiveLootPanel.model'

const campaignId = '11111111-1111-4111-8111-111111111111'
const encounterId = '22222222-2222-4222-8222-222222222222'
const table = (name: string): LootTable => ({
  id: crypto.randomUUID(),
  name,
  ranges: [{ id: crypto.randomUUID(), min: 1, max: null, entries: [] }]
})
const sceneTable = table('Guard room')
const goblinTable = table('Pockets')
const liveLoot: LiveLoot = {
  documents: [
    {
      owner: { kind: 'SCENE', campaignId, sceneDefinitionId: crypto.randomUUID() },
      version: 1,
      tables: [sceneTable]
    },
    {
      owner: { kind: 'ENCOUNTER_ACTOR', campaignId, encounterId, actorId: 'goblin' },
      version: 1,
      tables: [goblinTable]
    },
    {
      owner: { kind: 'ENCOUNTER_ACTOR', campaignId, encounterId, actorId: 'ogre' },
      version: 1,
      tables: [table('Hoard')]
    }
  ]
}

it('lists only defeated creatures that carry tables, never a standing one or a Character', () => {
  expect(
    listDefeatedCreatureLoot(liveLoot, [
      { id: 'goblin', kind: 'CUSTOM', label: 'Goblin', defeated: true },
      { id: 'ogre', kind: 'CREATURE', label: 'Ogre', defeated: false },
      { id: 'bard', kind: 'CHARACTER', label: 'Bard', defeated: true },
      { id: 'rat', kind: 'CREATURE', label: 'Rat', defeated: true }
    ])
  ).toEqual([{ id: 'goblin', label: 'Goblin', tables: [goblinTable] }])
  expect(listDefeatedCreatureLoot(undefined, [])).toEqual([])
})

it('lists the Scene tables, and none before the read arrives', () => {
  expect(listSceneLootTables(liveLoot)).toEqual([sceneTable])
  expect(listSceneLootTables(undefined)).toEqual([])
})
