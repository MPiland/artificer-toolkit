import { test, expect } from './support/auth.fixture'
import type { Locator, Page } from '@playwright/test'
import {
  goToBuilderStep,
  selectBuilderOption,
  selectBuilderOptionAtIndexAndResolve,
  selectBuilderMultiOptionAndResolve,
  selectBuilderOptionAndResolve
} from './support/characterBuilder'
import {
  runAndWaitForSuccessfulTrpcProcedure,
  waitForSuccessfulTrpcBatch,
  waitForSuccessfulTrpcProcedure
} from './support/trpc'

test.describe('MVP character Builder to Sheet', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates, drafts, reloads, previews, and finalizes a Human Fighter Rogue', async ({
    authenticatedPage: page
  }) => {
    test.setTimeout(900_000)
    const characterName = `MVP Martial Multiclass ${Date.now()}`

    await page.goto('/characters/new', { waitUntil: 'domcontentloaded' })
    await expectBuilderReady(page)
    await expect(page.getByLabel('Character Name')).toBeVisible()
    await page.getByLabel('Character Name').fill(characterName)

    await goToBuilderStep(page, 'Race')
    await selectBuilderOptionAndResolve(page, 'Race', 'Human')
    await selectBuilderOptionAndResolve(page, /^Languages/, 'Dwarvish')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderOption(page, 'Add Class', 'Fighter')
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Add Class', exact: true }).click(),
      { method: 'POST' }
    )
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByLabel('Class Level').fill('2'),
      { method: 'POST' }
    )
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies 1 of 2/, 'Athletics')
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies 2 of 2/, 'Perception')
    await selectBuilderOptionAndResolve(page, /^Fighting Style choice/, 'Defense')

    await goToBuilderStep(page, 'Background')
    await selectBuilderOptionAndResolve(page, 'Background', 'Acolyte')
    await selectBuilderOptionAndResolve(page, /^Languages 1 of 2/, 'Celestial')
    await selectBuilderOptionAndResolve(page, /^Languages 2 of 2/, 'Infernal')

    await goToBuilderStep(page, 'Abilities & HP')
    await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue(
      'Standard Array'
    )
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Fill Six Abilities' }).click(),
      { method: 'POST' }
    )
    await selectBuilderOptionAtIndexAndResolve(page, /^Score$/, 1, '13')
    await selectBuilderOptionAtIndexAndResolve(page, /^Score$/, 3, '10')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderOption(page, 'Add Class', 'Rogue')
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Add Class', exact: true }).click(),
      { method: 'POST' }
    )
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies$/, 'Stealth')

    await goToBuilderStep(page, 'Abilities & HP')
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Add Missing Levels' }).click(),
      { method: 'POST' }
    )
    expect((await readHitPointProgression(page)).map((row) => row.classProgression)).toEqual([
      'Fighter 1',
      'Fighter 2',
      'Rogue 1'
    ])
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Move Rogue level 1 up' }).click(),
      { method: 'POST' }
    )
    const expectedHitPointProgression = await readHitPointProgression(page)
    expect(expectedHitPointProgression.map((row) => row.classProgression)).toEqual([
      'Fighter 1',
      'Rogue 1',
      'Fighter 2'
    ])

    const equipmentDefaultsResolvePromise = waitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      { method: 'POST' }
    )
    await goToBuilderStep(page, 'Equipment & Currency')
    await equipmentDefaultsResolvePromise
    await completeFighterAndAcolyteEquipment(page)

    await goToBuilderStep(page, 'Review')
    await expect(page.getByText('Ready to finalize', { exact: true })).toBeVisible()

    const editRedirectPromise = page.waitForURL(/\/characters\/[^/]+\/[^/]+\/edit$/)
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.saveDraft',
      async () => page.getByRole('button', { name: 'Save Draft', exact: true }).click(),
      { method: 'POST' }
    )
    await editRedirectPromise
    expect(new URL(page.url()).pathname).toMatch(
      /^\/characters\/[^/]+\/mvp-martial-multiclass-\d+\/edit$/
    )
    await expectBuilderReady(page)

    await page.reload({ waitUntil: 'networkidle' })
    await expectBuilderReady(page)
    await goToBuilderStep(page, 'Basics')
    await expect(page.getByLabel('Character Name')).toHaveValue(characterName)
    await assertPersistedMulticlassChoices(page, expectedHitPointProgression)
    await goToBuilderStep(page, 'Review')
    await expect(page.getByText('Ready to finalize', { exact: true })).toBeVisible()

    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.previewSave',
      async () => page.getByRole('button', { name: 'Finalize Character' }).click(),
      { method: 'POST', timeout: 120_000 }
    )
    await expect(page.getByRole('dialog', { name: 'Finalize Character' })).toBeVisible()

    const sheetResponsePromise = waitForSuccessfulTrpcBatch(
      page,
      ['characters.sheet', 'characters.getDraft'],
      { method: 'GET', timeout: 120_000 }
    )
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.upsert',
      async () =>
        page
          .getByRole('dialog', { name: 'Finalize Character' })
          .getByRole('button', { name: 'Finalize', exact: true })
          .click(),
      { method: 'POST', timeout: 60_000 }
    )
    await sheetResponsePromise
    await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: characterName, exact: true })).toBeVisible()

    const beforeReload = await readCoreSheetSnapshot(page)
    expect(beforeReload.identity).toContain('Fighter 2 / Rogue 1')
    expect(beforeReload.identity).toContain('Human / Acolyte')
    expect(beforeReload.identity).toMatch(/\bLevel 3\b/i)
    expect(beforeReload.vitals).toMatch(/\bProficiency \+2\b/i)
    const hitPoints = readHitPointPair(beforeReload.vitals)
    expect(hitPoints.current).toBe(hitPoints.maximum)
    expect(beforeReload.vitals).toMatch(/\bHit Dice\s+2\/2d10, 1\/1d8\b/i)
    expect(beforeReload.abilities).toContain('STR')
    expect(beforeReload.abilities).toContain('CHA')

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: characterName, exact: true })).toBeVisible({
      timeout: 120_000
    })
    expect(await readCoreSheetSnapshot(page)).toEqual(beforeReload)
  })

  test('creates and finalizes a Human Life Cleric, then persists preparation and slot usage', async ({
    authenticatedPage: page
  }) => {
    test.setTimeout(900_000)
    const characterName = `MVP Prepared ${Date.now()}`

    await startNewCharacter(page, characterName)

    await goToBuilderStep(page, 'Race')
    await selectBuilderOptionAndResolve(page, 'Race', 'Human')
    await selectBuilderOptionAndResolve(page, /^Languages/, 'Dwarvish')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderOption(page, 'Add Class', 'Cleric')
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Add Class', exact: true }).click(),
      { method: 'POST' }
    )
    await selectBuilderOptionAndResolve(page, 'Subclass', 'Life Domain')
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies 1 of 2/, 'History')
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies 2 of 2/, 'Insight')
    await selectBuilderMultiOptionAndResolve(page, 'Choose 3 cantrips', 'Guidance')
    await selectBuilderMultiOptionAndResolve(page, 'Choose 3 cantrips', 'Sacred Flame')
    await selectBuilderMultiOptionAndResolve(page, 'Choose 3 cantrips', 'Thaumaturgy')

    await completeAcolyteBackground(page)
    await completeStandardAbilitiesAndHitPoints(page)

    const equipmentDefaultsResolvePromise = waitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      { method: 'POST' }
    )
    await goToBuilderStep(page, 'Equipment & Currency')
    await equipmentDefaultsResolvePromise
    await selectBuilderOptionAtIndexAndResolve(page, /^Option$/, 0, '1 Mace')
    await selectBuilderOptionAtIndexAndResolve(page, /^Option$/, 1, '1 Chain Mail')
    await selectBuilderOptionAtIndexAndResolve(
      page,
      /^Option$/,
      2,
      '1 Light Crossbow + 1 Crossbow Bolts (20)'
    )
    await selectBuilderOptionAtIndexAndResolve(page, /^Option$/, 3, "1 Priest's Pack")
    await selectBuilderOptionAndResolve(page, /^Choose 1 shield$/i, 'Shield')
    await selectBuilderOptionAndResolve(page, /^Choose 1 Holy Symbol/, 'Holy Symbol: Amulet')
    await selectBuilderOptionAndResolve(
      page,
      /^Choose 1 Prayer Book or Prayer Wheel/,
      'Prayer Book'
    )

    await saveReloadPreviewAndFinalize(page, characterName, assertPersistedClericChoices)

    const sheetSnapshot = await readCoreSheetSnapshot(page)
    expect(sheetSnapshot.identity).toContain('Cleric (Life Domain) 1')
    expect(sheetSnapshot.identity).toContain('Human / Acolyte')
    expect(sheetSnapshot.identity).toMatch(/\bLevel 1\b/i)

    await page.getByRole('tab', { name: 'Spells', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Spells', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()

    const manageSpellsDrawer = page.getByRole('dialog', { name: 'Manage Spells' })
    const healingWordRow = getSheetDetailRow(manageSpellsDrawer, 'Healing Word')
    await expect(healingWordRow.getByRole('button', { name: 'Prepare', exact: true })).toBeVisible()
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.command',
      async () => healingWordRow.getByRole('button', { name: 'Prepare', exact: true }).click(),
      { method: 'POST' }
    )
    await expect(
      healingWordRow.getByRole('button', { name: 'Unprepare', exact: true })
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(manageSpellsDrawer).toBeHidden()

    const spellsPanel = page.getByRole('region', { name: 'Spells', exact: true })
    await expect(
      spellsPanel.getByRole('button', { name: 'Level 1: 2 of 2 remaining', exact: true })
    ).toBeVisible()
    const preparedHealingWordRow = getSheetDetailRow(spellsPanel, 'Healing Word')
    await expect(preparedHealingWordRow.getByText('Prepared', { exact: true })).toBeVisible()
    await preparedHealingWordRow.getByRole('button', { name: 'Cast', exact: true }).click()

    const castHealingWordDrawer = page.getByRole('dialog', { name: 'Cast Healing Word' })
    await expect(castHealingWordDrawer.getByLabel('Cast using')).not.toHaveValue('')
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.command',
      async () =>
        castHealingWordDrawer
          .getByRole('button', { name: 'Cast Healing Word', exact: true })
          .click(),
      { method: 'POST' }
    )
    await page.keyboard.press('Escape')
    await expect(castHealingWordDrawer).toBeHidden()
    await expect(
      spellsPanel.getByRole('button', { name: 'Level 1: 1 of 2 remaining', exact: true })
    ).toBeVisible()

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible({ timeout: 120_000 })
    await page.getByRole('tab', { name: 'Spells', exact: true }).click()
    const reloadedSpellsPanel = page.getByRole('region', { name: 'Spells', exact: true })
    await expect(
      reloadedSpellsPanel.getByRole('button', {
        name: 'Level 1: 1 of 2 remaining',
        exact: true
      })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
    await expect(
      getSheetDetailRow(
        page.getByRole('dialog', { name: 'Manage Spells' }),
        'Healing Word'
      ).getByRole('button', { name: 'Unprepare', exact: true })
    ).toBeVisible()
  })

  test('creates, reloads, and finalizes a choice-heavy Dragonborn Champion', async ({
    authenticatedPage: page
  }) => {
    test.setTimeout(900_000)
    const characterName = `MVP Choice Heavy ${Date.now()}`

    await startNewCharacter(page, characterName)

    await goToBuilderStep(page, 'Race')
    await selectBuilderOptionAndResolve(page, 'Race', 'Dragonborn')
    await selectBuilderOptionAndResolve(page, 'Draconic Ancestry option', 'Red (Fire)')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderOption(page, 'Add Class', 'Fighter')
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByRole('button', { name: 'Add Class', exact: true }).click(),
      { method: 'POST' }
    )
    await runAndWaitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      async () => page.getByLabel('Class Level').fill('3'),
      { method: 'POST' }
    )
    await selectBuilderOptionAndResolve(page, 'Subclass', 'Champion')
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies 1 of 2/, 'Athletics')
    await selectBuilderOptionAndResolve(page, /^Skill Proficiencies 2 of 2/, 'Perception')
    await selectBuilderOptionAndResolve(page, /^Fighting Style choice/, 'Defense')

    await completeAcolyteBackground(page)
    await completeStandardAbilitiesAndHitPoints(page)

    const equipmentDefaultsResolvePromise = waitForSuccessfulTrpcProcedure(
      page,
      'characters.resolve',
      { method: 'POST' }
    )
    await goToBuilderStep(page, 'Equipment & Currency')
    await equipmentDefaultsResolvePromise
    await completeFighterAndAcolyteEquipment(page)

    await saveReloadPreviewAndFinalize(
      page,
      characterName,
      assertPersistedDragonbornChampionChoices
    )

    const sheetSnapshot = await readCoreSheetSnapshot(page)
    expect(sheetSnapshot.identity).toContain('Fighter (Champion) 3')
    expect(sheetSnapshot.identity).toContain('Dragonborn / Acolyte')
    expect(sheetSnapshot.identity).toMatch(/\bLevel 3\b/i)

    await page.getByRole('tab', { name: 'Features & Traits', exact: true }).click()
    const featuresPanel = page.getByRole('region', { name: 'Features', exact: true })
    await expect(featuresPanel.getByText('Improved Critical', { exact: true })).toBeVisible()
    await expect(featuresPanel.getByText('Breath Weapon', { exact: true })).toBeVisible()
  })
})

