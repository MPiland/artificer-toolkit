import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { characterSheetFixture } from '#domains/characters/sheet/fixtures/characterSheet.fixtures'
import {
  itemPanelFixture,
  spellPanelFixture,
  spellsPanelFixture
} from '#domains/characters/sheet/inspector/inspector.fixtures'
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

  it('projects known spell changes across Sheet and manage panels', () => {
    const command = {
      ...commandBase,
      type: 'SET_KNOWN_SPELLS' as const,
      classId: 'class-wizard',
      spellIds: []
    }
    const panel = {
      ...spellsPanelFixture,
      groups: [
        {
          ...spellsPanelFixture.groups[0]!,
          sources: [
            {
              ...spellsPanelFixture.groups[0]!.sources[0]!,
              known: true,
              canPrepare: false,
              canManageKnown: true,
              knownClassId: command.classId,
              preparationClassId: undefined
            }
          ]
        }
      ]
    }

    const sheet = projectOptimisticCharacterSheet(characterSheetFixture, command)
    const projectedPanel = projectOptimisticCharacterSheetPanel(panel, command)
    const spell = sheet.spells.spells[0]!

    expect(spell.known).toBe(false)
    expect(spell.sources?.[0]?.acquisition).toBeUndefined()
    expect(
      projectedPanel.kind === 'SPELLS' ? projectedPanel.groups[0]?.sources[0]?.known : undefined
    ).toBe(false)
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

  it('projects charged spell casts through the source resource owner', () => {
    const sheet: CharacterSheetResponseDto = structuredClone(characterSheetFixture)
    const resource = sheet.resources.items[1]!
    const spell = sheet.spells.spells[0]!
    const source = spell.sources![0]!
    source.id = 'limited-spell-source'
    source.castMode = 'LIMITED_USE'
    source.resourceGrantId = 'raw-resource-grant'
    source.resourceOwner = resource.owner

    const projected = projectOptimisticCharacterSheet(sheet, {
      ...commandBase,
      type: 'CAST_SPELL',
      spellId: spell.id,
      sourceId: source.id
    })

    expect(projected.resources.items[1]).toMatchObject({
      used: resource.used + 1,
      remaining: resource.remaining - 1
    })
    expect(projected.spells.slots).toEqual(sheet.spells.slots)
  })

  it('projects resource recovery and HP changes without duplicating engine rules', () => {
    const resource = characterSheetFixture.resources.items[1]
    const itemResource = itemPanelFixture.resources[0]!
    const recovered = projectOptimisticCharacterSheet(characterSheetFixture, {
      ...commandBase,
      type: 'RECOVER_SHEET_RESOURCE',
      owner: resource.owner,
      trigger: 'MANUAL'
    })
    expect(recovered.resources.items[1]).toMatchObject({
      used: 0,
      remaining: resource.max
    })
    expect(
      projectOptimisticCharacterSheetPanel(itemPanelFixture, {
        ...commandBase,
        type: 'RECOVER_SHEET_RESOURCE',
        owner: itemResource.target.owner,
        trigger: 'MANUAL'
      })
    ).toMatchObject({
      resources: [
        expect.objectContaining({
          remaining: itemResource.maximum
        })
      ]
    })

    const damaged = projectOptimisticCharacterSheet(characterSheetFixture, {
      ...commandBase,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: 6
    })
    expect(damaged.overview).toMatchObject({
      currentHitPoints: 12,
      tempHitPoints: 0
    })

    const healed = projectOptimisticCharacterSheet(characterSheetFixture, {
      ...commandBase,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 10
    })
    expect(healed.overview.currentHitPoints).toBe(characterSheetFixture.overview.maxHitPoints)

    const set = projectOptimisticCharacterSheet(characterSheetFixture, {
      ...commandBase,
      type: 'SET_HIT_POINTS',
      current: 4,
      temp: 2
    })
    expect(set.overview).toMatchObject({ currentHitPoints: 4, tempHitPoints: 2 })
  })

  it('projects generic item resource adjustments into the open item panel', () => {
    const itemResource = itemPanelFixture.resources[0]!
    const used = projectOptimisticCharacterSheetPanel(itemPanelFixture, {
      ...commandBase,
      type: 'USE_RESOURCE',
      resourceGrantId: itemResource.id
    })
    expect(used).toMatchObject({
      resources: [expect.objectContaining({ remaining: itemResource.remaining - 1 })]
    })

    const restored = projectOptimisticCharacterSheetPanel(used, {
      ...commandBase,
      type: 'RESTORE_RESOURCE',
      resourceGrantId: itemResource.id
    })
    expect(restored).toMatchObject({
      resources: [expect.objectContaining({ remaining: itemResource.remaining })]
    })
  })

  it('projects condition changes and preserves exhaustion notes on level-only updates', () => {
    const condition = characterSheetFixture.reference.conditionOptions[0]
    const conditioned = projectOptimisticCharacterSheet(characterSheetFixture, {
      ...commandBase,
      type: 'ADD_CONDITION',
      conditionTypeId: condition.id,
      notes: 'Until the next save.'
    })
    expect(conditioned.overview.conditions.at(-1)).toMatchObject({
      conditionTypeId: condition.id,
      label: condition.label,
      notes: 'Until the next save.'
    })

    const exhausted = projectOptimisticCharacterSheet(characterSheetFixture, {
      ...commandBase,
      type: 'SET_EXHAUSTION',
      level: 2
    })
    expect(exhausted.overview.exhaustion).toMatchObject({
      level: 2,
      notes: characterSheetFixture.overview.exhaustion.notes
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
    expect(
      projectOptimisticCharacterSheet(characterSheetFixture, {
        ...commandBase,
        type: 'COMPLETE_REST',
        restKind: 'LONG',
        previewFingerprint: 'authoritative-preview',
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      })
    ).toBe(characterSheetFixture)
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
