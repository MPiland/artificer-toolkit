import { getFunctionName } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { ImportRunnerSource } from './runnerState'
import type { ImportRunnerPlan } from './stages'
import type { ImportStoredJob } from '@artificer-toolkit/schema/projections/importJobPersistence'
import type { Id } from '../_generated/dataModel'
import { runImportJob } from './runner'

type RunnerSource = ImportRunnerSource & { command: ImportStoredJob['command'] }
type RunnerContext = Parameters<typeof runImportJob>[0]

const ownerUserId = '00000000-0000-4000-8000-000000000001'
const systemId = '00000000-0000-4000-8000-000000000002'
const primaryRulesCatalogueId = '00000000-0000-4000-8000-000000000003'
const jobId = '00000000-0000-4000-8000-000000000004'

function portableBackground(
  id: string,
  label: string,
  itemSystemId = systemId,
  references: Array<{ kind: 'BACKGROUND'; id: string; label: string }> = []
) {
  return JSON.stringify({
    format: 'artificer-content',
    version: 1,
    item: {
      kind: 'BACKGROUND',
      data: {
        kind: 'BACKGROUND',
        id,
        label,
        systemId: itemSystemId,
        details: [{ label: 'Lore', description: 'A useful detail.', order: 0 }]
      }
    },
    references
  })
}

function source(
  entries: Array<{ entryId: string; name: string; text: string }>,
  selectedEntryIds = entries.map((entry) => entry.entryId),
  resolutions: ImportStoredJob['command']['resolutions'] = []
): { source: RunnerSource; blobs: Map<Id<'_storage'>, Blob> } {
  const blobs = new Map<Id<'_storage'>, Blob>()
  const descriptorEntries = entries.map((entry, index) => {
    const claimId = `00000000-0000-4000-8001-${index.toString().padStart(12, '0')}`
    const storageId = `storage-${index}` as Id<'_storage'>
    blobs.set(storageId, new Blob([entry.text]))
    return { claimId, entryId: entry.entryId, name: entry.name }
  })
  return {
    source: {
      ownerUserId,
      descriptor: { source: 'ARTIFICER_JSON', entries: descriptorEntries },
      claims: descriptorEntries.map((entry, index) => ({
        ...entry,
        actualBytes: new TextEncoder().encode(entries[index]!.text).byteLength,
        storageId: `storage-${index}` as Id<'_storage'>
      })),
      command: {
        commandId: '00000000-0000-4000-8000-000000000010',
        previewId: '00000000-0000-4000-8000-000000000011',
        selectedEntryIds,
        resolutions,
        customContentChoices: []
      }
    },
    blobs
  }
}

function functionName(reference: unknown) {
  return getFunctionName(reference as Parameters<typeof getFunctionName>[0])
}

