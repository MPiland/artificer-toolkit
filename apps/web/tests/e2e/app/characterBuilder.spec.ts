import { test, expect } from './support/auth.fixture'
import type { Locator, Page } from '@playwright/test'
import type { E2ECharacterCleanup } from './support/characterCleanup'
import {
  expectBuilderClassProficiencyValues,
  expectBuilderGrantChoiceValues,
  goToBuilderStep,
  selectBuilderCatalogOptionAndResolve,
  selectBuilderClassProficiencyAndResolve,
  selectBuilderGrantChoiceAndResolve,
  selectBuilderOption,
  selectBuilderOptionAtIndexAndResolve,
  selectBuilderOptionAndResolve,
  selectBuilderSpellChoiceAndResolve,
  waitForBuilderResolution
} from './support/characterBuilder'
import {
  recordBuilderEditPhase,
  recordConvexTraffic,
  type ConvexCall
} from './support/convexTraffic'

test.describe('MVP character Builder to Sheet', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates, drafts, reloads, previews, and finalizes a Human Fighter Rogue', async ({
    authenticatedPage: page,
    characterCleanup
  }) => {
    test.setTimeout(900_000)
    const characterName = `MVP Martial Multiclass ${Date.now()}`
    characterCleanup.trackLabel(characterName)

    const editPhase = await startNewCharacter(
      page,
      { name: 'Human Fighter Rogue', classCount: 2 },
      characterName,
      characterCleanup
    )

    await goToBuilderStep(page, 'Race')
    await selectBuilderCatalogOptionAndResolve(page, 'Choose Race', 'Choose a race', 'Human')
    await selectBuilderGrantChoiceAndResolve(page, 'Extra Language', 'Dwarvish')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderCatalogOptionAndResolve(page, 'Add Class', 'Choose a class', 'Fighter')
    await page.getByRole('textbox', { name: 'Fighter level' }).fill('2')
    await waitForBuilderResolution(page)
    await selectBuilderClassProficiencyAndResolve(page, 'Athletics')
    await selectBuilderClassProficiencyAndResolve(page, 'Perception')
    await selectBuilderGrantChoiceAndResolve(page, 'Fighting Style', 'Defense')

    await goToBuilderStep(page, 'Background')
    await selectBuilderCatalogOptionAndResolve(
      page,
      'Choose Background',
      'Choose a background',
      'Acolyte'
    )
    await selectBuilderGrantChoiceAndResolve(page, 'Languages', 'Celestial')
    await selectBuilderGrantChoiceAndResolve(page, 'Languages', 'Infernal')

    await goToBuilderStep(page, 'Abilities & HP')
    await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue(
      'Standard Array'
    )
    await completeStandardAbilityAssignments(page, MARTIAL_STANDARD_ABILITY_ASSIGNMENTS)

    await goToBuilderStep(page, 'Classes')
    await selectBuilderCatalogOptionAndResolve(page, 'Add Class', 'Choose a class', 'Rogue')
    await selectBuilderClassProficiencyAndResolve(page, 'Stealth', 1)
    await selectBuilderGrantChoiceAndResolve(page, 'Expertise', 'Athletics')
    await selectBuilderGrantChoiceAndResolve(page, 'Expertise', 'Perception')

    await goToBuilderStep(page, 'Abilities & HP')
    expect((await readHitPointProgression(page)).map((row) => row.classProgression)).toEqual([
      'Fighter 1',
      'Fighter 2',
      'Rogue 1'
    ])
    const expectedHitPointProgression = await readHitPointProgression(page)
    expect(expectedHitPointProgression.map((row) => row.classProgression)).toEqual([
      'Fighter 1',
      'Fighter 2',
      'Rogue 1'
    ])

    await goToBuilderStep(page, 'Equipment & Currency')
    await completeFighterAndAcolyteEquipment(page)

    await goToBuilderStep(page, 'Review')
    await expect(page.getByText('Ready to activate', { exact: true })).toBeVisible()

    const concept = `${characterName} concept`
    await saveDraftWithConcept(page, concept, editPhase)
    characterCleanup.captureRoute(page)
    await expectBuilderReady(page)

    await page.waitForLoadState('networkidle')
    await page.reload({ waitUntil: 'networkidle' })
    await expectBuilderReady(page)
    await goToBuilderStep(page, 'Basics')
    await expect(page.getByLabel('Character Name')).toHaveValue(characterName)
    await expect(page.getByLabel('Concept', { exact: true })).toHaveText(concept)
    await assertPersistedMulticlassChoices(page, expectedHitPointProgression)
    await goToBuilderStep(page, 'Review')
    await expect(page.getByText('Ready to activate', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Finalize Character' })).toBeVisible()

    await page
      .getByRole('dialog', { name: 'Finalize Character' })
      .getByRole('button', { name: 'Finalize', exact: true })
      .click()
    await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible({
      timeout: 120_000
    })
    await expect(page.getByRole('heading', { name: characterName, exact: true })).toBeVisible()

    const beforeReload = await readCoreSheetSnapshot(page)
    expect(beforeReload.identity).toContain('Fighter 2 / Rogue 1')
    expect(beforeReload.identity).toContain('Human / Acolyte')
    expect(beforeReload.identity).not.toMatch(/\bLevel 3\b/i)
    expect(beforeReload.vitals).toMatch(/\bProficiency \+2\b/i)
    const hitPoints = readHitPointPair(beforeReload.vitals)
    expect(hitPoints.current).toBe(hitPoints.maximum)
    expect(beforeReload.vitals).toMatch(/\bHit Dice\s+2\/2d10, 1\/1d8\b/i)
    expect(beforeReload.abilities).toContain('STR')
    expect(beforeReload.abilities).toContain('CHA')

    await page.waitForLoadState('networkidle')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: characterName, exact: true })).toBeVisible({
      timeout: 120_000
    })
    expect(await readCoreSheetSnapshot(page)).toEqual(beforeReload)
  })

  test('creates and finalizes a Human Life Cleric, then persists preparation and slot usage', async ({
    authenticatedPage: page,
    characterCleanup
  }) => {
    test.setTimeout(900_000)
    const characterName = `MVP Prepared ${Date.now()}`
    characterCleanup.trackLabel(characterName)

    const editPhase = await startNewCharacter(
      page,
      { name: 'Human Life Cleric', classCount: 1 },
      characterName,
      characterCleanup
    )

    await goToBuilderStep(page, 'Race')
    await selectBuilderCatalogOptionAndResolve(page, 'Choose Race', 'Choose a race', 'Human')
    await selectBuilderGrantChoiceAndResolve(page, 'Extra Language', 'Dwarvish')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderCatalogOptionAndResolve(page, 'Add Class', 'Choose a class', 'Cleric')
    await selectBuilderOptionAndResolve(page, 'Subclass', 'Life Domain')
    await selectBuilderClassProficiencyAndResolve(page, 'History')
    await selectBuilderClassProficiencyAndResolve(page, 'Medicine')
    await page.getByRole('tab', { name: 'Spells', exact: true }).click()
    await selectBuilderSpellChoiceAndResolve(page, 'Cantrips', 'Guidance')
    await selectBuilderSpellChoiceAndResolve(page, 'Cantrips', 'Sacred Flame')
    await selectBuilderSpellChoiceAndResolve(page, 'Cantrips', 'Thaumaturgy')

    await completeAcolyteBackground(page)
    await completeStandardAbilitiesAndHitPoints(page)

    await goToBuilderStep(page, 'Equipment & Currency')
    await selectBuilderOptionAtIndexAndResolve(page, 'Choose one', 0, 'Mace')
    await selectBuilderOptionAtIndexAndResolve(page, 'Choose one', 1, 'Chain Mail')
    await selectBuilderOptionAtIndexAndResolve(
      page,
      'Choose one',
      2,
      'Light Crossbow and Crossbow Bolts (20)'
    )
    await selectBuilderOptionAtIndexAndResolve(page, 'Choose one', 3, "Priest's Pack")
    await selectBuilderOptionAndResolve(page, /^Choose 1 shield$/i, 'Shield')
    await selectBuilderOptionAndResolve(page, /^Choose 1 Holy Symbol/, 'Holy Symbol: Amulet')
    await selectBuilderOptionAndResolve(
      page,
      /^Choose 1 Prayer Book or Prayer Wheel/,
      'Prayer Book'
    )

    await saveReloadPreviewAndFinalize(
      page,
      characterName,
      characterCleanup,
      assertPersistedClericChoices,
      editPhase
    )

    const sheetSnapshot = await readCoreSheetSnapshot(page)
    expect(sheetSnapshot.identity).toContain('Cleric (Life Domain) 1')
    expect(sheetSnapshot.identity).toContain('Human / Acolyte')
    expect(sheetSnapshot.identity).not.toMatch(/\bLevel 1\b/i)

    await page.getByRole('tab', { name: 'Spells', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Spells', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()

    const manageSpellsDrawer = page.getByRole('dialog', {
      name: 'Manage Spells'
    })
    const healingWordRow = getSheetDetailRow(manageSpellsDrawer, 'Healing Word')
    await expect
      .poll(
        async () => {
          if (await healingWordRow.isVisible()) return true
          await manageSpellsDrawer.evaluate((element) => {
            element.scrollTop += element.clientHeight || 400
          })
          return false
        },
        { timeout: 20_000, message: 'Scroll the virtual preparation picker to Healing Word' }
      )
      .toBe(true)
    await expect(healingWordRow.getByRole('button', { name: 'Prepare', exact: true })).toBeVisible()
    await healingWordRow.getByRole('button', { name: 'Prepare', exact: true }).click()
    await expect(
      healingWordRow.getByRole('button', { name: 'Unprepare', exact: true })
    ).toBeVisible()
    await expect(
      healingWordRow.getByRole('button', { name: 'Unprepare', exact: true })
    ).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(manageSpellsDrawer).toBeHidden()

    const spellsPanel = page.getByRole('region', {
      name: 'Spells',
      exact: true
    })
    await expect(
      spellsPanel.getByRole('button', {
        name: 'Level 1: 2 of 2 remaining',
        exact: true
      })
    ).toBeVisible()
    const preparedHealingWordRow = spellsPanel.getByRole('group', {
      name: 'Healing Word from Cleric at level 1',
      exact: true
    })
    await expect(preparedHealingWordRow).toBeVisible()
    await preparedHealingWordRow
      .getByRole('button', {
        name: 'Cast Healing Word from Cleric at level 1',
        exact: true
      })
      .click()
    await expect(
      spellsPanel.getByRole('button', {
        name: 'Level 1: 1 of 2 remaining',
        exact: true
      })
    ).toBeVisible()

    // The slot count is optimistic; networkidle does not await the Convex WebSocket mutation.
    await expect(
      spellsPanel.getByRole('button', {
        name: 'Cast Healing Word from Cleric at level 1',
        exact: true
      })
    ).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible({
      timeout: 120_000
    })
    await page.getByRole('tab', { name: 'Spells', exact: true }).click()
    const reloadedSpellsPanel = page.getByRole('region', {
      name: 'Spells',
      exact: true
    })
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
    authenticatedPage: page,
    characterCleanup
  }) => {
    test.setTimeout(900_000)
    const characterName = `MVP Choice Heavy ${Date.now()}`
    characterCleanup.trackLabel(characterName)

    const editPhase = await startNewCharacter(
      page,
      { name: 'Dragonborn Champion', classCount: 1 },
      characterName,
      characterCleanup
    )

    await goToBuilderStep(page, 'Race')
    await selectBuilderCatalogOptionAndResolve(page, 'Choose Race', 'Choose a race', 'Dragonborn')
    await selectBuilderOptionAndResolve(page, 'Draconic Ancestry option', 'Red (Fire)')

    await goToBuilderStep(page, 'Classes')
    await selectBuilderCatalogOptionAndResolve(page, 'Add Class', 'Choose a class', 'Fighter')
    await page.getByRole('textbox', { name: 'Fighter level' }).fill('3')
    await waitForBuilderResolution(page)
    await selectBuilderOptionAndResolve(page, 'Subclass', 'Champion')
    await selectBuilderClassProficiencyAndResolve(page, 'Athletics')
    await selectBuilderClassProficiencyAndResolve(page, 'Perception')
    await selectBuilderGrantChoiceAndResolve(page, 'Fighting Style', 'Defense')

    await completeAcolyteBackground(page)
    await completeStandardAbilitiesAndHitPoints(page)

    await goToBuilderStep(page, 'Equipment & Currency')
    await completeFighterAndAcolyteEquipment(page)

    await saveReloadPreviewAndFinalize(
      page,
      characterName,
      characterCleanup,
      assertPersistedDragonbornChampionChoices,
      editPhase
    )

    const sheetSnapshot = await readCoreSheetSnapshot(page)
    expect(sheetSnapshot.identity).toContain('Fighter (Champion) 3')
    expect(sheetSnapshot.identity).toContain('Dragonborn / Acolyte')
    expect(sheetSnapshot.identity).not.toMatch(/\bLevel 3\b/i)

    await page.getByRole('tab', { name: 'Features', exact: true }).click()
    const featuresPanel = page.getByRole('region', {
      name: 'Features',
      exact: true
    })
    await expect(featuresPanel.getByText('Improved Critical', { exact: true })).toBeVisible()
    await expect(featuresPanel.getByText('Breath Weapon', { exact: true })).toBeVisible()
  })
})

