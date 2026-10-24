import type { CharacterRestPreviewRequestDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  formatCharacterHitDiceRollExpression,
  toCharacterResourceOwnerKey,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'
import { describe, expect, it } from 'vitest'

import { pruneSheetAdjustments } from '../character/sheetAdjustmentCommands.js'
import { applyCompletedCharacterRest, buildCharacterRestPreview } from '../character/sheetRest.js'
import { pruneSheetResourceUsage } from '../character/sheetResourceUsage.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  restParamsFromFixtureSheet
} from '../testing/characterContextFixtures.js'

const shortRest = {
  restKind: 'SHORT',
  expectedVersion: 1,
  selectedHitDice: [],
  resetMaximumHitPointModifier: false,
  healingMode: 'AUTOMATIC',
  manualHealingAccepted: false,
  selectedCompanionInstanceIds: [],
  requestRoll: false
} satisfies CharacterRestPreviewRequestDto

const longRest = { ...shortRest, restKind: 'LONG' } satisfies CharacterRestPreviewRequestDto

/**
 * The fixture Fighter after play: current hit points and one spent Hit Die, optionally with the
 * Short Rest Resource used, prepared into a Sheet and the inputs the rest functions take.
 */
async function playedFighter({ hitDiceUsed = 0, resourceUsed = false } = {}) {
  const fixture = readyFighterFixture()
  const { character: created } = await prepareFixtureBuilder(fixture)
  const character = {
    ...created,
    state: {
      ...created.state,
      hitpoints: {
        ...created.state.hitpoints,
        current: 3,
        hitDice: created.state.hitpoints.hitDice.map((pool) => ({ ...pool, used: hitDiceUsed }))
      }
    }
  }
  const fresh = await prepareFixtureSheet({ ...fixture, character })
  const resource = fresh.sheet.resources.items[0]
  if (!resource) throw new Error('Expected the Short Rest Resource on the Sheet.')
  const prepared = resourceUsed
    ? await prepareFixtureSheet({
        ...fixture,
        character,
        resourceUsage: [{ owner: toCharacterResourceOwnerKey(resource.owner), used: 1 }]
      })
    : fresh
  return {
    resource,
    params: restParamsFromFixtureSheet(prepared)
  }
}

describe('Character rest over an in-memory context', () => {
  it('previews a short rest that recovers a used Resource', async () => {
    const { resource, params } = await playedFighter({ resourceUsed: true })
    const preview = await buildCharacterRestPreview({ ...params, input: shortRest })
    expect(preview.automaticRecoveries.resources).toEqual([
      { id: resource.id, label: resource.label, recovered: 1 }
    ])
    expect(preview.hitPoints).toMatchObject({ current: 3, maximum: 11, missing: 8 })
    expect(preview.canApply).toBe(true)
  })

  it('cannot apply a short rest with nothing to recover or spend', async () => {
    const { params } = await playedFighter()
    const preview = await buildCharacterRestPreview({ ...params, input: shortRest })
    expect(preview.automaticRecoveries).toEqual({ resources: [], spellSlots: [] })
    expect(preview.canApply).toBe(false)
  })

  it('stages healing from hit-die roll evidence and needs it before it can apply', async () => {
    const { params } = await playedFighter()
    const modifierPerDie = params.restPolicy.hitDieConstitutionModifier
    const selectedHitDice = [{ die: 10, count: 1 }]
    const terms = [{ ...selectedHitDice[0]!, modifierPerDie }]
    const input = { ...shortRest, selectedHitDice }
    const withoutRoll = await buildCharacterRestPreview({ ...params, input })
    expect(withoutRoll.canApply).toBe(false)
    expect(withoutRoll.canonicalExpression).toBe(formatCharacterHitDiceRollExpression(terms))

    const total = 6 + modifierPerDie
    const preview = await buildCharacterRestPreview({
      ...params,
      input: {
        ...input,
        rollEvidence: {
          expression: formatCharacterHitDiceRollExpression(terms),
          terms: [{ ...terms[0]!, rolls: [6] }],
          total
        }
      }
    })
    expect(preview.stagedHealing).toBe(total)
    expect(preview.canApply).toBe(true)

    const { character, result } = applyCompletedCharacterRest({
      character: params.character,
      sheet: params.sheet,
      restPolicy: params.restPolicy,
      preview,
      command: {
        ...input,
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        previewFingerprint: preview.previewFingerprint,
        rollEvidence: preview.rollEvidence
      }
    })
    expect(character.state.hitpoints.current).toBe(3 + total)
    expect(character.state.hitpoints.hitDice).toEqual([{ die: 10, total: 1, used: 1 }])
    expect(result).toMatchObject({
      restKind: 'SHORT',
      spentHitDice: selectedHitDice,
      hitPoints: { currentBefore: 3, currentAfter: 3 + total, healingApplied: total }
    })
  })

  it('rejects hit dice and roll evidence on a long rest', async () => {
    const { params } = await playedFighter()
    await expect(
      buildCharacterRestPreview({
        ...params,
        input: { ...longRest, selectedHitDice: [{ die: 10, count: 1 }] }
      })
    ).rejects.toThrow('Long rests do not spend hit dice.')
  })

  it('completes a long rest by restoring hit points, recovering hit dice and listing recovered Resources', async () => {
    const { resource, params } = await playedFighter({ hitDiceUsed: 1, resourceUsed: true })
    const preview = await buildCharacterRestPreview({ ...params, input: longRest })
    expect(preview.canApply).toBe(true)

    const { character, result, allRecoveredResourceIds } = applyCompletedCharacterRest({
      character: params.character,
      sheet: params.sheet,
      restPolicy: params.restPolicy,
      preview,
      command: {
        ...longRest,
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        previewFingerprint: preview.previewFingerprint
      }
    })
    expect(character.state.hitpoints.current).toBe(11)
    expect(character.state.hitpoints.hitDice).toEqual([{ die: 10, total: 1, used: 0 }])
    expect(allRecoveredResourceIds).toEqual([resource.id])
    expect(result).toMatchObject({
      restKind: 'LONG',
      recoveredResourceIds: [resource.id],
      recoveredHitDice: [{ die: 10, count: 1 }],
      hitPoints: { currentBefore: 3, currentAfter: 11, healingApplied: 8 }
    })
  })
})