function harness(
  fixture: { source: RunnerSource; blobs: Map<Id<'_storage'>, Blob> },
  options: {
    plan?: ImportRunnerPlan | null
    exact?: {
      importReferences?: Array<{
        source: 'ARTIFICER_JSON'
        subjectKind: 'BACKGROUND'
        externalId: string
        subjectId: string
      }>
      activeAuthored?: Array<{
        subjectKind: 'BACKGROUND'
        subjectId: string
        ownerUserId: string | null
        label: string
        isMaster: boolean
      }>
      authoredDrafts?: Array<{ subjectKind: 'BACKGROUND'; subjectId: string; label: string }>
    }
    availableSystemIds?: string[]
    vocabulary?: Partial<
      Record<'damageTypes' | 'rarities', Array<{ id: string; code: string; label: string }>> & {
        goldCurrencyId: string
      }
    >
    activeCharacterBinding?: { systemId: string; primaryRulesCatalogueId: string | null }
    failMutation?: string
  } = {}
) {
  const runQuery = vi.fn(async (reference: unknown, args: unknown) => {
    const name = functionName(reference)
    if (name === 'imports/stages:readPlan') return options.plan ?? null
    if (name === 'imports/runnerState:loadSource') return fixture.source
    if (name === 'imports/runnerState:loadPreflight') {
      const input = args as { systemIds: string[]; characterIds: string[] }
      const characterId = input.characterIds[0]
      return {
        availableSystemIds: options.availableSystemIds ?? input.systemIds,
        activeCharacters:
          options.activeCharacterBinding && characterId
            ? [{ characterId, ...options.activeCharacterBinding }]
            : [],
        equipment: []
      }
    }
    if (name === 'imports/previewLookup:loadExactForJob') {
      return {
        ownerUserId,
        importReferences: options.exact?.importReferences ?? [],
        activeAuthored: options.exact?.activeAuthored ?? [],
        authoredDrafts: options.exact?.authoredDrafts ?? [],
        characters: [],
        characterDrafts: [],
        systemVocabularies: options.vocabulary
          ? [
              {
                systemId,
                damageTypes: [],
                rarities: [],
                ...options.vocabulary
              }
            ]
          : []
      }
    }
    if (name === 'imports/previewLookup:loadMasterPageForJob')
      return { page: [], isDone: true, continueCursor: '' }
    throw new Error(`Unexpected query ${name}`)
  })
  const runMutation = vi.fn(async (reference: unknown, args: unknown) => {
    const name = functionName(reference)
    if (name === options.failMutation) throw new Error('planned mutation failure')
    if (name === 'imports/stages:beginPlan') {
      const plan = args as { generatedIds: string[]; expectedStageCount: number }
      return { generatedIds: plan.generatedIds, expectedStageCount: plan.expectedStageCount }
    }
    if (
      name === 'imports/stageDrafts:stageAuthoredHead' ||
      name === 'imports/stageDrafts:stageCharacterHead'
    ) {
      const input = args as { entryId: string }
      return JSON.stringify({ draft: { publicId: `${input.entryId}-public` } })
    }
    if (name === 'imports/stageCustomAuthored:stageCustomAuthored') return '{}'
    return null
  })
  const ctx = {
    runQuery,
    runMutation,
    storage: { get: async (storageId: Id<'_storage'>) => fixture.blobs.get(storageId) ?? null }
  } as unknown as RunnerContext
  return { ctx, runQuery, runMutation }
}

function calls(runFunction: ReturnType<typeof vi.fn>, name: string) {
  return runFunction.mock.calls
    .filter(([reference]) => functionName(reference) === name)
    .map(([, args]) => args)
}