type BuilderEditPhase = {
  /** The commit budget grows with distinct Classes (D84). */
  journey: { name: string; classCount: number }
  calls: ConvexCall[]
  startIndex: number
  startedAt: number
}

async function startNewCharacter(
  page: Page,
  journey: BuilderEditPhase['journey'],
  characterName: string,
  characterCleanup: E2ECharacterCleanup
): Promise<BuilderEditPhase> {
  const calls = recordConvexTraffic(page)
  await page.goto('/characters/new', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/characters\/[^/]+\/[^/]+\/edit(\?|$)/, { timeout: 60_000 })
  characterCleanup.captureRoute(page)
  await expectBuilderReady(page)
  await expect(page.getByLabel('Character Name')).toBeVisible()
  await page.getByLabel('Character Name').fill(characterName)
  return { journey, calls, startIndex: calls.length, startedAt: Date.now() }
}

async function expectBuilderReady(page: Page): Promise<void> {
  await expect(page.locator('#character-builder-active-step-title')).toBeVisible({
    timeout: 60_000
  })
  const navigation = page.getByRole('navigation', { name: 'Authoring steps' })
  const links = navigation.getByRole('link')

  await expect(links.filter({ hasText: /^Basics$/ })).toHaveCount(1, {
    timeout: 60_000
  })
  await expect(links.filter({ hasText: /^Review$/ })).toHaveCount(1, {
    timeout: 60_000
  })
}

