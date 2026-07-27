import { characterSheetFixture } from '#domains/characters/character.fixtures'
import {
  spellPanelFixture,
  spellsPanelFixture
} from '#domains/characters/components/sheet/panels/characterSheetPanel.fixtures'
import {
  projectOptimisticCharacterSheet,
  projectOptimisticCharacterSheetPanel
} from './optimisticSheet'

const commandBase = {
  commandId: '00000000-0000-4000-8000-000000000999',
  expectedVersion: characterSheetFixture.meta.streamVersion
}

describe('optimistic Character Sheet projections', () => {
  it('projects spell-source customization into the Sheet and open spell panel', () => {
    const command = {
      ...commandBase,
      type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION' as const,
      source: spellPanelFixture.source,
      customName: 'Force Darts',
      notes: 'Prepared for the vault.',
      displayAsAttack: true
    }

    const sheet = projectOptimisticCharacterSheet(characterSheetFixture, command)
    const panel = projectOptimisticCharacterSheetPanel(spellPanelFixture, command)
    const source = sheet.spells.spells.find((spell) => spell.id === spellPanelFixture.spellId)
      ?.sources?.[0]

    expect(source).toMatchObject({
      customName: 'Force Darts',
      notes: 'Prepared for the vault.',
      displayAsAttack: true
    })
    expect(panel).toMatchObject({
      kind: 'SPELL',
      title: 'Force Darts',
      displayName: 'Force Darts',
      displayAsAttack: true
    })
  })

  it('projects prepared spells across Sheet and panel source entries', () => {
    const panelSources =
      spellsPanelFixture.kind === 'SPELLS'
        ? spellsPanelFixture.groups.flatMap((group) => group.sources)
        : []
    const command = {
      ...commandBase,
      type: 'SET_PREPARED_SPELLS' as const,
      classId: panelSources[0]?.preparationClassId ?? 'class-wizard',
      spellIds: panelSources.slice(0, 2).map((source) => source.spellId)
    }

    const sheet = projectOptimisticCharacterSheet(characterSheetFixture, command)
    const panel = projectOptimisticCharacterSheetPanel(spellsPanelFixture, command)

    expect(sheet.spells.spells.find((spell) => spell.id === command.spellIds[0])?.prepared).toBe(
      true
    )
    expect(
      panel.kind === 'SPELLS'
        ? panel.groups
            .flatMap((group) => group.sources)
            .find((source) => source.spellId === command.spellIds[0])?.prepared
        : undefined
    ).toBe(true)
  })

  it('updates direct resource usage without changing its calculated maximum', () => {
    const command = {
      ...commandBase,
      type: 'USE_SHEET_RESOURCE' as const,
      owner: characterSheetFixture.resources.items[1].owner,
      amount: 1
    }
    const initialResource = characterSheetFixture.resources.items[1]

    const sheet = projectOptimisticCharacterSheet(characterSheetFixture, command)
    const resource = sheet.resources.items[1]

    expect(resource).toMatchObject({
      used: initialResource.used + 1,
      max: initialResource.max,
      remaining: initialResource.remaining - 1
    })
  })

  it('does not reproduce engine-owned adjustment calculations', () => {
    const command = {
      ...commandBase,
      type: 'SET_SPELL_MECHANIC_CUSTOMIZATION' as const,
      source: spellPanelFixture.source,
      category: 'DAMAGE' as const,
      mode: 'BONUS' as const,
      value: 2,
      sourceNote: 'Empowered Evocation'
    }

    expect(projectOptimisticCharacterSheet(characterSheetFixture, command)).toBe(
      characterSheetFixture
    )
    expect(projectOptimisticCharacterSheetPanel(spellPanelFixture, command)).toMatchObject({
      state: 'ADJUSTED',
      customizationOptions: [
        {
          category: 'DAMAGE',
          configured: {
            mode: 'BONUS',
            value: 2,
            sourceNote: 'Empowered Evocation'
          }
        }
      ]
    })
  })
})