describe('native import runner', () => {
  it('records every generated id and replays the same payloads without generating new ids', async () => {
    const fixture = source([
      {
        entryId: 'background',
        name: 'background.json',
        text: portableBackground('source-background', 'Scholar')
      }
    ])
    const ids = [
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103'
    ] as const
    const randomUuid = vi.spyOn(crypto, 'randomUUID')
    ids.forEach((id) => randomUuid.mockReturnValueOnce(id))
    const first = harness(fixture)

    await runImportJob(first.ctx, jobId)
    const begin = calls(first.runMutation, 'imports/stages:beginPlan')[0] as ImportRunnerPlan
    const plan: ImportRunnerPlan = {
      generatedIds: begin.generatedIds,
      expectedStageCount: begin.expectedStageCount
    }
    expect(plan).toEqual({ generatedIds: ids, expectedStageCount: 3 })
    expect(randomUuid).toHaveBeenCalledTimes(ids.length)

    randomUuid.mockClear()
    const replay = harness(fixture, { plan })
    await runImportJob(replay.ctx, jobId)
    expect(randomUuid).not.toHaveBeenCalled()
    expect(calls(replay.runMutation, 'imports/stageDrafts:stageAuthoredHead')).toEqual(
      calls(first.runMutation, 'imports/stageDrafts:stageAuthoredHead')
    )
    expect(calls(replay.runMutation, 'imports/stages:stageResult')).toEqual(
      calls(first.runMutation, 'imports/stages:stageResult')
    )

    for (const invalidPlan of [
      {
        ...plan,
        generatedIds: [...plan.generatedIds, '00000000-0000-4000-8000-000000000104']
      },
      { ...plan, generatedIds: plan.generatedIds.slice(0, -1) },
      { ...plan, expectedStageCount: plan.expectedStageCount + 1 }
    ]) {
      const rejected = harness(fixture, { plan: invalidPlan })
      await runImportJob(rejected.ctx, jobId)
      expect(calls(rejected.runMutation, 'imports/jobs:fail')).toEqual([
        { jobId, failureReason: 'Import could not be completed.' }
      ])
      expect(calls(rejected.runMutation, 'imports/finalize:complete')).toEqual([])
    }
    randomUuid.mockRestore()
  }, 15_000)

  it('stages selected, skipped, and unable entries in descriptor order', async () => {
    const fixture = source(
      [
        {
          entryId: 'selected',
          name: 'selected.json',
          text: portableBackground('selected-source', 'Selected')
        },
        {
          entryId: 'skipped',
          name: 'skipped.json',
          text: portableBackground('skipped-source', 'Skipped')
        },
        { entryId: 'unable', name: 'unable.json', text: '{' }
      ],
      ['selected', 'unable']
    )
    const runner = harness(fixture)
    await runImportJob(runner.ctx, jobId)

    expect(calls(runner.runMutation, 'imports/stages:beginPlan')[0]).toMatchObject({
      expectedStageCount: 5
    })
    expect(calls(runner.runMutation, 'imports/stageDrafts:stageAuthoredHead')).toHaveLength(1)
    const results = calls(runner.runMutation, 'imports/stages:stageResult').map((args) =>
      JSON.parse((args as { resultJson: string }).resultJson)
    )
    expect(results.map(({ entryId, outcome }) => ({ entryId, outcome }))).toEqual([
      { entryId: 'selected', outcome: 'CREATED' },
      { entryId: 'skipped', outcome: 'SKIPPED' },
      { entryId: 'unable', outcome: 'FAILED' }
    ])
    expect(calls(runner.runMutation, 'imports/finalize:complete')).toEqual([{ jobId }])
  })

  it('uses the frozen D&D claim without fetching and stages custom authored content', async () => {
    const text = JSON.stringify({
      data: {
        id: 74476867,
        name: 'Aria',
        classes: [],
        inventory: [],
        feats: [
          {
            definition: {
              id: 9,
              name: 'Roadwise',
              description: 'You always know the road home.',
              isHomebrew: true
            }
          }
        ]
      }
    })
    const storageId = 'dnd-storage' as Id<'_storage'>
    const fixture = {
      blobs: new Map([[storageId, new Blob([text])]]),
      source: {
        ownerUserId,
        descriptor: {
          source: 'DND_BEYOND' as const,
          systemId,
          primaryRulesCatalogueId,
          entries: [
            {
              claimId: '00000000-0000-4000-8000-000000000201',
              entryId: 'character',
              url: 'https://www.dndbeyond.com/characters/74476867'
            }
          ]
        },
        claims: [
          {
            claimId: '00000000-0000-4000-8000-000000000201',
            entryId: 'character',
            name: 'dnd-beyond-1.json',
            actualBytes: new TextEncoder().encode(text).byteLength,
            storageId
          }
        ],
        command: {
          commandId: '00000000-0000-4000-8000-000000000202',
          previewId: '00000000-0000-4000-8000-000000000203',
          selectedEntryIds: ['character'],
          resolutions: [],
          customContentChoices: []
        }
      } satisfies RunnerSource
    }
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network used'))
    const runner = harness(fixture)
    await runImportJob(runner.ctx, jobId)

    expect(fetch).not.toHaveBeenCalled()
    expect(
      calls(runner.runMutation, 'imports/stageCustomAuthored:stageCustomAuthored')
    ).toHaveLength(1)
    expect(calls(runner.runMutation, 'imports/stageDrafts:stageCharacterHead')).toHaveLength(1)
    expect(calls(runner.runMutation, 'imports/stages:beginPlan')[0]).toMatchObject({
      expectedStageCount: 4
    })
    fetch.mockRestore()
  })

  it('wears an equipped custom Equipment item from its own payload and requests no stored Equipment', async () => {
    const text = JSON.stringify({
      data: {
        id: 74476868,
        name: 'Aria',
        classes: [],
        inventory: [
          {
            quantity: 1,
            equipped: true,
            definition: {
              id: 31,
              name: 'Traveler cloak',
              description: 'A heavy cloak.',
              isHomebrew: true
            }
          }
        ]
      }
    })
    const storageId = 'dnd-equipped-storage' as Id<'_storage'>
    const fixture = {
      blobs: new Map([[storageId, new Blob([text])]]),
      source: {
        ownerUserId,
        descriptor: {
          source: 'DND_BEYOND' as const,
          systemId,
          primaryRulesCatalogueId,
          entries: [
            {
              claimId: '00000000-0000-4000-8000-000000000211',
              entryId: 'character',
              url: 'https://www.dndbeyond.com/characters/74476868'
            }
          ]
        },
        claims: [
          {
            claimId: '00000000-0000-4000-8000-000000000211',
            entryId: 'character',
            name: 'dnd-beyond-2.json',
            actualBytes: new TextEncoder().encode(text).byteLength,
            storageId
          }
        ],
        command: {
          commandId: '00000000-0000-4000-8000-000000000212',
          previewId: '00000000-0000-4000-8000-000000000213',
          selectedEntryIds: ['character'],
          resolutions: [],
          customContentChoices: []
        }
      } satisfies RunnerSource
    }
    const runner = harness(fixture)
    await runImportJob(runner.ctx, jobId)

    expect(calls(runner.runQuery, 'imports/runnerState:loadPreflight')).toEqual([
      expect.objectContaining({ equipmentIds: [] })
    ])
    const [head] = calls(runner.runMutation, 'imports/stageDrafts:stageCharacterHead') as Array<{
      payloadJson: string
    }>
    const { inventory, equipped } = JSON.parse(head!.payloadJson).character.state.equipment
    expect(equipped).toEqual([{ itemId: inventory[0].id, slot: 'WORN' }])
  })

  describe('custom weapons imported from D&D Beyond (BUILDER-4)', () => {
    const slashingId = '00000000-0000-0000-0004-000300000000'

    function weaponFixture(
      damageType: string,
      definition: Record<string, unknown> = {
        id: 41,
        name: 'Moonlit Greatsword',
        description: 'A blade of silver light.',
        isHomebrew: true,
        filterType: 'Weapon',
        attackType: 1,
        range: 5,
        longRange: 5,
        damage: { diceString: '2d6' },
        damageType,
        properties: [{ name: 'Heavy' }, { name: 'Two-Handed' }]
      }
    ) {
      const text = JSON.stringify({
        data: {
          id: 74476869,
          name: 'Aria',
          classes: [],
          inventory: [{ quantity: 1, equipped: true, definition }]
        }
      })
      const storageId = 'dnd-weapon-storage' as Id<'_storage'>
      return {
        blobs: new Map([[storageId, new Blob([text])]]),
        source: {
          ownerUserId,
          descriptor: {
            source: 'DND_BEYOND' as const,
            systemId,
            primaryRulesCatalogueId,
            entries: [
              {
                claimId: '00000000-0000-4000-8000-000000000221',
                entryId: 'character',
                url: 'https://www.dndbeyond.com/characters/74476869'
              }
            ]
          },
          claims: [
            {
              claimId: '00000000-0000-4000-8000-000000000221',
              entryId: 'character',
              name: 'dnd-beyond-3.json',
              actualBytes: new TextEncoder().encode(text).byteLength,
              storageId
            }
          ],
          command: {
            commandId: '00000000-0000-4000-8000-000000000222',
            previewId: '00000000-0000-4000-8000-000000000223',
            selectedEntryIds: ['character'],
            resolutions: [],
            customContentChoices: []
          }
        } satisfies RunnerSource
      }
    }

    it('holds an equipped custom two-handed weapon in the main hand and stages its resolved attack', async () => {
      const runner = harness(weaponFixture('Slashing'), {
        vocabulary: { damageTypes: [{ id: slashingId, code: 'SLASHING', label: 'Slashing' }] }
      })
      await runImportJob(runner.ctx, jobId)

      expect(calls(runner.runQuery, 'imports/runnerState:loadPreflight')).toEqual([
        expect.objectContaining({ systemIds: [], equipmentIds: [] })
      ])
      const [custom] = calls(
        runner.runMutation,
        'imports/stageCustomAuthored:stageCustomAuthored'
      ) as Array<{ payloadJson: string; targetId: string }>
      const equipment = JSON.parse(custom!.payloadJson)
      expect(equipment).toMatchObject({
        category: 'WEAPON',
        properties: ['MELEE', 'HEAVY', 'TWO_HANDED'],
        effects: [
          {
            grip: 'TWO_HANDED',
            invocation: { triggerCode: 'MELEE_WEAPON_ATTACK' },
            paths: [
              {
                resultBlock: {
                  outcomes: [{ damageTypeId: slashingId, diceConfig: '2d6' }]
                }
              }
            ]
          }
        ]
      })
      const [head] = calls(runner.runMutation, 'imports/stageDrafts:stageCharacterHead') as Array<{
        payloadJson: string
      }>
      const { inventory, equipped } = JSON.parse(head!.payloadJson).character.state.equipment
      expect(inventory[0].equipmentId).toBe(custom!.targetId)
      expect(equipped).toEqual([{ itemId: inventory[0].id, slot: 'MAIN_HAND' }])
      expect(calls(runner.runMutation, 'imports/stages:stageResult')).toEqual([
        expect.objectContaining({ resultJson: expect.not.stringContaining('UNKNOWN_DAMAGE_TYPE') })
      ])
    })

    const piercingId = '00000000-0000-0000-0004-000800000000'
    const legendaryId = '00000000-0000-0000-0009-000500000000'
    const goldId = '00000000-0000-0000-0003-000400000000'
    const astralTearVocabulary = {
      damageTypes: [{ id: piercingId, code: 'PIERCING', label: 'Piercing' }],
      rarities: [{ id: legendaryId, code: 'LEGENDARY', label: 'Legendary' }],
      goldCurrencyId: goldId
    }
    const astralTear = (rarity: string) =>
      weaponFixture('Piercing', {
        id: 42,
        name: 'The Astral Tear Awakened',
        description: 'A tear of starlight.',
        isHomebrew: true,
        filterType: 'Weapon',
        type: 'Shortsword',
        attackType: 1,
        range: 5,
        longRange: 5,
        damage: { diceString: '1d6' },
        damageType: 'Piercing',
        properties: [{ name: 'Finesse' }, { name: 'Light' }, { name: 'Vex' }],
        magic: true,
        canAttune: true,
        rarity,
        grantedModifiers: [{ type: 'bonus', subType: 'magic', value: 1 }],
        weight: 2.0,
        cost: 100
      })

    it('keeps an imported item with a rarity the System does not know as a draft', async () => {
      const runner = harness(astralTear('Mythic'), { vocabulary: astralTearVocabulary })
      await runImportJob(runner.ctx, jobId)

      const [custom] = calls(
        runner.runMutation,
        'imports/stageCustomAuthored:stageCustomAuthored'
      ) as Array<{ payloadJson: string; activate: boolean }>
      expect(JSON.parse(custom!.payloadJson)).toMatchObject({ rarityId: '' })
      expect(custom!.activate).toBe(false)
    })

    it('imports a homebrew magic finesse shortsword as an equipped one-handed weapon with its grants, rarity and attack', async () => {
      const runner = harness(astralTear('Legendary'), { vocabulary: astralTearVocabulary })
      await runImportJob(runner.ctx, jobId)

      const [custom] = calls(
        runner.runMutation,
        'imports/stageCustomAuthored:stageCustomAuthored'
      ) as Array<{ payloadJson: string; targetId: string; activate: boolean }>
      // The rarity, damage type and price are all known, so the item is complete and activates.
      expect(custom!.activate).toBe(true)
      const equipment = JSON.parse(custom!.payloadJson)
      expect(equipment).toMatchObject({
        category: 'WEAPON',
        properties: ['MELEE', 'FINESSE', 'LIGHT', 'MAGIC'],
        requiresAttunement: true,
        rarityId: legendaryId,
        weight: { amount: 2, unit: 'POUNDS' },
        cost: { amount: 100, currencyId: goldId },
        effects: [
          {
            grip: 'ONE_HANDED',
            paths: [
              { resultBlock: { outcomes: [{ damageTypeId: piercingId, diceConfig: '1d6' }] } }
            ]
          }
        ]
      })
      // Finesse (optional STR/DEX) attack and damage grants, then the +1 magic bonus grants.
      expect(
        equipment.modifiers.map(
          (grant: { modifierKind: string; valueDomainCode: string; payload: unknown }) => [
            grant.modifierKind,
            grant.valueDomainCode,
            grant.payload
          ]
        )
      ).toEqual([
        [
          'OPTIONAL_ABILITY_MODIFIER_BONUS',
          'ATTACK_ROLL',
          { abilities: ['STRENGTH', 'DEXTERITY'] }
        ],
        ['OPTIONAL_ABILITY_MODIFIER_BONUS', 'DAMAGE', { abilities: ['STRENGTH', 'DEXTERITY'] }],
        ['BONUS', 'ATTACK_ROLL', { valueKind: 'FIXED', amount: 1 }],
        ['BONUS', 'DAMAGE', { valueKind: 'FIXED', amount: 1 }]
      ])
      expect(equipment.modifiers.map((grant: { order: number }) => grant.order)).toEqual([
        1, 2, 3, 4
      ])
      const [head] = calls(runner.runMutation, 'imports/stageDrafts:stageCharacterHead') as Array<{
        payloadJson: string
      }>
      const { inventory, equipped } = JSON.parse(head!.payloadJson).character.state.equipment
      expect(inventory[0].equipmentId).toBe(custom!.targetId)
      expect(equipped).toEqual([{ itemId: inventory[0].id, slot: 'MAIN_HAND' }])
    })

    it('stages the weapon without an attack and reports an unknown damage type', async () => {
      const runner = harness(weaponFixture('Moonlight'), {
        vocabulary: { damageTypes: [{ id: slashingId, code: 'SLASHING', label: 'Slashing' }] }
      })
      await runImportJob(runner.ctx, jobId)

      const [custom] = calls(
        runner.runMutation,
        'imports/stageCustomAuthored:stageCustomAuthored'
      ) as Array<{ payloadJson: string }>
      expect(JSON.parse(custom!.payloadJson)).toMatchObject({ category: 'WEAPON' })
      expect(JSON.parse(custom!.payloadJson).effects ?? []).toEqual([])
      expect(calls(runner.runMutation, 'imports/stages:stageResult')).toEqual([
        expect.objectContaining({ resultJson: expect.stringContaining('UNKNOWN_DAMAGE_TYPE') })
      ])
    })
  })

  it('records an invalid collision resolution as FAILED without staging a head', async () => {
    const subjectId = 'collision-background'
    const fixture = source(
      [
        {
          entryId: 'collision',
          name: 'collision.json',
          text: portableBackground(subjectId, 'Collision')
        }
      ],
      ['collision'],
      [{ entryId: 'collision', choice: 'UPDATE_DRAFT', confirmDraftReplacement: false }]
    )
    const runner = harness(fixture, {
      exact: {
        activeAuthored: [
          {
            subjectKind: 'BACKGROUND',
            subjectId,
            ownerUserId,
            label: 'Existing',
            isMaster: false
          }
        ],
        authoredDrafts: [{ subjectKind: 'BACKGROUND', subjectId, label: 'Draft' }]
      }
    })
    await runImportJob(runner.ctx, jobId)

    expect(calls(runner.runMutation, 'imports/stageDrafts:stageAuthoredHead')).toEqual([])
    const result = JSON.parse(
      (calls(runner.runMutation, 'imports/stages:stageResult')[0] as { resultJson: string })
        .resultJson
    )
    expect(result).toMatchObject({ entryId: 'collision', outcome: 'FAILED' })
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'DRAFT_REPLACEMENT_NOT_CONFIRMED' })
    )
  })

  it('stages UNKNOWN_RULES_SYSTEM and excludes its root from portable reference mapping', async () => {
    const unavailableSystemId = '00000000-0000-4000-8000-000000000300'
    const fixture = source([
      {
        entryId: 'unavailable-background',
        name: 'unavailable.json',
        text: portableBackground('unavailable-root', 'Unavailable', unavailableSystemId)
      },
      {
        entryId: 'dependent-background',
        name: 'dependent.json',
        text: portableBackground('dependent-root', 'Dependent', systemId, [
          { kind: 'BACKGROUND', id: 'unavailable-root', label: 'Unavailable' }
        ])
      }
    ])
    const runner = harness(fixture, { availableSystemIds: [systemId] })
    await runImportJob(runner.ctx, jobId)

    expect(calls(runner.runQuery, 'imports/runnerState:loadPreflight')).toEqual([
      { jobId, systemIds: [unavailableSystemId, systemId], characterIds: [], equipmentIds: [] }
    ])
    expect(calls(runner.runMutation, 'imports/stageDrafts:stageAuthoredHead')).toHaveLength(1)
    const results = calls(runner.runMutation, 'imports/stages:stageResult').map((args) =>
      JSON.parse((args as { resultJson: string }).resultJson)
    )
    expect(results[0]).toEqual({
      entryId: 'unavailable-background',
      name: 'unavailable.json',
      label: 'Unavailable',
      outcome: 'FAILED',
      issues: [
        {
          severity: 'ERROR',
          code: 'UNKNOWN_RULES_SYSTEM',
          message: 'The imported content does not identify an available Artificer rules system.',
          path: ['item', 'data', 'systemId'],
          correctionRequired: true
        }
      ]
    })
    expect(results[1]).toMatchObject({
      entryId: 'dependent-background',
      outcome: 'CREATED',
      issues: [expect.objectContaining({ code: 'BATCH_REFERENCE_TARGET_FAILED' })]
    })
    expect(calls(runner.runMutation, 'imports/stages:beginPlan')[0]).toMatchObject({
      expectedStageCount: 4
    })
    expect(calls(runner.runMutation, 'imports/jobs:fail')).toEqual([])
    expect(calls(runner.runMutation, 'imports/finalize:complete')).toEqual([{ jobId }])
  })

  it.each([
    {
      binding: {
        systemId: '00000000-0000-4000-8000-000000000301',
        primaryRulesCatalogueId: null
      }
    },
    {
      binding: {
        systemId,
        primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000302'
      }
    }
  ])(
    'stages CHARACTER_RULE_BINDING_MISMATCH for an incompatible active Character',
    async ({ binding }) => {
      const text = JSON.stringify({
        data: { id: 74476867, name: 'Aria', classes: [], inventory: [] }
      })
      const storageId = 'dnd-binding-storage' as Id<'_storage'>
      const fixture = {
        blobs: new Map([[storageId, new Blob([text])]]),
        source: {
          ownerUserId,
          descriptor: {
            source: 'DND_BEYOND' as const,
            systemId,
            primaryRulesCatalogueId,
            entries: [
              {
                claimId: '00000000-0000-4000-8000-000000000303',
                entryId: 'character',
                url: 'https://www.dndbeyond.com/characters/74476867'
              }
            ]
          },
          claims: [
            {
              claimId: '00000000-0000-4000-8000-000000000303',
              entryId: 'character',
              name: 'dnd-beyond-1.json',
              actualBytes: new TextEncoder().encode(text).byteLength,
              storageId
            }
          ],
          command: {
            commandId: '00000000-0000-4000-8000-000000000304',
            previewId: '00000000-0000-4000-8000-000000000305',
            selectedEntryIds: ['character'],
            resolutions: [],
            customContentChoices: []
          }
        } satisfies RunnerSource
      }
      const runner = harness(fixture, { activeCharacterBinding: binding })
      await runImportJob(runner.ctx, jobId)

      expect(calls(runner.runQuery, 'imports/runnerState:loadPreflight')).toHaveLength(1)
      expect(calls(runner.runMutation, 'imports/stageCustomAuthored:stageCustomAuthored')).toEqual(
        []
      )
      expect(calls(runner.runMutation, 'imports/stageDrafts:stageCharacterHead')).toEqual([])
      expect(calls(runner.runMutation, 'imports/stages:beginPlan')[0]).toMatchObject({
        expectedStageCount: 2
      })
      const result = JSON.parse(
        (calls(runner.runMutation, 'imports/stages:stageResult')[0] as { resultJson: string })
          .resultJson
      )
      expect(result).toEqual({
        entryId: 'character',
        name: 'https://www.dndbeyond.com/characters/74476867',
        label: 'Aria',
        outcome: 'FAILED',
        issues: [
          {
            severity: 'ERROR',
            code: 'CHARACTER_RULE_BINDING_MISMATCH',
            message:
              'The imported Character does not match the existing Character System and Rules Catalogue.',
            path: [],
            correctionRequired: true
          }
        ]
      })
      expect(calls(runner.runMutation, 'imports/jobs:fail')).toEqual([])
      expect(calls(runner.runMutation, 'imports/finalize:complete')).toEqual([{ jobId }])
    }
  )

  it('schedules cleanup with a bounded neutral reason after a staging failure', async () => {
    const fixture = source([
      {
        entryId: 'background',
        name: 'background.json',
        text: portableBackground('background-source', 'Background')
      }
    ])
    const runner = harness(fixture, { failMutation: 'imports/stages:stageResult' })
    await runImportJob(runner.ctx, jobId)

    expect(calls(runner.runMutation, 'imports/jobs:fail')).toEqual([
      { jobId, failureReason: 'Import could not be completed.' }
    ])
    expect(calls(runner.runMutation, 'imports/finalize:complete')).toEqual([])
  })
})
