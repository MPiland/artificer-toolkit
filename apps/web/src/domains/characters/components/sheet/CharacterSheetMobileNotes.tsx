import * as styles from './characterSheet.css'
import { CharacterSheetNotes } from './CharacterSheetNotes'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileNotes({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.mobilePageStack} aria-labelledby='character-sheet-mobile-notes'>
      <h2 id='character-sheet-mobile-notes' className={styles.visuallyHidden}>Notes</h2>
      <CharacterSheetNotes
        pending={pending}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    </section>
  )
}
