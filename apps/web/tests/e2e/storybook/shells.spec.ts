import { expect, test, type Page } from '@playwright/test'

const storyExpect = expect.configure({ timeout: 20_000 })

test.describe.configure({ mode: 'serial' })

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`, { waitUntil: 'commit', timeout: 60_000 })
}

async function getGridColumnCount(page: Page) {
  return page.getByTestId('authored-list-card-row').first().evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ))
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

test('background list story renders owned and locked master states', async ({ page }) => {
  await openStory(page, 'domains-backgrounds-list--default')

  await storyExpect(page.getByRole('heading', { name: 'Backgrounds' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /acolyte/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /urban investigator/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Background' })).toBeVisible()
})

test('background form story moves through content sections', async ({ page }) => {
  await openStory(page, 'domains-backgrounds-form--edit-owned')

  await storyExpect(page.getByRole('heading', { name: 'Background Basics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Basics: Name and concept/i })).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Urban Investigator')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Background Content' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Content: Features, proficiencies, and gear/i })).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('heading', { name: 'Proficiencies' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Features' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Starting Equipment' })).toBeVisible()
})

test('background locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-backgrounds-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Background Basics' })).toBeVisible()
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

  await storyExpect(page.getByRole('heading', { name: 'Feat Basics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Basics: Name, description, and player-facing details/i })).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Battlefield Reader')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Feat Requirements' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Requirements: Character prerequisites and unlock rules/i })).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Feat Mechanics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Mechanics: Effects, charges, and grants/i })).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('heading', { name: 'Effects' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Grants' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Feat Features', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Features: Feat-owned feature basics/i })).toHaveAttribute('aria-current', 'step')
})

test('feat locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-feats-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Feat Basics' })).toBeVisible()
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

  await storyExpect(page.getByRole('heading', { name: 'Base Race Basics' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Dragonborn')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Base Race Content' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Speeds' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Base Race Ancestry' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Ancestry', exact: true })).toBeVisible()
})

test('subrace form story shows inherited content without base ancestry step', async ({ page }) => {
  await openStory(page, 'domains-races-form--edit-subrace')

  await storyExpect(page.getByRole('heading', { name: 'Subrace Basics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Ancestry/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Subrace Content' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Inherited From Base Race' })).toBeVisible()
})

test('race locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-races-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Base Race Basics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
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

  await storyExpect(page.getByRole('heading', { name: 'Base Equipment Basics' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Explorer Pack')
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Base Equipment Inventory' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Base Equipment Rules' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Base Equipment Content' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Effects' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Features' })).toBeVisible()
})

test('variant equipment form omits base-only inventory and contents sections', async ({ page }) => {
  await openStory(page, 'domains-equipment-form--edit-variant-equipment')

  await storyExpect(page.getByRole('heading', { name: 'Variant Equipment Basics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Inventory/i })).toHaveCount(0)
  await storyExpect(page.getByRole('button', { name: /Contents/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Variant Equipment Rules' })).toBeVisible()
})

test('equipment locked master story is duplicate-only', async ({ page }) => {
  await openStory(page, 'domains-equipment-form--locked-master-readonly')

  await storyExpect(page.getByRole('heading', { name: 'Base Equipment Basics' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Duplicate to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
  await storyExpect(page.getByRole('button', { name: 'Activate Equipment' })).toHaveCount(0)
})

test('theme toggle story switches between light and dark', async ({ page }) => {
  await openStory(page, 'platform-theme-themetoggle--default')

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

test('form runtime field primitives accept input in Storybook', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--field-primitives')

  const nameField = page.getByRole('textbox', { name: 'Name' })
  await storyExpect(nameField).toHaveValue('Ember Ward')
  await nameField.fill('Frost Lace')
  await storyExpect(nameField).toHaveValue('Frost Lace')
  await storyExpect(page.getByText('Rich Text Notes')).toBeVisible()
  await storyExpect(page.getByText('Use this field for formatted longform notes.')).toBeVisible()
})

test('form runtime sectioned node map switches sections in Storybook', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--sectioned-node-map')

  await storyExpect(page.getByRole('heading', { name: 'Basics' })).toBeVisible()
  await page.getByRole('button', { name: 'Casting' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Casting' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Basics' })).toHaveCount(0)
})

test('form runtime locked master story is read-only and copyable', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--locked-master-readonly')

  await storyExpect(page.getByRole('button', { name: 'Copy to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
})

test('form runtime read-only rich text disables editing controls', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--field-primitives-readonly')

  await storyExpect(page.locator('.ProseMirror').first()).toHaveAttribute('contenteditable', 'false')
  await storyExpect(page.getByRole('button', { name: 'Bold' })).toHaveCount(0)
})

test('form runtime nested collection story adds items', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--nested-collection')

  await storyExpect(page.getByText('Useful for playtest encounters')).toBeVisible()
  await page.getByRole('button', { name: 'Add note' }).click()
  await storyExpect(page.getByText('Note 1')).toBeVisible()
})

test('reusable effect editor opens as a full-screen modal', async ({ page }) => {
  await openStory(page, 'components-effecteditor--editable')

  await storyExpect(page.getByRole('heading', { name: 'Effects' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit effect 1' }).click()
  const dialog = page.getByRole('dialog')
  await storyExpect(dialog).toBeVisible()
  await storyExpect(dialog.getByRole('heading', { name: 'How it Starts' })).toBeVisible()
  await storyExpect(dialog.locator('#effect-1-trigger-heading')).toBeVisible()
  await storyExpect(dialog.locator('#effect-1-reach-heading')).toBeVisible()
  await storyExpect(dialog.locator('#effect-1-targeting-heading')).toBeVisible()
  await page.getByRole('button', { name: 'Next: outcome paths' }).click()
  await storyExpect(dialog.getByRole('heading', { name: 'Outcome Paths', level: 2 })).toBeVisible()
  await page.getByRole('button', { name: /open on use/i }).click()
  await page.getByRole('button', { name: '+ Add outcome' }).click()
  await page.getByRole('menuitem', { name: /Damage/ }).click()
  await storyExpect(page.getByRole('textbox', { name: 'Damage type' })).toBeVisible()
})

test('reusable effect editor read-only story hides destructive actions', async ({ page }) => {
  await openStory(page, 'components-effecteditor--readonly')

  await storyExpect(page.getByRole('button', { name: 'View effect 1' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Remove effect 1' })).toHaveCount(0)
})

test('spell form story switches sections and opens effect editor', async ({ page }) => {
  await openStory(page, 'domains-spells-form--edit-owned')

  await storyExpect(page.getByRole('heading', { name: 'Spell Info' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Spell Info: Name, level, casting, and components/i })).toHaveAttribute('aria-current', 'step')
  await storyExpect(page.getByRole('heading', { name: 'Basics' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Components & Attributes' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Material Description' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Effects', level: 1 })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: /Effects: What happens when the spell is used/i })).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Edit effect 1' }).click()
  await storyExpect(page.getByRole('dialog')).toBeVisible()
  await storyExpect(page.getByLabel('Effect editor location').getByText('Fire Lace')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'How it Starts' })).toBeVisible()
  await page.getByRole('button', { name: 'Next: outcome paths' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Outcome Paths', level: 2 })).toBeVisible()
})
