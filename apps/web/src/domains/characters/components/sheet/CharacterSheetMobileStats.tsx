import * as styles from './characterSheet.css'
import { CharacterSheetOverviewAbilities } from './CharacterSheetOverviewAbilities'
import { CharacterSheetDefensesPanel, CharacterSheetSensesPanel } from './CharacterSheetOverview'
import {
  CharacterSheetSavingThrowsPanel,
} from './CharacterSheetOverviewProficiencies'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileStats({
  openPanel,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.mobilePageStack} aria-label='Overview'>
      <CharacterSheetOverviewAbilities abilities={sheet.overview.abilities} openPanel={openPanel} />
      <CharacterSheetSavingThrowsPanel openPanel={openPanel} savingThrows={sheet.overview.savingThrows} />
      <CharacterSheetDefensesPanel openPanel={openPanel} sheet={sheet} />
      <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
      <CharacterSheetOverviewStatusStrip pending={pending} sheet={sheet} submitCommand={submitCommand} />
    </section>
  )
}
