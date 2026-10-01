import type { CharacterSheetActionsDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { CharacterSheetActions } from '../actions/CharacterSheetActions'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as mobileStyles from './mobile.css'

export function CharacterSheetMobileActions({
  pending,
  sheet,
  submitCommand
}: {
  pending: boolean
  sheet: CharacterSheetActionsDto
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
