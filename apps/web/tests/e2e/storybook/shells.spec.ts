import { expect, test, type Page } from '@playwright/test'

const storyExpect = expect.configure({ timeout: 20_000 })

test.describe.configure({ mode: 'serial' })

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`, { waitUntil: 'commit', timeout: 60_000 })
}

async function getGridColumnCount(page: Page) {
  return page.getByTestId('authored-list-card-row')
    .first()
    .evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    ))
}

function formStep(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Form sections' }).getByRole('button', { name, exact: true })
}

async function openCharacterSheetStory(page: Page, storyId: string) {
  await openStory(page, storyId)
  await expect(page.getByRole('tablist')).toBeVisible({ timeout: 45_000 })
}

test('marketing page story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-marketing--page')

  await storyExpect(page.getByTestId('marketing-page')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Create the content you want to run, then bring it straight into play.' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('auth shell story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-auth-authpageshell--login')

  await storyExpect(page.getByTestId('auth-shell')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('password update story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-auth-authpageshell--update-password')

  await storyExpect(page.getByTestId('auth-shell')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Update password' })).toBeVisible()
})

test('app shell story renders in Storybook', async ({ page }) => {
  await openStory(page, 'platform-shells-appshellframe--default')

  await storyExpect(page.getByTestId('app-shell')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Authenticated shell foundation' })).toBeVisible()
})

test('authored list story renders locked and owned states in Storybook', async ({ page }) => {
  await openStory(page, 'platform-authored-list-authoredlistpage--default')

  await storyExpect(page.getByRole('heading', { name: 'Spells' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /magic missile/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /ember lace/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Spell' })).toBeVisible()
})

test('authored list card view renders locked and owned states in Storybook', async ({ page }) => {
  await openStory(page, 'platform-authored-list-authoredlistpage--card-view')

  await storyExpect(page.getByRole('heading', { name: 'Spells' })).toBeVisible()
  await storyExpect(page.getByLabel(/view magic missile/i)).toBeVisible()
  await storyExpect(page.getByLabel(/view ember lace/i)).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'false')
  await storyExpect(page.getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'true')
  await storyExpect.poll(() => getGridColumnCount(page)).toBe(3)
})

test('authored list mobile card menu exposes permission-aware actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openStory(page, 'platform-authored-list-authoredlistpage--mobile')

  await storyExpect(page.getByLabel(/view magic missile/i)).toBeVisible()
  await storyExpect.poll(() => getGridColumnCount(page)).toBe(1)
  await page.getByRole('button', { name: /more actions for magic missile/i }).click()
  const magicMissileMenu = page.getByRole('menu', { name: /more actions for magic missile/i })
  await storyExpect(magicMissileMenu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
  await storyExpect(magicMissileMenu.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /more actions for ember lace/i }).click()
  const emberLaceMenu = page.getByRole('menu', { name: /more actions for ember lace/i })
  await storyExpect(emberLaceMenu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
  await storyExpect(emberLaceMenu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
  await storyExpect(emberLaceMenu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
})

test('authored detail story renders draft preview reader surface', async ({ page }) => {
  await openStory(page, 'platform-authored-detail-authoreddetaillayout--draft-preview')

  await storyExpect(page.getByRole('heading', { name: 'Sea Elf' })).toBeVisible()
  await storyExpect(page.getByText('Draft Preview', { exact: true })).toBeVisible()
  await storyExpect(page.getByRole('navigation', { name: 'Detail sections' })).toBeVisible()
  await storyExpect(page.getByRole('link', { name: 'Features' })).toBeVisible()
})

test('background list story renders owned and locked master states', async ({ page }) => {
  await openStory(page, 'domains-backgrounds-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Backgrounds' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /acolyte/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /urban investigator/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Background' })).toBeVisible()
})

test('background form story moves through content sections', async ({ page }) => {
  await openStory(page, 'domains-backgrounds-form--edit-owned')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Basics')).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Urban Investigator')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Details', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Details')).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Granted Content', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Proficiencies').first()).toBeVisible()
  await storyExpect(page.getByText('Features').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Starting Equipment', level: 1 })).toBeVisible()
})

test('background locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-backgrounds-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
  await storyExpect(page.getByRole('button', { name: 'Save Background' })).toHaveCount(0)
})

test('feat list story renders owned and locked master states', async ({ page }) => {
  await openStory(page, 'domains-feats-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Feats' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /grappler/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /battlefield reader/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Feat' })).toBeVisible()
})

test('feat form story moves through requirements, mechanics, and features', async ({ page }) => {
  await openStory(page, 'domains-feats-form--edit-owned')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Basics')).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Battlefield Reader')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Requirements', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Requirements')).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Mechanics', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Mechanics')).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByText('Effects').first()).toBeVisible()
  await storyExpect(page.getByText('Charges').first()).toBeVisible()
  await storyExpect(page.getByText('Grants').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Features', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Features')).toHaveAttribute('aria-current', 'step')
})

test('feat locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-feats-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
  await storyExpect(page.getByRole('button', { name: 'Save Feat' })).toHaveCount(0)
})

test('race list story renders category and locked master states', async ({ page }) => {
  await openStory(page, 'domains-races-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Races' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: 'View Elf' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /wood elf/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Race' })).toBeVisible()
})

test('base race form story moves through Figma-aligned sections', async ({ page }) => {
  await openStory(page, 'domains-races-form--edit-base-race')

  await storyExpect(page.getByRole('heading', { name: 'Classification', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Dragonborn').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Traits', level: 1 })).toBeVisible()
})

test('subrace form story shows inherited content without base ancestry step', async ({ page }) => {
  await openStory(page, 'domains-races-form--edit-subrace')

  await storyExpect(page.getByRole('heading', { name: 'Classification', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Traits', level: 1 })).toBeVisible()
})

test('race locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-races-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Classification', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Activate Race' })).toHaveCount(0)
})

test('equipment list story renders category and locked master states', async ({ page }) => {
  await openStory(page, 'domains-equipment-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /backpack/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /longsword \+1/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Equipment' })).toBeVisible()
})

test('base equipment form story moves through equipment sections', async ({ page }) => {
  await openStory(page, 'domains-equipment-form--edit-base-equipment')

  await storyExpect(page.getByRole('heading', { name: 'Properties', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Explorer Pack').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Cost and Weight', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Contents', level: 1 })).toBeVisible()
})

test('variant equipment form moves through equipment sections', async ({ page }) => {
  await openStory(page, 'domains-equipment-form--edit-variant-equipment')

  await storyExpect(page.getByRole('heading', { name: 'Properties', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Cost and Weight', level: 1 })).toBeVisible()
})

test('equipment locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-equipment-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Properties', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Activate Equipment' })).toHaveCount(0)
})

test('creature list story renders category and locked master states', async ({ page }) => {
  await openStory(page, 'domains-creatures-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Creatures' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /moonlit owlbear/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /river hart/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Creature' })).toBeVisible()
})

test('monster creature form story moves through category sections', async ({ page }) => {
  await openStory(page, 'domains-creatures-form--edit-monster')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Moonlit Owlbear').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Defenses', level: 1 })).toBeVisible()
})

test('beast creature form story exposes travel and mount profile flows', async ({ page }) => {
  await openStory(page, 'domains-creatures-form--beast-mount')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('River Hart').first()).toBeVisible()
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await storyExpect(page.getByRole('heading', { name: 'Profiles', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Currency').first()).toBeVisible()
})

test('creature locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-creatures-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Activate Creature' })).toHaveCount(0)
})

test('vehicle list story renders category and locked master states', async ({ page }) => {
  await openStory(page, 'domains-vehicles-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /sky skiff/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /galley/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Vehicle' })).toBeVisible()
})

test('vehicle form story moves through shared vehicle sections', async ({ page }) => {
  await openStory(page, 'domains-vehicles-form--edit-vehicle')

  await storyExpect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Sky Skiff').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Crew and Capacity', level: 1 })).toBeVisible()
})

test('vehicle locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-vehicles-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Activate Vehicle' })).toHaveCount(0)
})

test('class list story renders base and subclass states', async ({ page }) => {
  await openStory(page, 'domains-classes-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Classes' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /fighter/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /champion/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Class' })).toBeVisible()
})

test('class form story moves through class sections', async ({ page }) => {
  await openStory(page, 'domains-classes-form--edit-base-class')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByText('Fighter').first()).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Class Details', level: 1 })).toBeVisible()
})

test('class locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-classes-form--locked-subclass')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Activate Class' })).toHaveCount(0)
})

test('character list story renders active and draft builder rows', async ({ page }) => {
  await openStory(page, 'domains-characters-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Characters' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /astra vale/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /untitled character/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Character' })).toBeVisible()
})

test('character builder story moves through source-local builder steps', async ({ page }) => {
  await openStory(page, 'domains-characters-builder--edit-ready-character')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 2 })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Character Name' })).toHaveValue('Astra Vale')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Race', level: 2 })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Race', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Review' }).click()
  await storyExpect(page.getByText('Ready to finalize')).toBeVisible()
})

test('character sheet overview story renders play-state controls', async ({ page }) => {
  test.setTimeout(60_000)
  await openCharacterSheetStory(page, 'domains-characters-sheet--overview')

  await storyExpect(page.getByRole('heading', { name: 'Astra Vale' })).toBeVisible()
  await storyExpect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  await storyExpect(page.getByText('HP', { exact: true })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Apply Damage' })).toBeVisible()
  await storyExpect(page.getByText('Poisoned', { exact: true }).first()).toBeVisible()

  await openCharacterSheetStory(page, 'domains-characters-sheet--conditions-and-exhaustion')

  await storyExpect(page.getByText('Level 3')).toBeVisible()
  await storyExpect(page.getByText('Prone', { exact: true }).first()).toBeVisible()
  await storyExpect(page.getByText(/collapsing gantry/i).first()).toBeVisible()
})

test('character sheet spell and inventory stories expose sheet commands', async ({ page }) => {
  test.setTimeout(60_000)
  await openCharacterSheetStory(page, 'domains-characters-sheet--spell-management')

  await storyExpect(page.getByRole('tab', { name: 'Spells' })).toHaveAttribute('aria-selected', 'true')
  await storyExpect(page.getByText('Magic Missile')).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /prepare magic missile for wizard/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Use' }).first()).toBeVisible()

  await openCharacterSheetStory(page, 'domains-characters-sheet--inventory-management')

  await storyExpect(page.getByRole('tab', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true')
  await storyExpect(page.getByText('Quarterstaff', { exact: true }).first()).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /increase quarterstaff quantity/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Apply Currency' })).toBeVisible()

  await openCharacterSheetStory(page, 'domains-characters-sheet--mobile-inventory-management')

  await storyExpect(page.getByRole('tab', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true')
  await storyExpect(page.getByRole('button', { name: /increase quarterstaff quantity/i })).toBeVisible()
})

test('character sheet history and command-error stories render review states', async ({ page }) => {
  test.setTimeout(60_000)
  await openCharacterSheetStory(page, 'domains-characters-sheet--history')

  await storyExpect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
  await storyExpect(page.getByText('Shield marked prepared for Wizard')).toBeVisible()

  await openStory(page, 'domains-characters-sheet--command-error')

  await storyExpect(page.getByText(/changed in another tab/i)).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

  await openStory(page, 'domains-characters-sheet--command-pending')

  await storyExpect(page.getByText(/command is being applied/i)).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Apply Damage' })).toBeDisabled()

  await openStory(page, 'domains-characters-sheet--command-pending-inventory')

  await storyExpect(page.getByText(/inventory command pending/i)).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /add item/i })).toBeDisabled()
  await storyExpect(page.getByRole('button', { name: /apply currency/i })).toBeDisabled()

  await openStory(page, 'domains-characters-sheet--command-pending-notes')

  await storyExpect(page.getByText(/notes command pending/i)).toBeVisible()
  await storyExpect(page.getByLabel('Session notes')).toHaveAttribute('contenteditable', 'false')
  await storyExpect(page.getByRole('button', { name: /save notes/i })).toBeDisabled()
})

test('theme toggle story switches between light and dark', async ({ page }) => {
  await openStory(page, 'ui-primitives-themetoggle--default')

  await storyExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeEnabled()
  await storyExpect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /dark/)
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await storyExpect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /light/)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await storyExpect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /dark/)
})

test('select primitives expose Mantine-backed keyboardable options', async ({ page }) => {
  await openStory(page, 'ui-primitives-select--single')

  await storyExpect(page.getByText('Selected: evocation')).toBeVisible()
  await page.getByRole('textbox', { name: 'Magic School' }).click()
  await storyExpect(page.getByRole('option', { name: 'Abjuration' })).toBeVisible()
  await page.getByRole('option', { name: 'Abjuration' }).click()
  await storyExpect(page.getByText('Selected: abjuration')).toBeVisible()
})

test('multiselect all shortcut switches to explicit selections', async ({ page }) => {
  await openStory(page, 'ui-primitives-select--multi-with-all-shortcut')

  await storyExpect(page.getByText('Model value: all')).toBeVisible()
  await page.getByRole('textbox', { name: 'Eligible options' }).click()
  await storyExpect(page.getByRole('option', { name: 'Wizard' })).toBeVisible()
  await page.getByRole('option', { name: 'Wizard' }).click()
  await storyExpect(page.getByText('Model value: wizard')).toBeVisible()
})

test('form platform field primitives accept input in Storybook', async ({ page }) => {
  await openStory(page, 'platform-form--field-primitives')

  const nameField = page.getByRole('textbox', { name: 'Name' })
  await storyExpect(nameField).toHaveValue('Ember Ward')
  await nameField.fill('Frost Lace')
  await storyExpect(nameField).toHaveValue('Frost Lace')
  await storyExpect(page.getByText('Rich Text Notes')).toBeVisible()
  await storyExpect(page.getByText('Use this field for formatted longform notes.')).toBeVisible()
})

test('form platform sectioned node map switches sections in Storybook', async ({ page }) => {
  await openStory(page, 'platform-form--sectioned-node-map')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Casting' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Casting', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toHaveCount(0)
})

test('form platform locked master story is read-only and copyable', async ({ page }) => {
  await openStory(page, 'platform-form--locked-master-readonly')

  await storyExpect(page.getByRole('button', { name: 'Copy to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
})

test('form platform read-only rich text disables editing controls', async ({ page }) => {
  await openStory(page, 'platform-form--field-primitives-readonly')

  await storyExpect(page.locator('.ProseMirror').first()).toHaveAttribute('contenteditable', 'false')
  await storyExpect(page.getByRole('button', { name: 'Bold' })).toHaveCount(0)
})

test('form platform nested collection story adds items', async ({ page }) => {
  await openStory(page, 'platform-form--nested-collection')

  await storyExpect(page.getByText(/note 1/i)).toBeVisible()
  await page.getByRole('button', { name: 'Add note' }).click()
  await storyExpect(page.getByText(/note 2/i)).toBeVisible()
})

test('spell form story switches resolved sections', async ({ page }) => {
  await openStory(page, 'domains-spells-form--edit-owned')

  await storyExpect(page.getByRole('heading', { name: 'Basics', level: 1 })).toBeVisible()
  await storyExpect(formStep(page, 'Basics')).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Fire Lace')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Casting', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Material Description' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Activate Spell' })).toBeVisible()
})
