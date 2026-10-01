import type { CharacterSheetNotesSliceDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetNotes } from '../notes/CharacterSheetNotes'
import * as coreStyles from '../core/sheetShell.css'
import * as mobileStyles from './mobile.css'

export function CharacterSheetMobileNotes({
  pending,
  sheet,
  submitCommand
}: {
  pending: boolean
  sheet: CharacterSheetNotesSliceDto
  submitCommand: SubmitSheetCommand
}) {
  return (
    <section
      className={mobileStyles.mobilePageStack}
      aria-labelledby='character-sheet-mobile-notes'
    >
      <h2 id='character-sheet-mobile-notes' className={coreStyles.visuallyHidden}>
        Notes
      </h2>
      <CharacterSheetNotes pending={pending} sheet={sheet} submitCommand={submitCommand} />
    </section>
  )
}
