import {
  SRD_DWARVEN_HERITAGE_ID,
  SRD_GOLD_CURRENCY_ID,
  SRD_STEALTH_SKILL_ID,
  SRD_WALK_SPEED_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it, vi } from 'vitest'

import {
  fetchFrozenDndBeyondPayload,
  prepareImportBatch,
  toImportPreviewResponse,
  type ImportPreparationLookup
} from './importPreparation.js'

function createLookup(): ImportPreparationLookup {
  return {
    findImportReference: vi.fn().mockResolvedValue(null),
    findActiveAuthored: vi.fn().mockImplementation(async ({ subjectId }) =>
      subjectId === 'spell-1'
        ? {
            subjectId,
            ownerUserId: 'user-1',
            label: 'Spark',
            isMaster: false
          }
        : null
    ),
    findAuthoredDraft: vi
      .fn()
      .mockImplementation(async ({ subjectId }) =>
        subjectId === 'spell-1' ? { label: 'Spark draft' } : null
      ),
    findActiveMasterLabelCandidates: vi.fn().mockResolvedValue([]),
    findCharacter: vi.fn().mockResolvedValue(null),
    findCharacterDraft: vi.fn().mockResolvedValue(null),
    findSystemVocabulary: vi.fn().mockResolvedValue(null)
  }
}

