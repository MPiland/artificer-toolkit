import { expect, type Page } from '@playwright/test'
import { runAndWaitForSuccessfulTrpcProcedure } from './trpc'

const BUILDER_CONTROL_TIMEOUT = 10_000

export async function goToBuilderStep(page: Page, label: string): Promise<void> {
  const step = page
    .getByRole('navigation', { name: 'Authoring steps' })
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })

  await expect(step).toHaveCount(1)
  await step.click()
  await expect(page.getByRole('heading', { name: label, exact: true }).first()).toBeVisible()
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

export async function selectBuilderMultiOptionAndResolve(
  page: Page,
  label: string | RegExp,
  option: string
): Promise<void> {
  const optionLocator = page.getByRole('option', { name: option, exact: true })
  if (!(await optionLocator.isVisible())) {
    const combobox = page.getByRole('combobox', { name: label })
    await expect(combobox).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
    await combobox.click()
  }
  await expect(optionLocator).toBeVisible({ timeout: BUILDER_CONTROL_TIMEOUT })
  await runAndWaitForSuccessfulTrpcProcedure(
    page,
    'characters.resolve',
    async () => optionLocator.click(),
    { method: 'POST' }
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