async function startNewCharacter(page: Page, characterName: string): Promise<void> {
  await page.goto('/characters/new', { waitUntil: 'domcontentloaded' })
  await expectBuilderReady(page)
  await expect(page.getByLabel('Character Name')).toBeVisible()
  await page.getByLabel('Character Name').fill(characterName)
}

async function expectBuilderReady(page: Page): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Authoring steps' })
  const buttons = navigation.getByRole('button')

  await expect(buttons.filter({ hasText: /^Basics$/ })).toHaveCount(1, {
    timeout: 60_000
  })
  await expect(buttons.filter({ hasText: /^Review$/ })).toHaveCount(1, {
    timeout: 60_000
  })
}

async function completeAcolyteBackground(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Background')
  await selectBuilderOptionAndResolve(page, 'Background', 'Acolyte')
  await selectBuilderOptionAndResolve(page, /^Languages 1 of 2/, 'Celestial')
  await selectBuilderOptionAndResolve(page, /^Languages 2 of 2/, 'Infernal')
}

async function completeStandardAbilitiesAndHitPoints(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Abilities & HP')
  await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue('Standard Array')
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => page.getByRole('button', { name: 'Fill Six Abilities' }).click(),
    { method: 'POST' }
  )
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => page.getByRole('button', { name: 'Add Missing Levels' }).click(),
    { method: 'POST' }
  )
}

