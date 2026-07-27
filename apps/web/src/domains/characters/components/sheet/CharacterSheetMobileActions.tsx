import * as styles from './characterSheet.css'
import { CharacterSheetActions } from './CharacterSheetActions'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileActions({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.mobilePageStack}>
      <CharacterSheetActions
        hideTitle
        pending={pending}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    </section>
  )
}
