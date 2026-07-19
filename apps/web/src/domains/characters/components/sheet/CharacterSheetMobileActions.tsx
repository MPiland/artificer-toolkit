import * as styles from './characterSheet.css'
import { CharacterSheetActions } from './CharacterSheetActions'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'
import { CharacterSheetResources } from './CharacterSheetResources'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileActions({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.mobilePageStack} aria-labelledby='character-sheet-mobile-actions'>
      <h2 id='character-sheet-mobile-actions' className={styles.visuallyHidden}>Actions</h2>
      <CharacterSheetActions sheet={sheet} />
      <CharacterSheetOverviewStatusStrip
        pending={pending}
        sheet={sheet}
        submitCommand={submitCommand}
      />
      <CharacterSheetResources
        pending={pending}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    </section>
  )
}
