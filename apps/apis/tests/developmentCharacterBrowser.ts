import { rm } from 'node:fs/promises'
import { appBrowserEvidenceDirectory, runAppBrowserSpec } from './developmentAppBrowser'

export async function verifyCharacterBrowser(
  input: {
    email: string
    password: string
    session: string
    userId: string
  } & ({ journey: 'builder' } | { journey: 'sheet' | 'sheet-spells'; characterPublicId: string })
): Promise<void> {
  const evidenceDirectory = appBrowserEvidenceDirectory(
    input.journey === 'builder'
      ? 'builder-browser'
      : input.journey === 'sheet'
        ? 'sheet-browser'
        : 'sheet-spells-browser'
  )
  const builderJourneysPath = `${evidenceDirectory}/builder-journeys.json`
  if (input.journey === 'builder') await rm(builderJourneysPath, { force: true })
  await runAppBrowserSpec({
    evidenceDirectory,
    spec:
      input.journey === 'builder'
        ? 'characterBuilder.spec.ts'
        : input.journey === 'sheet'
          ? 'characterSheet.spec.ts'
          : 'characterSheetSpells.spec.ts',
    environment: {
      MVP_AUDIT_EMAIL: input.email,
      MVP_AUDIT_PASSWORD: input.password,
      MVP_AUDIT_STORAGE_STATE: '',
      CONVEX_E2E_SESSION: input.session,
      CONVEX_E2E_USER_ID: input.userId,
      ...(input.journey !== 'builder'
        ? { CONVEX_E2E_CHARACTER_ID: input.characterPublicId }
        : { CONVEX_E2E_BUILDER_JOURNEYS: builderJourneysPath })
    },
    secrets: [input.email, input.password, input.session]
  })
}
