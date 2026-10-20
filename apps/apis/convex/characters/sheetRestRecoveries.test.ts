import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import { api } from '../_generated/api'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const preview = makeFunctionReference<
  'query',
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
>('characters/rest:preview')

type WithoutCommandIdentity<T> = T extends unknown
  ? Omit<T, 'commandId' | 'expectedVersion'>
  : never
function command(
  characterId: string,
  expectedVersion: number,
  body: WithoutCommandIdentity<CharacterSheetExecuteInput['command']>
): CharacterSheetExecuteInput {
  return { id: characterId, command: { ...body, commandId: crypto.randomUUID(), expectedVersion } }
}

function restInput(
  restKind: 'SHORT' | 'LONG',
  expectedVersion: number,
  selectedCompanionInstanceIds: string[] = []
) {
  return {
    restKind,
    expectedVersion,
    selectedHitDice: [],
    resetMaximumHitPointModifier: false,
    healingMode: 'AUTOMATIC' as const,
    manualHealingAccepted: false,
    selectedCompanionInstanceIds,
    requestRoll: false as const
  }
}

async function fixture(spellcasting?: typeof wizard.spellcasting) {
  const shortResource = {
    id: crypto.randomUUID(),
    label: 'Short Resource',
    order: 0,
    availableAtLevel: 1,
    charges: {
      id: crypto.randomUUID(),
      resetKind: 'SHORT_REST' as const,
      limitKind: 'FIXED_AMOUNT' as const,
      scalingKind: 'NONE' as const,
      amount: 2
    }
  }
  const longEquipment = {
    ...club,
    id: crypto.randomUUID(),
    label: 'Long-Rest Club',
    charges: {
      id: crypto.randomUUID(),
      resetKind: 'LONG_REST' as const,
      limitKind: 'FIXED_AMOUNT' as const,
      scalingKind: 'NONE' as const,
      amount: 2
    }
  }
  const sourceFeature = cat.features?.[0]
  if (!sourceFeature) throw new Error('Expected a Cat feature.')
  const feature = {
    ...sourceFeature,
    charges: {
      id: crypto.randomUUID(),
      resetKind: 'LONG_REST' as const,
      limitKind: 'FIXED_AMOUNT' as const,
      scalingKind: 'NONE' as const,
      amount: 2
    }
  }
  const creature = { ...cat, id: crypto.randomUUID(), label: 'Rest Cat', features: [feature] }
  const base = await readyCharacterFixture({ resources: shortResource, spellcasting })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'EQUIPMENT', ...longEquipment, document: longEquipment }),
      importedSubject({ subjectKind: 'CREATURE', ...creature, document: creature })
    ]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => {
      const stored = await readCharacterRow(ctx, character.id)
      return {
        character: stored,
        authored: stored ? readCharacterRecord(stored) : null,
        sheetState: stored ? readCharacterSheetState(stored) : null,
        receipts: await readReceiptHeaders(
          ctx,
          'characterCommandReceipts',
          await ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
            .collect()
        )
      }
    })
  return { ...base, character, creature, longEquipment, readState }
}