async function completeAcolyteBackground(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Background')
  await selectBuilderCatalogOptionAndResolve(
    page,
    'Choose Background',
    'Choose a background',
    'Acolyte'
  )
  await selectBuilderGrantChoiceAndResolve(page, 'Languages', 'Celestial')
  await selectBuilderGrantChoiceAndResolve(page, 'Languages', 'Infernal')
}

async function completeStandardAbilitiesAndHitPoints(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Abilities & HP')
  await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue('Standard Array')
  await completeStandardAbilityAssignments(page, DEFAULT_STANDARD_ABILITY_ASSIGNMENTS)
}

type StandardAbilityAssignment = {
  ability: string
  score: string
}

const DEFAULT_STANDARD_ABILITY_ASSIGNMENTS: StandardAbilityAssignment[] = [
  { ability: 'Strength', score: '15' },
  { ability: 'Dexterity', score: '14' },
  { ability: 'Constitution', score: '13' },
  { ability: 'Intelligence', score: '12' },
  { ability: 'Wisdom', score: '10' },
  { ability: 'Charisma', score: '8' }
]

const MARTIAL_STANDARD_ABILITY_ASSIGNMENTS: StandardAbilityAssignment[] = [
  { ability: 'Strength', score: '15' },
  { ability: 'Dexterity', score: '13' },
  { ability: 'Constitution', score: '14' },
  { ability: 'Intelligence', score: '10' },
  { ability: 'Wisdom', score: '12' },
  { ability: 'Charisma', score: '8' }
]