async function completeFighterAndAcolyteEquipment(page: Page): Promise<void> {
  await expect(page.getByRole('combobox', { name: /^Option$/ })).toHaveCount(4)
  await selectBuilderOptionAtIndexAndResolve(page, /^Option$/, 0, '1 Chain Mail')
  await selectBuilderOptionAtIndexAndResolve(
    page,
    /^Option$/,
    1,
    'Choose 1 martial weapon + Choose 1 shield'
  )
  await selectBuilderOptionAtIndexAndResolve(
    page,
    /^Option$/,
    2,
    '1 Light Crossbow + 1 Crossbow Bolts (20)'
  )
  await selectBuilderOptionAtIndexAndResolve(page, /^Option$/, 3, "1 Explorer's Pack")
  await selectBuilderOptionAndResolve(page, /^Choose 1 martial weapon$/i, 'Longsword')
  await selectBuilderOptionAndResolve(page, /^Choose 1 shield$/i, 'Shield')
  await selectBuilderOptionAndResolve(
    page,
    /^Choose 1 Prayer Book or Prayer Wheel/,
    'Prayer Book'
  )
}

async function saveReloadPreviewAndFinalize(
  page: Page,
  characterName: string,
  assertPersistedChoices: (page: Page) => Promise<void>
): Promise<void> {
  await goToBuilderStep(page, 'Review')
  await expect(page.getByText('Ready to finalize', { exact: true })).toBeVisible()

  const editRedirectPromise = page.waitForURL(/\/characters\/[^/]+\/[^/]+\/edit$/)
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.saveDraft',
    async () => page.getByRole('button', { name: 'Save Draft', exact: true }).click(),
    { method: 'POST' }
  )
  await editRedirectPromise
  expect(new URL(page.url()).pathname).toMatch(/^\/characters\/[^/]+\/[^/]+\/edit$/)

  await page.reload({ waitUntil: 'networkidle' })
  await expectBuilderReady(page)
  await goToBuilderStep(page, 'Basics')
  await expect(page.getByLabel('Character Name')).toHaveValue(characterName)
  await assertPersistedChoices(page)

  await goToBuilderStep(page, 'Review')
  await expect(page.getByText('Ready to finalize', { exact: true })).toBeVisible()
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.previewSave',
    async () => page.getByRole('button', { name: 'Finalize Character' }).click(),
    { method: 'POST', timeout: 120_000 }
  )
  await expect(page.getByRole('dialog', { name: 'Finalize Character' })).toBeVisible()

  const sheetResponsePromise = waitForSuccessfulTrpcBatch(
    page,
    ['characters.sheet', 'characters.getDraft'],
    { method: 'GET', timeout: 120_000 }
  )
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.upsert',
    async () =>
      page
        .getByRole('dialog', { name: 'Finalize Character' })
        .getByRole('button', { name: 'Finalize', exact: true })
        .click(),
    { method: 'POST', timeout: 60_000 }
  )
  await sheetResponsePromise
  await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: characterName, exact: true })).toBeVisible()
}