describe('Sheet rest cleanup', () => {
  const ownerIds = {
    recovered: crypto.randomUUID(),
    item: crypto.randomUUID(),
    companion: crypto.randomUUID(),
    kept: crypto.randomUUID()
  }
  const metadata = {
    characterId: crypto.randomUUID(),
    createdBy: crypto.randomUUID(),
    updatedBy: crypto.randomUUID(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  }
  const usage = (owner: CharacterResourceUsage['owner']): CharacterResourceUsage => ({
    id: crypto.randomUUID(),
    ...metadata,
    owner,
    used: 1
  })
  const itemUsage = (itemInstanceId: string) =>
    usage({ kind: 'ITEM_INSTANCE', itemInstanceId, chargeId: 'charge' })
  const companionUsage = (companionInstanceId: string) =>
    usage({
      kind: 'COMPANION_FEATURE',
      companionInstanceId,
      chargeId: 'charge',
      featureId: 'feature'
    })

  it('drops usage for recovered Resources, a removed Item and a removed companion only', async () => {
    const { resource } = await playedFighter({ resourceUsed: true })
    const recovered = usage(toCharacterResourceOwnerKey(resource.owner))
    const keptItem = itemUsage(ownerIds.kept)
    const keptCompanion = companionUsage(ownerIds.kept)
    const resourceUsage = [
      recovered,
      itemUsage(ownerIds.item),
      companionUsage(ownerIds.companion),
      keptItem,
      keptCompanion
    ]
    const prune = (overrides: Partial<Parameters<typeof pruneSheetResourceUsage>[0]>) =>
      pruneSheetResourceUsage({
        resourceUsage,
        resources: [resource],
        recoveredResourceIds: new Set(),
        ...overrides
      })

    expect(prune({})).toEqual(resourceUsage)
    expect(prune({ recoveredResourceIds: new Set([resource.id]) })).toEqual(resourceUsage.slice(1))
    expect(prune({ removedItemId: ownerIds.item })).toEqual([
      recovered,
      resourceUsage[2],
      keptItem,
      keptCompanion
    ])
    expect(prune({ removedCompanionId: ownerIds.companion })).toEqual([
      recovered,
      resourceUsage[1],
      keptItem,
      keptCompanion
    ])
  })

  it('drops the reset maximum modifier and the adjustments of a removed Item only', () => {
    const maximumModifier = {
      ...metadata,
      id: crypto.randomUUID(),
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: -4
    } satisfies CharacterSheetAdjustment
    const itemAdjustment = (itemInstanceId: string) =>
      ({
        ...metadata,
        id: crypto.randomUUID(),
        family: 'ITEM',
        itemInstanceId,
        field: 'DAMAGE_BONUS',
        value: 1
      }) satisfies CharacterSheetAdjustment
    const removed = itemAdjustment(ownerIds.item)
    const kept = itemAdjustment(ownerIds.kept)
    const adjustments = [maximumModifier, removed, kept]

    expect(pruneSheetAdjustments({ adjustments })).toEqual(adjustments)
    expect(
      pruneSheetAdjustments({ adjustments, resetMaximumModifierId: maximumModifier.id })
    ).toEqual([removed, kept])
    expect(pruneSheetAdjustments({ adjustments, removedItemId: ownerIds.item })).toEqual([
      maximumModifier,
      kept
    ])
  })

  it('keeps spell summons through a short rest and ends them all on a long rest (D190)', async () => {
    const { params } = await playedFighter({ resourceUsed: true })
    const summon = (id: string, concentration: boolean) => ({
      id,
      spellId: 'spell-summon',
      summonOutcomeId: 'summon',
      label: 'Hand',
      concentration,
      armorClass: 20,
      maximumHitPoints: 11,
      currentHitPoints: 11,
      castAt: '2026-10-23T00:00:00.000Z'
    })
    const character = {
      ...params.character,
      state: {
        ...params.character.state,
        spellSummons: [
          summon('00000000-0000-4000-8000-000000000a01', true),
          summon('00000000-0000-4000-8000-000000000a02', false)
        ]
      }
    }
    const rest = async (input: typeof shortRest | typeof longRest) => {
      const preview = await buildCharacterRestPreview({ ...params, character, input })
      return applyCompletedCharacterRest({
        character,
        sheet: params.sheet,
        restPolicy: params.restPolicy,
        preview,
        command: {
          ...input,
          type: 'COMPLETE_REST',
          commandId: crypto.randomUUID(),
          previewFingerprint: preview.previewFingerprint
        }
      }).character.state.spellSummons
    }

    expect(await rest(shortRest)).toEqual(character.state.spellSummons)
    expect(await rest(longRest)).toBeUndefined()
  })
})
