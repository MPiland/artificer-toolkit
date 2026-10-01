import { afterEach, expect, it, vi } from 'vitest'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { getFunctionName, type FunctionReturnType } from 'convex/server'
import type { ActionCtx } from '../_generated/server'
import type { CurrencySystemDto } from '@artificer-toolkit/schema/api/campaignInventory'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { createDevelopmentCharacter } from '../../tests/developmentCharacterFixture'
import { populateCampaignLifecycleCharacter } from '../../tests/developmentCampaignLifecycleCharacter'
import { api, internal } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import { verifyEquipmentCharacterDeletion } from '../../tests/developmentEquipmentCharacter'
import type { DevelopmentClient } from '../../tests/developmentClient'
import { inProcessDevelopmentClient } from '../../tests/fixtures/liveSessionWorker'

afterEach(() => {
  vi.useRealTimers()
})

it('reconciles Equipment loss through public authoring, Builder and Sheet commands', async () => {
  // Full-corpus work must not expire the fixture's one-minute auth session.
  vi.useFakeTimers({ toFake: ['Date'] })
  const { t, first, second } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  expect(await t.action(internal.content.seed.seed, {})).toMatchObject({
    subjects: 1057
  })
  const owner: Parameters<typeof verifyEquipmentCharacterDeletion>[0]['owner'] = {
    query: (query, ...args) => first.caller.run((ctx) => ctx.runQuery(query, ...args)),
    action: (action, ...args) =>
      first.caller.action<(ctx: ActionCtx) => Promise<FunctionReturnType<typeof action>>>((ctx) =>
        ctx.runAction(action, ...args)
      ),
    mutation: (mutation, ...args) => first.caller.run((ctx) => ctx.runMutation(mutation, ...args))
  }
  const other = inProcessDevelopmentClient(second.caller)
  const anonymous = inProcessDevelopmentClient(t)
  const characterId = crypto.randomUUID()
  await verifyEquipmentCharacterDeletion({
    owner,
    other,
    anonymous,
    characterId
  })
  await t.run(async (ctx) => {
    const record = await readCharacterRow(ctx, characterId)
    expect(record?.status).toBe('ACTIVE')
    expect(record?.sheetState).toBeDefined()
    expect(await ctx.db.query('characterCommandReceipts').collect()).toHaveLength(6)
  })
}, 240_000)