async function assertPersistedClericChoices(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Race')
  await expect(page.getByRole('combobox', { name: 'Race' })).toHaveValue('Human')
  await expect(page.getByRole('combobox', { name: /^Languages/ })).toHaveValue('Dwarvish')

  await goToBuilderStep(page, 'Classes')
  await expect(page.getByRole('combobox', { name: 'Class', exact: true })).toHaveValue('Cleric')
  await expect(page.getByRole('combobox', { name: 'Subclass', exact: true })).toHaveValue(
    'Life Domain'
  )
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies 1 of 2/ })).toHaveValue(
    'History'
  )
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies 2 of 2/ })).toHaveValue(
    'Insight'
  )
  const formContent = page.getByTestId('authoring-form-content')
  await expect(formContent.getByText('Guidance', { exact: true })).toBeVisible()
  await expect(formContent.getByText('Sacred Flame', { exact: true })).toBeVisible()
  await expect(formContent.getByText('Thaumaturgy', { exact: true })).toBeVisible()

  await assertPersistedAcolyteAndAbilities(page, 1)

  await goToBuilderStep(page, 'Equipment & Currency')
  await expect(page.getByRole('combobox', { name: /^Option$/ })).toHaveCount(4)
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(0)).toHaveValue('1 Mace')
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(1)).toHaveValue(
    '1 Chain Mail'
  )
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(2)).toHaveValue(
    '1 Light Crossbow + 1 Crossbow Bolts (20)'
  )
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(3)).toHaveValue(
    "1 Priest's Pack"
  )
  await expect(page.getByRole('combobox', { name: /^Choose 1 shield$/i })).toHaveValue('Shield')
  await expect(page.getByRole('combobox', { name: /^Choose 1 Holy Symbol/ })).toHaveValue(
    'Holy Symbol: Amulet'
  )
  await expect(
    page.getByRole('combobox', { name: /^Choose 1 Prayer Book or Prayer Wheel/ })
  ).toHaveValue('Prayer Book')
}