describe('import preparation', () => {
  it('prepares a portable collision and preview using only the lookup contract', async () => {
    const lookup = createLookup()
    const prepared = await prepareImportBatch(
      lookup,
      {
        source: 'ARTIFICER_JSON',
        entries: [
          {
            entryId: 'one',
            name: 'spell.json',
            text: JSON.stringify({
              format: 'artificer-content',
              version: 1,
              item: {
                kind: 'SPELL',
                data: { id: 'spell-1', label: 'Spark', systemId: 'system-1' }
              },
              references: []
            })
          }
        ]
      },
      'user-1',
      new Map([['one', { choice: 'UPDATE_DRAFT', confirmDraftReplacement: true }]]),
      new Map(),
      { createId: () => 'generated-id' }
    )

    expect(prepared.items[0]).toMatchObject({
      kind: 'AUTHORED',
      targetId: 'spell-1',
      collision: {
        hasExistingDraft: true,
        allowedChoices: ['COPY', 'UPDATE_DRAFT']
      }
    })
    expect(toImportPreviewResponse(prepared).items[0]).toMatchObject({
      status: 'NEEDS_REVIEW',
      destination: {
        kind: 'AUTHORED_DRAFT',
        subjectKind: 'SPELL',
        subjectId: 'spell-1'
      }
    })
    expect(lookup.findActiveAuthored).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
    expect(lookup.findAuthoredDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
  })
  it('freezes the exact parsed D&D text and preserves fetch limits and errors', async () => {
    const text = ' { "data": { "id": 74476867, "name": "Ária 🐉" } } '
    const utf8ByteLength = new TextEncoder().encode(text).byteLength
    const budget = { remainingBytes: 25 * 1024 * 1024 }
    const fetcher = vi.fn().mockResolvedValue(new Response(text)) as unknown as typeof fetch
    const frozen = await fetchFrozenDndBeyondPayload('74476867', fetcher, budget)

    expect(frozen.text).toBe(text)
    expect(frozen.payload).toEqual(JSON.parse(frozen.text))
    expect(frozen.utf8ByteLength).toBe(utf8ByteLength)
    expect(frozen.utf8ByteLength).toBeGreaterThan(text.length)
    expect(budget.remainingBytes).toBe(25 * 1024 * 1024 - utf8ByteLength)
    expect(fetcher).toHaveBeenCalledWith(
      'https://character-service.dndbeyond.com/character/v5/character/74476867?includeCustomItems=true',
      expect.objectContaining({ credentials: 'omit', redirect: 'error' })
    )

    await expect(
      fetchFrozenDndBeyondPayload(
        '74476867',
        vi.fn().mockResolvedValue(new Response('', { status: 404 })) as unknown as typeof fetch,
        { remainingBytes: 25 * 1024 * 1024 }
      )
    ).rejects.toThrow('The D&D Beyond character is private or unavailable.')
    await expect(
      fetchFrozenDndBeyondPayload(
        '74476867',
        vi.fn().mockResolvedValue(new Response('', { status: 500 })) as unknown as typeof fetch,
        { remainingBytes: 25 * 1024 * 1024 }
      )
    ).rejects.toThrow('D&D Beyond returned 500.')
    await expect(
      fetchFrozenDndBeyondPayload(
        '74476867',
        vi.fn().mockResolvedValue(
          new Response('{}', {
            headers: { 'content-length': String(10 * 1024 * 1024 + 1) }
          })
        ) as unknown as typeof fetch,
        { remainingBytes: 25 * 1024 * 1024 }
      )
    ).rejects.toThrow('The D&D Beyond character response is too large.')
    await expect(
      fetchFrozenDndBeyondPayload(
        '74476867',
        vi.fn().mockResolvedValue(new Response('{}')) as unknown as typeof fetch,
        { remainingBytes: 1 }
      )
    ).rejects.toThrow('The D&D Beyond import batch exceeds 25 MiB.')
    await expect(
      fetchFrozenDndBeyondPayload(
        '74476867',
        vi.fn().mockResolvedValue(new Response('{"data":')) as unknown as typeof fetch,
        { remainingBytes: 25 * 1024 * 1024 }
      )
    ).rejects.toThrow('D&D Beyond returned malformed character data.')
  })
  it('uses frozen D&D payloads without fetching and enforces their byte limit', async () => {
    const payload = {
      data: { id: 74476867, name: 'Aria', classes: [], inventory: [] }
    }
    const frozen = vi.fn().mockResolvedValue({ payload, utf8ByteLength: 128 })
    const fetcher = vi.fn()
    const input = {
      source: 'DND_BEYOND' as const,
      systemId: '00000000-0000-4000-8000-000000000001',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      entries: [
        {
          entryId: 'one',
          url: 'https://www.dndbeyond.com/characters/74476867'
        }
      ]
    }

    const prepared = await prepareImportBatch(
      createLookup(),
      input,
      'user-1',
      new Map(),
      new Map(),
      {
        fetch: fetcher as unknown as typeof fetch,
        loadFrozenDndBeyondPayload: frozen
      }
    )

    expect(toImportPreviewResponse(prepared).items[0]?.status).toBe('READY')
    expect(frozen).toHaveBeenCalledWith('one', '74476867')
    expect(fetcher).not.toHaveBeenCalled()

    const tooLarge = await prepareImportBatch(
      createLookup(),
      input,
      'user-1',
      new Map(),
      new Map(),
      {
        fetch: fetcher as unknown as typeof fetch,
        loadFrozenDndBeyondPayload: vi.fn().mockResolvedValue({
          payload,
          utf8ByteLength: 10 * 1024 * 1024 + 1
        })
      }
    )

    expect(tooLarge.items[0]).toMatchObject({
      kind: 'UNABLE',
      issues: [
        expect.objectContaining({
          code: 'DND_BEYOND_UNAVAILABLE',
          message: 'The D&D Beyond character response is too large.'
        })
      ]
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects 1,001 aggregate D&D relationships before lookups and accepts 1,000', async () => {
    const input = {
      source: 'DND_BEYOND' as const,
      systemId: '00000000-0000-4000-8000-000000000001',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      entries: [
        { entryId: 'one', url: 'https://www.dndbeyond.com/characters/1' },
        { entryId: 'two', url: 'https://www.dndbeyond.com/characters/2' }
      ]
    }
    const payload = (characterId: string, relationshipCount: number) => ({
      data: {
        id: characterId,
        name: 'Character ' + characterId,
        classes: [],
        inventory: Array.from({ length: relationshipCount }, (_, index) => ({
          quantity: 1,
          definition: { name: 'Item ' + index }
        }))
      }
    })
    const tooComplexLookup = createLookup()
    const tooComplexLoader = vi
      .fn()
      .mockImplementation(async (entryId: string, characterId: string) => ({
        payload: payload(characterId, entryId === 'one' ? 500 : 501),
        utf8ByteLength: 128
      }))
    const tooComplex = await prepareImportBatch(
      tooComplexLookup,
      input,
      'user-1',
      new Map(),
      new Map(),
      { loadFrozenDndBeyondPayload: tooComplexLoader }
    )

    expect(tooComplex.items).toHaveLength(2)
    expect(tooComplex.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'UNABLE',
          issues: [expect.objectContaining({ code: 'IMPORT_BATCH_TOO_COMPLEX' })]
        })
      ])
    )
    expect(tooComplexLoader).toHaveBeenCalledTimes(2)
    for (const lookup of Object.values(tooComplexLookup)) expect(lookup).not.toHaveBeenCalled()

    const boundary = await prepareImportBatch(
      createLookup(),
      input,
      'user-1',
      new Map(),
      new Map(),
      {
        loadFrozenDndBeyondPayload: vi
          .fn()
          .mockImplementation(async (_entryId: string, characterId: string) => ({
            payload: payload(characterId, 500),
            utf8ByteLength: 128
          }))
      }
    )

    expect(boundary.items).toHaveLength(2)
    expect(boundary.items.every((item) => item.kind === 'CHARACTER')).toBe(true)
  })

  describe('custom Equipment terms resolved from the System vocabulary', () => {
    const systemId = '00000000-0000-4000-8000-000000000001'
    const vocabulary = {
      damageTypes: [{ id: 'damage-piercing', code: 'PIERCING', label: 'Piercing' }],
      rarities: [{ id: 'rarity-legendary', code: 'LEGENDARY', label: 'Legendary' }],
      goldCurrencyId: SRD_GOLD_CURRENCY_ID,
      walkSpeedId: SRD_WALK_SPEED_ID,
      stealthSkillId: SRD_STEALTH_SKILL_ID,
      dwarvenHeritageId: SRD_DWARVEN_HERITAGE_ID
    }

    async function prepareAstralTear(rarity: string) {
      const lookup = createLookup()
      lookup.findSystemVocabulary = vi.fn().mockResolvedValue(vocabulary)
      let next = 0
      const prepared = await prepareImportBatch(
        lookup,
        {
          source: 'DND_BEYOND',
          systemId,
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
          entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
        },
        'user-1',
        new Map(),
        new Map(),
        {
          createId: () => `00000000-0000-4000-8000-${(++next).toString().padStart(12, '0')}`,
          loadFrozenDndBeyondPayload: vi.fn().mockResolvedValue({
            utf8ByteLength: 128,
            payload: {
              data: {
                id: 74476867,
                name: 'Aria',
                classes: [],
                inventory: [
                  {
                    quantity: 1,
                    equipped: true,
                    definition: {
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
                      properties: [{ name: 'Finesse' }, { name: 'Light' }],
                      magic: true,
                      rarity,
                      weight: 2,
                      cost: 100
                    }
                  }
                ]
              }
            }
          })
        }
      )
      return { lookup, prepared }
    }

    it('activates a fully resolved imported item, in the preview and in the prepared plan', async () => {
      const { lookup, prepared } = await prepareAstralTear('Legendary')
      const [item] = prepared.items
      if (item?.kind !== 'CHARACTER') throw new Error('Expected a prepared Character.')

      expect(lookup.findSystemVocabulary).toHaveBeenCalledWith({ systemId })
      expect(item.customContent[0]).toMatchObject({
        activationEligible: true,
        activate: true,
        payload: {
          rarityId: 'rarity-legendary',
          cost: { amount: 100, currencyId: SRD_GOLD_CURRENCY_ID },
          effects: [expect.anything()],
          modifiers: expect.any(Array)
        }
      })
      expect(toImportPreviewResponse(prepared).items[0]?.relatedContent).toEqual([
        expect.objectContaining({
          activationEligible: true,
          destination: expect.objectContaining({ kind: 'ACTIVE_AUTHORED_CONTENT' })
        })
      ])
    })

    it('keeps an imported item with an unresolved rarity as a draft', async () => {
      const { prepared } = await prepareAstralTear('Mythic')
      const [item] = prepared.items
      if (item?.kind !== 'CHARACTER') throw new Error('Expected a prepared Character.')

      expect(item.customContent[0]).toMatchObject({
        activationEligible: false,
        activate: false,
        payload: { rarityId: '' }
      })
    })

    it('reports an unknown damage type once, on the Character, and imports the weapon without an attack', async () => {
      const lookup = createLookup()
      lookup.findSystemVocabulary = vi.fn().mockResolvedValue({ ...vocabulary, damageTypes: [] })
      const prepared = await prepareImportBatch(
        lookup,
        {
          source: 'DND_BEYOND',
          systemId,
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
          entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
        },
        'user-1',
        new Map(),
        new Map(),
        {
          loadFrozenDndBeyondPayload: vi.fn().mockResolvedValue({
            utf8ByteLength: 128,
            payload: {
              data: {
                id: 74476867,
                name: 'Aria',
                classes: [],
                inventory: [
                  {
                    quantity: 1,
                    definition: {
                      id: 41,
                      name: 'Moonlit Greatsword',
                      isHomebrew: true,
                      filterType: 'Weapon',
                      attackType: 1,
                      range: 5,
                      longRange: 5,
                      damage: { diceString: '2d6' },
                      damageType: 'Slashing',
                      properties: [{ name: 'Heavy' }]
                    }
                  }
                ]
              }
            }
          })
        }
      )
      const [item] = prepared.items
      if (item?.kind !== 'CHARACTER') throw new Error('Expected a prepared Character.')

      expect(item.issues.filter(({ code }) => code === 'UNKNOWN_DAMAGE_TYPE')).toHaveLength(1)
      expect(item.customContent[0]?.payload).not.toHaveProperty('effects')
    })
  })
})
