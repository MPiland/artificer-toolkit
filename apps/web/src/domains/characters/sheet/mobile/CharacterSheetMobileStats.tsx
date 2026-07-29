import type { CharacterSheet, OpenSheetPanel } from '../core/CharacterSheet.types'
import { CharacterSheetSensesPanel } from '../overview/CharacterSheetOverview'
import { CharacterSheetOverviewAbilities } from '../overview/CharacterSheetOverviewAbilities'
import { CharacterSheetSavingThrowsPanel } from '../overview/CharacterSheetOverviewProficiencies'
import * as mobileStyles from './mobile.css'

export function CharacterSheetMobileStats({
  openPanel,
  sheet
}: {
  openPanel?: OpenSheetPanel
  sheet: CharacterSheet
}) {
  return (
    <section className={mobileStyles.mobilePageStack} aria-label='Overview'>
      <CharacterSheetOverviewAbilities abilities={sheet.overview.abilities} openPanel={openPanel} />
      <CharacterSheetSavingThrowsPanel
        openPanel={openPanel}
        savingThrows={sheet.overview.savingThrows}
      />
      <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
    </section>
  )
}