async function assertPersistedDragonbornChampionChoices(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Race')
  await expect(page.getByRole('combobox', { name: 'Race' })).toHaveValue('Dragonborn')
  await expect(page.getByRole('combobox', { name: 'Draconic Ancestry option' })).toHaveValue(
    'Red (Fire)'
  )

  await goToBuilderStep(page, 'Classes')
  await expect(page.getByRole('combobox', { name: 'Class', exact: true })).toHaveValue('Fighter')
  await expect(page.getByLabel('Class Level')).toHaveValue('3')
  await expect(page.getByRole('combobox', { name: 'Subclass', exact: true })).toHaveValue(
    'Champion'
  )
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies 1 of 2/ })).toHaveValue(
    'Athletics'
  )
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies 2 of 2/ })).toHaveValue(
    'Perception'
  )
  await expect(page.getByRole('combobox', { name: /^Fighting Style choice/ })).toHaveValue(
    'Defense'
  )

  await assertPersistedAcolyteAndAbilities(page, 3)

  await assertPersistedFighterAndAcolyteEquipment(page)
}

async function assertPersistedAcolyteAndAbilities(page: Page, level: number): Promise<void> {
  await goToBuilderStep(page, 'Background')
  await expect(page.getByRole('combobox', { name: 'Background', exact: true })).toHaveValue(
    'Acolyte'
  )
  await expect(page.getByRole('combobox', { name: /^Languages 1 of 2/ })).toHaveValue('Celestial')
  await expect(page.getByRole('combobox', { name: /^Languages 2 of 2/ })).toHaveValue('Infernal')

  await goToBuilderStep(page, 'Abilities & HP')
  await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue('Standard Array')
  await expect(page.getByRole('combobox', { name: 'Ability', exact: true })).toHaveCount(6)
  const characterLevelInputs = page.getByLabel('Character Level', { exact: true })
  const fixedHitPointInputs = page.getByLabel('Fixed HP Total', { exact: true })
  await expect(characterLevelInputs).toHaveCount(level)
  await expect(fixedHitPointInputs).toHaveCount(level)
  for (let index = 0; index < level; index += 1) {
    await expect(characterLevelInputs.nth(index)).toHaveValue(String(index + 1))
    await expect(fixedHitPointInputs.nth(index)).not.toHaveValue('')
  }
}

