import * as styles from './characterSheet.css'
import { CharacterSheetOverviewAbilities } from './CharacterSheetOverviewAbilities'
import { CharacterSheetDefensesPanel, CharacterSheetSensesPanel } from './CharacterSheetOverview'
import {
  CharacterSheetSavingThrowsPanel,
} from './CharacterSheetOverviewProficiencies'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileStats({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.mobilePageStack} aria-label='Overview'>
      <CharacterSheetOverviewAbilities abilities={sheet.overview.abilities} />
      <CharacterSheetSavingThrowsPanel savingThrows={sheet.overview.savingThrows} />
      <CharacterSheetDefensesPanel sheet={sheet} />
      <CharacterSheetSensesPanel sheet={sheet} />
      <CharacterSheetOverviewStatusStrip pending={pending} sheet={sheet} submitCommand={submitCommand} />
    </section>
  )
}