it('keeps same-owner Character fixtures independently publishable', async () => {
  // Full-corpus work must not expire the fixture's one-minute auth session.
  vi.useFakeTimers({ toFake: ['Date'] })
  if (fighter.category !== 'BASE') throw new Error('Canonical Fighter must be a base Class.')
  const startingGoldCurrencyId = fighter.startingGold.currencyId
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  await t.action(internal.content.seed.seed, {})
  const owner: Parameters<typeof verifyEquipmentCharacterDeletion>[0]['owner'] = {
    query: (query, ...args) => first.caller.run((ctx) => ctx.runQuery(query, ...args)),
    action: (action, ...args) =>
      first.caller.action<(ctx: ActionCtx) => Promise<FunctionReturnType<typeof action>>>((ctx) =>
        ctx.runAction(action, ...args)
      ),
    mutation: (mutation, ...args) => first.caller.run((ctx) => ctx.runMutation(mutation, ...args))
  }
  const firstId = crypto.randomUUID()
  const secondId = crypto.randomUUID()
  await createDevelopmentCharacter(owner, firstId)
  const firstSheet = await owner.query(api.characters.sheet.get, { id: firstId })
  expect(firstSheet).not.toBeNull()
  expect(firstSheet?.meta.characterId).toBe(firstId)
  expect(firstSheet?.inventory.items.find((item) => item.equipmentId === club.id)?.quantity).toBe(2)
  expect(
    firstSheet?.inventory.currencies.some(
      (currency) =>
        currency.currencyId === startingGoldCurrencyId &&
        currency.kind === 'RULESET' &&
        currency.amount === 100
    )
  ).toBe(true)

  const firstRecord = await t.run((ctx) => readCharacterRow(ctx, firstId))
  const secondFixture = await createDevelopmentCharacter(owner, secondId)
  const [firstAfter, secondSheet] = await Promise.all([
    owner.query(api.characters.sheet.get, { id: firstId }),
    owner.query(api.characters.sheet.get, { id: secondId })
  ])
  expect(firstAfter).toEqual(firstSheet)
  expect(await owner.query(api.characters.equipmentOptions.list, { id: firstId })).toContainEqual(
    expect.objectContaining({ id: secondFixture.equipment.subjectId, isContainer: true })
  )
  expect(await t.run((ctx) => readCharacterRow(ctx, firstId))).toEqual(firstRecord)
  expect(secondSheet).not.toBeNull()
  expect(secondSheet?.meta.characterId).toBe(secondId)
  expect(secondSheet?.inventory.items.find((item) => item.equipmentId === club.id)?.quantity).toBe(
    2
  )
  expect(
    secondSheet?.inventory.currencies.some(
      (currency) =>
        currency.currencyId === startingGoldCurrencyId &&
        currency.kind === 'RULESET' &&
        currency.amount === 100
    )
  ).toBe(true)
}, 240_000)
it('publishes two Campaign lifecycle Background fixtures for one owner', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'BACKGROUND',
          id: acolyte.id,
          systemId: srdSystemRecord.id,
          label: acolyte.label,
          document: acolyte
        })
      ]
    ]
  )
  const baseOwner = inProcessDevelopmentClient(first.caller)
  const firstCharacterId = crypto.randomUUID()
  const secondCharacterId = crypto.randomUUID()

  const sentinel = 'CAMPAIGN_BACKGROUND_SHARE_STOP'
  let shareCalls = 0
  const owner: DevelopmentClient = {
    query: baseOwner.query,
    mutation: (mutation, ...args) => {
      if (getFunctionName(mutation) === getFunctionName(api.campaigns.contentShares.share)) {
        shareCalls += 1
        throw new Error(sentinel)
      }
      return baseOwner.mutation(mutation, ...args)
    }
  }
  const currencySystem: CurrencySystemDto = {
    id: crypto.randomUUID(),
    label: 'Fixture currency',
    isReference: false,
    version: 0,
    denominations: [
      { id: crypto.randomUUID(), label: 'Gold', abbreviation: 'gp', scaleInReference: 1 },
      { id: crypto.randomUUID(), label: 'Silver', abbreviation: 'sp', scaleInReference: 0.1 }
    ]
  }
  const input = (characterId: string) => ({
    owner,
    player: baseOwner,
    campaignId: crypto.randomUUID(),
    characterId,
    currencySystem,
    vehicleIds: [crypto.randomUUID(), crypto.randomUUID()] as [string, string]
  })
  const readBackgrounds = () =>
    t.run(async (ctx) => {
      const [roots, versions, drafts] = await Promise.all([
        ctx.db.query('authoredRoots').collect(),
        ctx.db.query('authoredVersions').collect(),
        ctx.db.query('authoredDrafts').collect()
      ])
      return roots
        .filter(
          (root) =>
            root.ownerUserId === first.userId &&
            root.subjectKind === 'BACKGROUND' &&
            root.label.startsWith('P09 shared minimal Background')
        )
        .map((root) => ({
          root,
          version: versions.find((version) => version._id === root.currentVersionId),
          draft: drafts.find((draft) => draft.subjectId === root.id)
        }))
        .sort((left, right) => left.root.id.localeCompare(right.root.id))
    })
  await expect(populateCampaignLifecycleCharacter(input(firstCharacterId))).rejects.toThrow(
    sentinel
  )
  expect(shareCalls).toBe(1)
  const firstPublication = await readBackgrounds()
  expect(firstPublication).toHaveLength(1)
  await expect(populateCampaignLifecycleCharacter(input(secondCharacterId))).rejects.toThrow(
    sentinel
  )
  expect(shareCalls).toBe(2)
  const publications = await readBackgrounds()
  expect(publications).toHaveLength(2)
  expect(publications.find((entry) => entry.root.id === firstPublication[0]?.root.id)).toEqual(
    firstPublication[0]
  )
  expect(publications[0]?.root.id).not.toBe(publications[1]?.root.id)
  expect(publications[0]?.root.label).not.toBe(publications[1]?.root.label)
}, 240_000)