function getSheetDetailRow(scope: Locator, label: string): Locator {
  return scope.getByRole('group', { name: label, exact: true })
}

type HitPointProgressionRow = {
  characterLevel: string
  classProgression: string
  fixedTotal: string
}

async function assertPersistedMulticlassChoices(
  page: Page,
  expectedHitPointProgression: HitPointProgressionRow[]
): Promise<void> {
  await goToBuilderStep(page, 'Race')
  await expect(page.getByRole('combobox', { name: 'Race' })).toHaveValue('Human')
  await expect(page.getByRole('combobox', { name: /^Languages/ })).toHaveValue('Dwarvish')

  await goToBuilderStep(page, 'Classes')
  const classInputs = page.getByRole('combobox', { name: 'Class', exact: true })
  const classLevelInputs = page.getByLabel('Class Level', { exact: true })
  await expect(classInputs).toHaveCount(2)
  await expect(classInputs.nth(0)).toHaveValue('Fighter')
  await expect(classInputs.nth(1)).toHaveValue('Rogue')
  await expect(classLevelInputs).toHaveCount(2)
  await expect(classLevelInputs.nth(0)).toHaveValue('2')
  await expect(classLevelInputs.nth(1)).toHaveValue('1')
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies 1 of 2/ })).toHaveValue(
    'Athletics'
  )
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies 2 of 2/ })).toHaveValue(
    'Perception'
  )
  await expect(page.getByRole('combobox', { name: /^Fighting Style choice/ })).toHaveValue(
    'Defense'
  )
  await expect(page.getByRole('combobox', { name: /^Skill Proficiencies$/ })).toHaveValue(
    'Stealth'
  )

  await goToBuilderStep(page, 'Background')
  await expect(page.getByRole('combobox', { name: 'Background', exact: true })).toHaveValue(
    'Acolyte'
  )
  await expect(page.getByRole('combobox', { name: /^Languages 1 of 2/ })).toHaveValue('Celestial')
  await expect(page.getByRole('combobox', { name: /^Languages 2 of 2/ })).toHaveValue('Infernal')

  await goToBuilderStep(page, 'Abilities & HP')
  await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue('Standard Array')
  await expect(page.getByRole('combobox', { name: 'Ability', exact: true })).toHaveCount(6)
  expect(await readHitPointProgression(page)).toEqual(expectedHitPointProgression)

  await assertPersistedFighterAndAcolyteEquipment(page)
}

