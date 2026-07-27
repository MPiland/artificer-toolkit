import * as styles from './characterSheet.css'
import { CharacterSheetOverviewAbilities } from './CharacterSheetOverviewAbilities'
import { CharacterSheetSensesPanel } from './CharacterSheetOverview'
import { CharacterSheetSavingThrowsPanel } from './CharacterSheetOverviewProficiencies'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileStats({ openPanel, sheet }: CharacterSheetSectionProps) {
  return (
    <section className={styles.mobilePageStack} aria-label='Overview'>
      <CharacterSheetOverviewAbilities abilities={sheet.overview.abilities} openPanel={openPanel} />
      <CharacterSheetSavingThrowsPanel
        openPanel={openPanel}
        savingThrows={sheet.overview.savingThrows}
      />
      <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
    </section>
  )
}
