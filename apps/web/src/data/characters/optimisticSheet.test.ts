import type {
  CharacterSheetSlice,
  CharacterSheetSliceDtoMap
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { characterSheetSliceResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { characterSheetFixture } from '#domains/characters/sheet/fixtures/characterSheet.fixtures'
import {
  itemPanelFixture,
  spellPanelFixture,
  spellsPanelFixture
} from '#domains/characters/sheet/inspector/inspector.fixtures'
import {
  projectOptimisticCharacterSheetSlice,
  projectOptimisticCharacterSheetPanel
} from './optimisticSheet'

function projectSlice<Slice extends CharacterSheetSlice>(
  sheet: CharacterSheetResponseDto,
  slice: Slice,
  command: CharacterSheetCommandInputDto
): CharacterSheetSliceDtoMap[Slice] {
  return projectOptimisticCharacterSheetSlice(projectCharacterSheetSlice(sheet, slice), command)
    .data as CharacterSheetSliceDtoMap[Slice]
}
const commandBase = {
  commandId: '00000000-0000-4000-8000-000000000999',
  expectedVersion: characterSheetFixture.meta.streamVersion
}

describe('optimistic Character Sheet projections', () => {
  it('projects focused cached collections without adding unrelated Sheet fields', () => {
    const command = { ...commandBase, type: 'SET_INSPIRATION' as const, inspired: true }
    const response = projectOptimisticCharacterSheetSlice(
      projectCharacterSheetSlice(characterSheetFixture, 'COMMON'),
      command
    )
    expect(response).toMatchObject({ slice: 'COMMON', data: { overview: { inspiration: true } } })
    expect('inventory' in response.data).toBe(false)
    characterSheetSliceResponseDtoSchema.parse(response)
    for (const slice of ['ACTIONS', 'SPELLS', 'INVENTORY', 'FEATURES'] as const) {
      const projected = projectOptimisticCharacterSheetSlice(
        projectCharacterSheetSlice(characterSheetFixture, slice),
        {
          ...commandBase,
          type: 'USE_RESOURCE',
          resourceGrantId: characterSheetFixture.resources.items[0]!.id
        }
      )
      characterSheetSliceResponseDtoSchema.parse(projected)
      expect('identity' in projected.data).toBe(false)
      expect('overview' in projected.data).toBe(false)
    }
  })

  it('leaves an older slice untouched when a command was issued against newer common facts', () => {
    const response = projectCharacterSheetSlice(characterSheetFixture, 'INVENTORY')
    expect(
      projectOptimisticCharacterSheetSlice(response, {
        ...commandBase,
        expectedVersion: commandBase.expectedVersion + 1,
        type: 'REMOVE_INVENTORY_ITEM',
        itemId: characterSheetFixture.inventory.items[0]!.id
      })
    ).toBe(response)
  })

  it('projects spell-source customization into the Sheet and open spell panel', () => {
    const command = {
      ...commandBase,
      type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION' as const,
      source: spellPanelFixture.source,
      customName: 'Force Darts',
      notes: 'Prepared for the vault.',
      displayAsAttack: true
    }

    const sheet = projectSlice(characterSheetFixture, 'SPELLS', command)
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

    const sheet = projectSlice(characterSheetFixture, 'SPELLS', command)
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

    const sheet = projectSlice(characterSheetFixture, 'SPELLS', command)
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

    const sheet = projectSlice(characterSheetFixture, 'ACTIONS', command)
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

    const projected = projectSlice(sheet, 'ACTIONS', {
      ...commandBase,
      type: 'CAST_SPELL',
      spellId: spell.id,
      sourceId: source.id
    })

    expect(projected.resources.items[1]).toMatchObject({
      used: resource.used + 1,
      remaining: resource.remaining - 1
    })
    expect(
      projectSlice(sheet, 'SPELLS', {
        ...commandBase,
        type: 'CAST_SPELL',
        spellId: spell.id,
        sourceId: source.id
      }).spells.slots
    ).toEqual(sheet.spells.slots)
  })

  it('projects resource recovery and HP changes without duplicating engine rules', () => {
    const resource = characterSheetFixture.resources.items[1]
    const itemResource = itemPanelFixture.resources[0]!
    const recovered = projectSlice(characterSheetFixture, 'FEATURES', {
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

    const damaged = projectSlice(characterSheetFixture, 'COMMON', {
      ...commandBase,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: 6
    })
    expect(damaged.overview).toMatchObject({
      currentHitPoints: 12,
      tempHitPoints: 0
    })

    const healed = projectSlice(characterSheetFixture, 'COMMON', {
      ...commandBase,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 10
    })
    expect(healed.overview.currentHitPoints).toBe(characterSheetFixture.overview.maxHitPoints)

    const set = projectSlice(characterSheetFixture, 'COMMON', {
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
    const conditioned = projectSlice(characterSheetFixture, 'COMMON', {
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

    const exhausted = projectSlice(characterSheetFixture, 'COMMON', {
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

    const common = projectCharacterSheetSlice(characterSheetFixture, 'COMMON')
    expect(projectOptimisticCharacterSheetSlice(common, command).data).toBe(common.data)
    expect(
      projectOptimisticCharacterSheetSlice(common, {
        ...commandBase,
        type: 'COMPLETE_REST',
        restKind: 'LONG',
        previewFingerprint: 'authoritative-preview',
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      }).data
    ).toBe(common.data)
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

  describe('held items (SHEET-8)', () => {
    const [template] = characterSheetFixture.inventory.items
    const item = (
      id: string,
      category: string,
      equippedSlot: 'MAIN_HAND' | 'OFF_HAND' | 'WORN' | null
    ) => ({
      ...template!,
      id,
      category,
      properties: [],
      equippedSlot
    })
    const inventoryOf = (
      items: ReturnType<typeof item>[],
      command: CharacterSheetCommandInputDto
    ) =>
      Object.fromEntries(
        projectSlice(
          { ...characterSheetFixture, inventory: { ...characterSheetFixture.inventory, items } },
          'INVENTORY',
          command
        ).inventory.items.map((entry) => [entry.id, entry.equippedSlot])
      )

    it('gives a newly equipped weapon the main hand, then a shield the off hand', () => {
      const items = [item('sword', 'WEAPON', null), item('shield', 'SHIELD', null)]
      expect(inventoryOf(items, { ...commandBase, type: 'EQUIP_ITEM', itemId: 'sword' })).toEqual({
        sword: 'MAIN_HAND',
        shield: null
      })
      expect(
        inventoryOf([item('sword', 'WEAPON', 'MAIN_HAND'), items[1]!], {
          ...commandBase,
          type: 'EQUIP_ITEM',
          itemId: 'shield'
        })
      ).toEqual({ sword: 'MAIN_HAND', shield: 'OFF_HAND' })
    })

    it('leaves the hands alone when both are full', () => {
      const full = [
        item('sword', 'WEAPON', 'MAIN_HAND'),
        item('shield', 'SHIELD', 'OFF_HAND'),
        item('axe', 'WEAPON', null)
      ]
      expect(inventoryOf(full, { ...commandBase, type: 'EQUIP_ITEM', itemId: 'axe' })).toEqual({
        sword: 'MAIN_HAND',
        shield: 'OFF_HAND',
        axe: null
      })
    })

    it('swaps the hands and promotes an off-hand weapon on unequip', () => {
      const hands = [item('sword', 'WEAPON', 'MAIN_HAND'), item('axe', 'WEAPON', 'OFF_HAND')]
      expect(inventoryOf(hands, { ...commandBase, type: 'SWAP_HELD_ITEMS' })).toEqual({
        sword: 'OFF_HAND',
        axe: 'MAIN_HAND'
      })
      expect(inventoryOf(hands, { ...commandBase, type: 'UNEQUIP_ITEM', itemId: 'sword' })).toEqual(
        { sword: null, axe: 'MAIN_HAND' }
      )
      expect(
        inventoryOf([hands[0]!, item('shield', 'SHIELD', 'OFF_HAND')], {
          ...commandBase,
          type: 'UNEQUIP_ITEM',
          itemId: 'sword'
        })
      ).toEqual({ sword: null, shield: 'OFF_HAND' })
    })
  })
})
