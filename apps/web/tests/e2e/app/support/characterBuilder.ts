import { expect, type Page } from '@playwright/test'
import { runAndWaitForSuccessfulTrpcProcedure } from './trpc'

const BUILDER_CONTROL_TIMEOUT = 10_000

export async function goToBuilderStep(page: Page, label: string): Promise<void> {
  const step = page
    .getByRole('navigation', { name: 'Authoring steps' })
    .getByRole('link')
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })

  await expect(step).toHaveCount(1)
  await step.click()
  await expect(page.getByRole('heading', { name: label, exact: true }).first()).toBeVisible()
}

export async function selectBuilderCatalogOptionAndResolve(
  page: Page,
  actionLabel: string,
  dialogName: string,
  option: string
): Promise<void> {
  await page.getByRole('button', { name: actionLabel, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: dialogName })
  const radio = dialog.getByRole('radio', {
    name: new RegExp(`^${escapeRegExp(option)}\\b`)
  })
  await expect(dialog).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await expect(radio).toHaveCount(1)
  await radio.check()
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => dialog.getByRole('button', { name: actionLabel, exact: true }).click(),
    { method: 'POST' }
  )
  await expect(dialog).toBeHidden()
}

export async function selectBuilderOptionAndResolve(
  page: Page,
  label: string | RegExp,
  option: string
): Promise<void> {
  const combobox = page.getByRole('combobox', { name: label })
  const optionLocator = page.getByRole('option', { name: option, exact: true }).first()
  await expect(combobox).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await combobox.click()
  await expect(optionLocator).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => optionLocator.click(),
    { method: 'POST' }
  )
}

export async function selectBuilderOption(
  page: Page,
  label: string | RegExp,
  option: string
): Promise<void> {
  const combobox = page.getByRole('combobox', { name: label })
  const optionLocator = page.getByRole('option', { name: option, exact: true }).first()
  await expect(combobox).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await combobox.click()
  await expect(optionLocator).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await optionLocator.click()
}

export async function selectBuilderGrantChoiceAndResolve(
  page: Page,
  choiceLabel: string,
  option: string,
  occurrence = 0
): Promise<void> {
  const choice = getBuilderGrantChoice(page, choiceLabel, occurrence)
  const combobox = choice.getByRole('combobox')
  const optionLocator = page.getByRole('option', { name: option, exact: true }).first()
  await expect(choice).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await expect(combobox).toHaveCount(1)
  await combobox.click()
  await expect(optionLocator).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => optionLocator.click(),
    { method: 'POST' }
  )
}

export async function selectBuilderClassProficiencyAndResolve(
  page: Page,
  option: string,
  classOccurrence = 0
): Promise<void> {
  const proficiencies = page
    .getByRole('region', { name: 'Proficiencies', exact: true })
    .nth(classOccurrence)
  const combobox = proficiencies.getByRole('combobox')
  const optionLocator = page.getByRole('option', { name: option, exact: true }).first()
  await expect(proficiencies).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await expect(combobox).toHaveCount(1)
  await combobox.click()
  await expect(optionLocator).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => optionLocator.click(),
    { method: 'POST' }
  )
}

export async function expectBuilderClassProficiencyValues(
  page: Page,
  expectedValues: string[],
  classOccurrence = 0
): Promise<void> {
  const proficiencies = page
    .getByRole('region', { name: 'Proficiencies', exact: true })
    .nth(classOccurrence)
  await expect(proficiencies).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await expect(proficiencies.getByRole('combobox')).toHaveCount(1)
  for (const value of expectedValues) await expect(proficiencies).toContainText(value)
}

export async function expectBuilderGrantChoiceValues(
  page: Page,
  choiceLabel: string,
  expectedValues: string[],
  occurrence = 0
): Promise<void> {
  const choice = getBuilderGrantChoice(page, choiceLabel, occurrence)
  const combobox = choice.getByRole('combobox')
  await expect(choice).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await expect(combobox).toHaveCount(1)
  if (expectedValues.length === 1) {
    await expect(combobox).toHaveValue(expectedValues[0])
    return
  }

  for (const value of expectedValues) await expect(choice).toContainText(value)
}

export async function selectBuilderOptionAtIndexAndResolve(
  page: Page,
  label: string | RegExp,
  index: number,
  option: string
): Promise<void> {
  const combobox = page.getByRole('combobox', { name: label }).nth(index)
  const optionLocator = page.getByRole('option', { name: option, exact: true }).first()
  await expect(combobox).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await combobox.click()
  await expect(optionLocator).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => optionLocator.click(),
    { method: 'POST' }
  )
}

export async function selectBuilderSpellChoiceAndResolve(
  page: Page,
  listLabel: string,
  spellLabel: string
): Promise<void> {
  const list = page.getByRole('region', { name: listLabel, exact: true })
  const row = list.getByText(spellLabel, { exact: true }).locator('../..')
  const addButton = row.getByRole('button', { name: 'Add', exact: true })
  await expect(list).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await expect(addButton).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => addButton.click(),
    { method: 'POST' }
  )
  await expect(row.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getBuilderGrantChoice(page: Page, choiceLabel: string, occurrence: number) {
  return page
    .getByRole('article')
    .filter({ has: page.getByText(choiceLabel, { exact: true }) })
    .nth(occurrence)
}
