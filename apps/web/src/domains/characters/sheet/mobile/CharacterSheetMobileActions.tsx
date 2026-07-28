import { CharacterSheetActions } from '../actions/CharacterSheetActions'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as mobileStyles from './mobile.css'

export function CharacterSheetMobileActions({
  pending,
  sheet,
  submitCommand
}: {
  pending: boolean
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
}) {
  return (
    <section className={mobileStyles.mobilePageStack}>
      <CharacterSheetActions
        hideTitle
        pending={pending}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    </section>
  )
}
