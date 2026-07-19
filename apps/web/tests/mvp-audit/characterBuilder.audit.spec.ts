import { expect, test } from '@playwright/test'
import { captureAuditNetwork, countMutationRequests } from './auditNetwork'
import { navigateForMvpAudit } from './auditNavigation'

const storageState = process.env.MVP_AUDIT_STORAGE_STATE
if (storageState) test.use({ storageState })

test.describe('MVP character Builder audit', () => {
  test('loads, edits, and saves a draft while capturing resolution timings', async ({
    page
  }, testInfo) => {
    const capture = captureAuditNetwork(page)

    try {
      const navigation = await navigateForMvpAudit(
        page,
        process.env.MVP_AUDIT_BUILDER_PATH ?? '/characters/new'
      )
      if (navigation.prerequisite) {
        throw new Error(navigation.prerequisite)
      }

      await expect(page.getByTestId('authoring-form-canvas')).toBeVisible()

      const basicsStep = page.getByRole('button', { name: /^Basics$/ }).first()
      if (await basicsStep.count()) await basicsStep.click()

      const characterName = page.getByLabel('Character Name')
      await expect(characterName).toBeVisible()

      const nextName = `MVP Audit ${new Date().toISOString()}`
      await characterName.fill(nextName)
      await expect(characterName).toHaveValue(nextName)

      const saveDraft = page.getByRole('button', { name: 'Save Draft' })
      await expect(saveDraft).toBeVisible()
      await expect(saveDraft).toBeEnabled()

      const mutationsBeforeSave = countMutationRequests(capture.records())
      await saveDraft.click()
      await expect
        .poll(() => countMutationRequests(capture.records()), { timeout: 10_000 })
        .toBeGreaterThan(mutationsBeforeSave)
    } finally {
      await capture.attach(testInfo, 'builder-network-timings')
      capture.dispose()
    }
  })
})