async function completeStandardAbilityAssignments(
  page: Page,
  assignments: StandardAbilityAssignment[]
): Promise<void> {
  expect(assignments).toHaveLength(6)
  for (const [index, assignment] of assignments.entries()) {
    await selectBuilderOption(page, `Score for assignment ${index + 1}`, assignment.score)
    await selectBuilderOptionAndResolve(
      page,
      `Ability for assignment ${index + 1}`,
      assignment.ability
    )
  }
}

async function completeFighterAndAcolyteEquipment(page: Page): Promise<void> {
  await expect(page.getByRole('combobox', { name: 'Choose one', exact: true })).toHaveCount(4)
  await selectBuilderOptionAtIndexAndResolve(page, 'Choose one', 0, 'Chain Mail')
  await selectBuilderOptionAtIndexAndResolve(
    page,
    'Choose one',
    1,
    'Choose 1 martial weapon and Choose 1 shield'
  )
  await selectBuilderOptionAtIndexAndResolve(
    page,
    'Choose one',
    2,
    'Light Crossbow and Crossbow Bolts (20)'
  )
  await selectBuilderOptionAtIndexAndResolve(page, 'Choose one', 3, "Explorer's Pack")
  await selectBuilderOptionAndResolve(page, /^Choose 1 martial weapon$/i, 'Longsword')
  await selectBuilderOptionAndResolve(page, /^Choose 1 shield$/i, 'Shield')
  await selectBuilderOptionAndResolve(page, /^Choose 1 Prayer Book or Prayer Wheel/, 'Prayer Book')
}