describe('native Character Sheet rest recovery', () => {
  it.each([
    {
      label: 'standard',
      slotKey: 'STANDARD:1' as const,
      spellcasting: wizard.spellcasting,
      shortUsed: 1
    },
    { label: 'Pact', slotKey: 'PACT' as const, spellcasting: warlock.spellcasting, shortUsed: 0 }
  ])(
    'recovers $label slots on their allowed rest only',
    async ({ slotKey, spellcasting, shortUsed }) => {
      if (!spellcasting) throw new Error('Expected canonical spellcasting.')
      const { owner, character, readState } = await fixture({
        ...spellcasting,
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }],
            learnedSpellsLimit: 0,
            cantripsLimit: 0
          }
        ]
      })
      let response = await owner.caller.mutation(
        execute,
        command(character.id, 1, { type: 'USE_SPELL_SLOT', slotKey })
      )
      expect(response).not.toHaveProperty('sheet')
      let responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      const resource = responseSheet.resources.items.find(
        (entry) => entry.label === 'Short Resource'
      )!
      response = await owner.caller.mutation(
        execute,
        command(character.id, 2, { type: 'USE_SHEET_RESOURCE', owner: resource.owner, amount: 1 })
      )
      expect(response).not.toHaveProperty('sheet')
      responseSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: response.characterId
      }))!
      for (const restKind of ['SHORT', 'LONG'] as const) {
        const before = await readState()
        const input = restInput(restKind, response.streamVersion)
        const projected = await owner.caller.query(preview, { id: character.id, input })
        expect(projected.automaticRecoveries.spellSlots.map((slot) => slot.id)).toEqual(
          restKind === 'LONG' || slotKey === 'PACT' ? [slotKey] : []
        )
        expect(await readState()).toEqual(before)
        response = await owner.caller.mutation(
          execute,
          command(character.id, response.streamVersion, {
            type: 'COMPLETE_REST',
            restKind,
            previewFingerprint: projected.previewFingerprint,
            selectedHitDice: [],
            resetMaximumHitPointModifier: false,
            healingMode: 'AUTOMATIC',
            manualHealingAccepted: false,
            selectedCompanionInstanceIds: []
          })
        )
        expect(response).not.toHaveProperty('sheet')
        responseSheet = (await owner.caller.query(api.characters.sheet.get, {
          id: response.characterId
        }))!
        const expectedUsed = restKind === 'SHORT' ? shortUsed : 0
        expect(responseSheet.spells.slots.find((slot) => slot.slotKey === slotKey)?.used).toBe(
          expectedUsed
        )
        expect((await readState()).authored!.state.spellSlots ?? []).toEqual(
          expectedUsed ? [{ slotKey, used: expectedUsed }] : []
        )
        if (restKind === 'SHORT' && slotKey === 'PACT') {
          response = await owner.caller.mutation(
            execute,
            command(character.id, response.streamVersion, { type: 'USE_SPELL_SLOT', slotKey })
          )
          expect(response).not.toHaveProperty('sheet')
          responseSheet = (await owner.caller.query(api.characters.sheet.get, {
            id: response.characterId
          }))!
        }
      }
    }
  )

  it('previews without writes, recovers short resources first, then long resources while preserving adjustments', async () => {
    const { owner, character, longEquipment, readState } = await fixture()
    let response = await owner.caller.mutation(
      execute,
      command(character.id, 1, {
        type: 'ADD_INVENTORY_ITEM',
        equipmentId: longEquipment.id,
        quantity: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    let responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const longResource = responseSheet.resources.items.find(
      (resource) => resource.owner.kind === 'ITEM_INSTANCE'
    )!
    const shortResource = responseSheet.resources.items.find(
      (resource) => resource.label === 'Short Resource'
    )!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 2, {
        type: 'USE_SHEET_RESOURCE',
        owner: shortResource.owner,
        amount: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 3, { type: 'USE_SHEET_RESOURCE', owner: longResource.owner, amount: 1 })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    await owner.caller.mutation(
      execute,
      command(character.id, 4, {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: { family: 'ABILITY', ability: 'STRENGTH', field: 'SCORE_OVERRIDE', value: 18 }
      })
    )
    const beforePreview = await readState()
    const short = await owner.caller.query(preview, {
      id: character.id,
      input: restInput('SHORT', 5)
    })
    expect(short.automaticRecoveries.resources.map((entry) => entry.id)).toContain(shortResource.id)
    expect(short.automaticRecoveries.resources.map((entry) => entry.id)).not.toContain(
      longResource.id
    )
    expect(await readState()).toEqual(beforePreview)
    response = await owner.caller.mutation(
      execute,
      command(character.id, 5, {
        type: 'COMPLETE_REST',
        restKind: 'SHORT',
        previewFingerprint: short.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    let state = (await readState()).sheetState!
    expect(
      state.resourceUsage.some(
        (usage) =>
          createCharacterResourceOwnerKey(usage.owner) ===
          createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(shortResource.owner))
      )
    ).toBe(false)
    expect(state.resourceUsage).toEqual(
      beforePreview.sheetState!.resourceUsage.filter(
        (usage) =>
          createCharacterResourceOwnerKey(usage.owner) ===
          createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(longResource.owner))
      )
    )
    expect(state.adjustments).toEqual(beforePreview.sheetState!.adjustments)
    response = await owner.caller.mutation(
      execute,
      command(character.id, response.streamVersion, {
        type: 'USE_SHEET_RESOURCE',
        owner: shortResource.owner,
        amount: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const beforeLong = await readState()
    const long = await owner.caller.query(preview, {
      id: character.id,
      input: restInput('LONG', response.streamVersion)
    })
    expect(long.automaticRecoveries.resources.map((entry) => entry.id)).toContain(longResource.id)
    expect(long.automaticRecoveries.resources.map((entry) => entry.id)).toContain(shortResource.id)
    expect(await readState()).toEqual(beforeLong)
    response = await owner.caller.mutation(
      execute,
      command(character.id, response.streamVersion, {
        type: 'COMPLETE_REST',
        restKind: 'LONG',
        previewFingerprint: long.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    state = (await readState()).sheetState!
    expect(state.resourceUsage).toEqual([])
    expect(state.adjustments).toEqual(beforeLong.sheetState!.adjustments)
    expect(response.result).toMatchObject({ type: 'COMPLETE_REST', rest: { restKind: 'LONG' } })
  })

  it('recovers only selected companion resources and long-rest companion hit dice', async () => {
    const { owner, character, creature, readState } = await fixture()
    let response = await owner.caller.mutation(
      execute,
      command(character.id, 1, {
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'COMPANION', creatureId: creature.id, originKind: 'WORLD' }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    let responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const firstId = responseSheet.extras.items.find((item) => item.kind === 'COMPANION')!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 2, {
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'COMPANION', creatureId: creature.id, originKind: 'SUMMONED' }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const secondId = responseSheet.extras.items.find(
      (item) => item.kind === 'COMPANION' && item.id !== firstId
    )!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 3, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: { kind: 'COMPANION', extraId: firstId, hitDice: [{ die: 4, total: 1, used: 1 }] }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 4, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: { kind: 'COMPANION', extraId: secondId, hitDice: [{ die: 4, total: 1, used: 1 }] }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const firstResource = responseSheet.resources.items.find(
      (resource) =>
        resource.owner.kind === 'COMPANION_FEATURE' &&
        resource.owner.companionInstanceId === firstId
    )!
    const secondResource = responseSheet.resources.items.find(
      (resource) =>
        resource.owner.kind === 'COMPANION_FEATURE' &&
        resource.owner.companionInstanceId === secondId
    )!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 5, {
        type: 'USE_SHEET_RESOURCE',
        owner: firstResource.owner,
        amount: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 6, {
        type: 'USE_SHEET_RESOURCE',
        owner: secondResource.owner,
        amount: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const beforePreview = await readState()
    const rest = await owner.caller.query(preview, {
      id: character.id,
      input: restInput('LONG', 7, [firstId])
    })
    expect(
      rest.eligibleCompanions.find((companion) => companion.companionInstanceId === firstId)
    ).toMatchObject({
      selected: true,
      hitDice: [{ used: 1, recovered: 1 }],
      resources: [{ id: firstResource.id, recovered: 1 }]
    })
    expect(
      rest.eligibleCompanions.find((companion) => companion.companionInstanceId === secondId)
    ).toMatchObject({
      selected: false,
      hitDice: [{ used: 1, recovered: 1 }],
      resources: [{ id: secondResource.id, recovered: 1 }]
    })
    expect(await readState()).toEqual(beforePreview)
    await owner.caller.mutation(
      execute,
      command(character.id, 7, {
        type: 'COMPLETE_REST',
        restKind: 'LONG',
        previewFingerprint: rest.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [firstId]
      })
    )
    const after = await readState()
    expect(after.sheetState!.resourceUsage).toEqual(
      beforePreview.sheetState!.resourceUsage.filter(
        (usage) =>
          usage.owner.kind === 'COMPANION_FEATURE' && usage.owner.companionInstanceId === secondId
      )
    )
    expect(after.authored!.state.creatures?.find((extra) => extra.id === secondId)).toEqual(
      beforePreview.authored!.state.creatures?.find((extra) => extra.id === secondId)
    )
    expect(
      after.sheetState!.resourceUsage.some(
        (usage) =>
          usage.owner.kind === 'COMPANION_FEATURE' && usage.owner.companionInstanceId === firstId
      )
    ).toBe(false)
    expect(
      after.sheetState!.resourceUsage.some(
        (usage) =>
          usage.owner.kind === 'COMPANION_FEATURE' && usage.owner.companionInstanceId === secondId
      )
    ).toBe(true)
    expect(
      after.authored?.state.creatures?.find((creature) => creature.id === firstId)?.hitDice?.[0]
        ?.used
    ).toBe(0)
    expect(
      after.authored?.state.creatures?.find((creature) => creature.id === secondId)?.hitDice?.[0]
        ?.used
    ).toBe(1)
  })
})