async function assertPersistedFighterAndAcolyteEquipment(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Equipment & Currency')
  await expect(page.getByRole('combobox', { name: /^Option$/ })).toHaveCount(4)
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(0)).toHaveValue('1 Chain Mail')
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(1)).toHaveValue(
    'Choose 1 martial weapon + Choose 1 shield'
  )
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(2)).toHaveValue(
    '1 Light Crossbow + 1 Crossbow Bolts (20)'
  )
  await expect(page.getByRole('combobox', { name: /^Option$/ }).nth(3)).toHaveValue(
    "1 Explorer's Pack"
  )
  await expect(page.getByRole('combobox', { name: /^Choose 1 martial weapon$/i })).toHaveValue(
    'Longsword'
  )
  await expect(page.getByRole('combobox', { name: /^Choose 1 shield$/i })).toHaveValue('Shield')
  await expect(
    page.getByRole('combobox', { name: /^Choose 1 Prayer Book or Prayer Wheel/ })
  ).toHaveValue('Prayer Book')
}

async function readHitPointProgression(page: Page): Promise<HitPointProgressionRow[]> {
  const hitPointSection = page.getByRole('region', { name: 'Abilities & hit points' })
  const classProgressions = hitPointSection.getByText(/^(?:Fighter|Rogue) [12]$/)
  const characterLevels = hitPointSection.getByLabel('Character Level', { exact: true })
  const fixedTotals = hitPointSection.getByLabel('Fixed HP Total', { exact: true })

  await expect(classProgressions).toHaveCount(3)
  await expect(characterLevels).toHaveCount(3)
  await expect(fixedTotals).toHaveCount(3)

  return await Promise.all(
    Array.from({ length: 3 }, async (_, index) => ({
      characterLevel: await characterLevels.nth(index).inputValue(),
      classProgression: (await classProgressions.nth(index).innerText()).trim(),
      fixedTotal: await fixedTotals.nth(index).inputValue()
    }))
  )
}

async function readCoreSheetSnapshot(page: Page): Promise<{
  abilities: string
  identity: string
  vitals: string
}> {
  return {
    abilities: normalizeText(await page.getByLabel('Ability scores').innerText()),
    identity: normalizeText(
      await page.locator('header').filter({ hasText: 'Character Sheet' }).innerText()
    ),
    vitals: normalizeText(
      await page
        .getByRole('heading', { name: 'Combat facts and hit points' })
        .locator('..')
        .innerText()
    )
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function readHitPointPair(vitals: string): { current: number, maximum: number } {
  const match = /\bHP\s+(\d+)\s*\/\s*(\d+)\b/i.exec(vitals)
  const current = match?.[1]
  const maximum = match?.[2]
  if (!current || !maximum) {
    throw new Error(`Unable to read hit points from: ${vitals}`)
  }

  return { current: Number(current), maximum: Number(maximum) }
}