async function saveReloadPreviewAndFinalize(
  page: Page,
  characterName: string,
  characterCleanup: E2ECharacterCleanup,
  assertPersistedChoices: (page: Page) => Promise<void>,
  editPhase: BuilderEditPhase
): Promise<void> {
  await goToBuilderStep(page, 'Review')
  await expect(page.getByText('Ready to activate', { exact: true })).toBeVisible()

  const concept = `${characterName} concept`
  await saveDraftWithConcept(page, concept, editPhase)
  characterCleanup.captureRoute(page)

  await page.waitForLoadState('networkidle')
  await page.reload({ waitUntil: 'networkidle' })
  await expectBuilderReady(page)
  await goToBuilderStep(page, 'Basics')
  await expect(page.getByLabel('Character Name')).toHaveValue(characterName)
  await expect(page.getByLabel('Concept', { exact: true })).toHaveText(concept)
  await assertPersistedChoices(page)

  await goToBuilderStep(page, 'Review')
  await expect(page.getByText('Ready to activate', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Finalize Character' })).toBeVisible()

  await page
    .getByRole('dialog', { name: 'Finalize Character' })
    .getByRole('button', { name: 'Finalize', exact: true })
    .click()
  await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible({
    timeout: 120_000
  })
  await expect(page.getByRole('heading', { name: characterName, exact: true })).toBeVisible()
}

async function saveDraftWithConcept(
  page: Page,
  concept: string,
  editPhase: BuilderEditPhase
): Promise<void> {
  await goToBuilderStep(page, 'Basics')
  const saved = page.getByLabel('Saved', { exact: true })
  await expect(saved).toBeVisible({ timeout: 30_000 })
  const editPath = new URL(page.url()).pathname
  expect(editPath).toMatch(/^\/characters\/[^/]+\/[^/]+\/edit$/)
  await page.getByLabel('Concept', { exact: true }).fill(concept)
  await recordBuilderEditPhase(editPhase.journey, {
    calls: editPhase.calls.slice(editPhase.startIndex),
    startedAt: editPhase.startedAt
  })
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click({ timeout: 10_000 })
  await expect(saved).toBeVisible({ timeout: 30_000 })
  expect(new URL(page.url()).pathname).toBe(editPath)
}

async function assertPersistedClericChoices(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Race')
  await expect(page.getByRole('heading', { level: 3, name: 'Human' })).toBeVisible()
  await expectBuilderGrantChoiceValues(page, 'Extra Language', ['Dwarvish'])

  await goToBuilderStep(page, 'Classes')
  await expect(page.getByRole('heading', { level: 3, name: 'Cleric' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Subclass', exact: true })).toHaveValue(
    'Life Domain'
  )
  await expectBuilderClassProficiencyValues(page, ['History', 'Medicine'])
  await page.getByRole('tab', { name: 'Spells', exact: true }).click()
  const cantrips = page.getByRole('region', { name: 'Cantrips', exact: true })
  await expect(cantrips.getByText('3 of 3 selected', { exact: true })).toBeVisible()
  const formContent = page.getByTestId('authoring-form-content')
  await expect(formContent.getByText('Guidance', { exact: true })).toBeVisible()
  await expect(formContent.getByText('Sacred Flame', { exact: true })).toBeVisible()
  await expect(formContent.getByText('Thaumaturgy', { exact: true })).toBeVisible()

  await assertPersistedAcolyteAndAbilities(page, 1)

  await goToBuilderStep(page, 'Equipment & Currency')
  const equipmentChoices = page.getByRole('combobox', {
    name: 'Choose one',
    exact: true
  })
  await expect(equipmentChoices).toHaveCount(4)
  await expect(equipmentChoices.nth(0)).toHaveValue('Mace')
  await expect(equipmentChoices.nth(1)).toHaveValue('Chain Mail')
  await expect(equipmentChoices.nth(2)).toHaveValue('Light Crossbow and Crossbow Bolts (20)')
  await expect(equipmentChoices.nth(3)).toHaveValue("Priest's Pack")
  await expect(page.getByRole('combobox', { name: /^Choose 1 shield$/i })).toHaveValue('Shield')
  await expect(page.getByRole('combobox', { name: /^Choose 1 Holy Symbol/ })).toHaveValue(
    'Holy Symbol: Amulet'
  )
  await expect(
    page.getByRole('combobox', {
      name: /^Choose 1 Prayer Book or Prayer Wheel/
    })
  ).toHaveValue('Prayer Book')
}

async function assertPersistedDragonbornChampionChoices(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Race')
  await expect(page.getByRole('heading', { level: 3, name: 'Dragonborn' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Draconic Ancestry option' })).toHaveValue(
    'Red (Fire)'
  )

  await goToBuilderStep(page, 'Classes')
  await expect(page.getByRole('heading', { level: 3, name: 'Fighter' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Fighter level' })).toHaveValue('3')
  await expect(page.getByRole('combobox', { name: 'Subclass', exact: true })).toHaveValue(
    'Champion'
  )
  await expectBuilderClassProficiencyValues(page, ['Athletics', 'Perception'])
  await expectBuilderGrantChoiceValues(page, 'Fighting Style', ['Defense'])

  await assertPersistedAcolyteAndAbilities(page, 3)

  await assertPersistedFighterAndAcolyteEquipment(page)
}

async function assertPersistedAcolyteAndAbilities(page: Page, level: number): Promise<void> {
  await goToBuilderStep(page, 'Background')
  await expect(page.getByRole('heading', { level: 3, name: 'Acolyte' })).toBeVisible()
  await expectBuilderGrantChoiceValues(page, 'Languages', ['Celestial', 'Infernal'])

  await goToBuilderStep(page, 'Abilities & HP')
  await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue('Standard Array')
  await expectStandardAbilityAssignments(page, DEFAULT_STANDARD_ABILITY_ASSIGNMENTS)
  const progression = getHitPointProgressionCells(page)
  await expect(progression.characterLevels).toHaveCount(level)
  await expect(progression.hitPointsGained).toHaveCount(level)
  for (let index = 0; index < level; index += 1) {
    await expect(progression.characterLevels.nth(index)).toHaveText(String(index + 1))
    await expect(progression.hitPointsGained.nth(index)).not.toHaveText('')
  }
}

function getSheetDetailRow(scope: Locator, label: string): Locator {
  return scope.getByRole('group', { name: label, exact: true })
}

type HitPointProgressionRow = {
  characterLevel: string
  classProgression: string
  hitPointsGained: string
}

async function assertPersistedMulticlassChoices(
  page: Page,
  expectedHitPointProgression: HitPointProgressionRow[]
): Promise<void> {
  await goToBuilderStep(page, 'Race')
  await expect(page.getByRole('heading', { level: 3, name: 'Human' })).toBeVisible()
  await expectBuilderGrantChoiceValues(page, 'Extra Language', ['Dwarvish'])

  await goToBuilderStep(page, 'Classes')
  await expect(page.getByRole('heading', { level: 3, name: 'Fighter' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Rogue' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Fighter level' })).toHaveValue('2')
  await expect(page.getByRole('textbox', { name: 'Rogue level' })).toHaveValue('1')
  await expectBuilderClassProficiencyValues(page, ['Athletics', 'Perception'])
  await expectBuilderGrantChoiceValues(page, 'Fighting Style', ['Defense'])
  await expectBuilderClassProficiencyValues(page, ['Stealth'], 1)
  await expectBuilderGrantChoiceValues(page, 'Expertise', ['Athletics', 'Perception'])

  await goToBuilderStep(page, 'Background')
  await expect(page.getByRole('heading', { level: 3, name: 'Acolyte' })).toBeVisible()
  await expectBuilderGrantChoiceValues(page, 'Languages', ['Celestial', 'Infernal'])

  await goToBuilderStep(page, 'Abilities & HP')
  await expect(page.getByRole('combobox', { name: 'Ability Method' })).toHaveValue('Standard Array')
  await expectStandardAbilityAssignments(page, MARTIAL_STANDARD_ABILITY_ASSIGNMENTS)
  expect(await readHitPointProgression(page)).toEqual(expectedHitPointProgression)

  await assertPersistedFighterAndAcolyteEquipment(page)
}

async function assertPersistedFighterAndAcolyteEquipment(page: Page): Promise<void> {
  await goToBuilderStep(page, 'Equipment & Currency')
  const equipmentChoices = page.getByRole('combobox', {
    name: 'Choose one',
    exact: true
  })
  await expect(equipmentChoices).toHaveCount(4)
  await expect(equipmentChoices.nth(0)).toHaveValue('Chain Mail')
  await expect(equipmentChoices.nth(1)).toHaveValue('Choose 1 martial weapon and Choose 1 shield')
  await expect(equipmentChoices.nth(2)).toHaveValue('Light Crossbow and Crossbow Bolts (20)')
  await expect(equipmentChoices.nth(3)).toHaveValue("Explorer's Pack")
  await expect(page.getByRole('combobox', { name: /^Choose 1 martial weapon$/i })).toHaveValue(
    'Longsword'
  )
  await expect(page.getByRole('combobox', { name: /^Choose 1 shield$/i })).toHaveValue('Shield')
  await expect(
    page.getByRole('combobox', {
      name: /^Choose 1 Prayer Book or Prayer Wheel/
    })
  ).toHaveValue('Prayer Book')
}

async function readHitPointProgression(page: Page): Promise<HitPointProgressionRow[]> {
  const progression = getHitPointProgressionCells(page)
  await expect(progression.classProgressions).toHaveCount(3)
  await expect(progression.characterLevels).toHaveCount(3)
  await expect(progression.hitPointsGained).toHaveCount(3)

  return await Promise.all(
    Array.from({ length: 3 }, async (_, index) => ({
      characterLevel: (await progression.characterLevels.nth(index).innerText()).trim(),
      classProgression: (await progression.classProgressions.nth(index).innerText()).trim(),
      hitPointsGained: (await progression.hitPointsGained.nth(index).innerText()).trim()
    }))
  )
}

function getHitPointProgressionCells(page: Page): {
  characterLevels: Locator
  classProgressions: Locator
  hitPointsGained: Locator
} {
  const table = page.getByTestId('authoring-form-content').getByRole('table')
  return {
    characterLevels: table.locator("td[data-label='Character level']"),
    classProgressions: table.locator("td[data-label='Class level']"),
    hitPointsGained: table.locator("td[data-label='HP gained']")
  }
}

async function expectStandardAbilityAssignments(
  page: Page,
  assignments: StandardAbilityAssignment[]
): Promise<void> {
  for (const [index, assignment] of assignments.entries()) {
    await expect(
      page.getByRole('combobox', {
        name: `Score for assignment ${index + 1}`,
        exact: true
      })
    ).toHaveValue(assignment.score)
    await expect(
      page.getByRole('combobox', {
        name: `Ability for assignment ${index + 1}`,
        exact: true
      })
    ).toHaveValue(assignment.ability)
  }
}

async function readCoreSheetSnapshot(page: Page): Promise<{
  abilities: string
  identity: string
  vitals: string
}> {
  return {
    abilities: normalizeText(await page.getByLabel('Ability scores').innerText()),
    identity: normalizeText(
      await page.getByRole('region', { name: 'Character identity', exact: true }).innerText()
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

function readHitPointPair(vitals: string): {
  current: number
  maximum: number
} {
  const match = /\bHP\s+(\d+)\s*\/\s*(\d+)\b/i.exec(vitals)
  const current = match?.[1]
  const maximum = match?.[2]
  if (!current || !maximum) {
    throw new Error(`Unable to read hit points from: ${vitals}`)
  }

  return { current: Number(current), maximum: Number(maximum) }
}
