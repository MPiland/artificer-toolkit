import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { CharacterSheetFeaturePanel } from './CharacterSheetFeaturePanel'
import type { ReactNode } from 'react'
import { CharacterSheetMobileStats } from '../mobile/CharacterSheetMobileStats'
import {
  CharacterSheetOverviewFacts,
  CharacterSheetProficiencySummary
} from '../overview/CharacterSheetOverview'
import { CharacterSheetSkillsPanel } from '../overview/CharacterSheetOverviewProficiencies'
import * as mobileStyles from '../mobile/mobile.css'
import type {
  CharacterSheetPageId,
  OpenSheetPanel,
  SubmitSheetCommand
} from './CharacterSheet.types'

export function CharacterSheetPanelContent({
  campaignInventory,
  mobile,
  openPanel,
  pending,
  sheet,
  submitCommand,
  tab
}: {
  campaignInventory?: ReactNode
  mobile?: boolean
  openPanel?: OpenSheetPanel
  pending: boolean
  sheet: CharacterSheetCommonDto
  submitCommand: SubmitSheetCommand
  tab: CharacterSheetPageId
}) {
  switch (tab) {
    case 'overview':
      return mobile ? (
        <CharacterSheetMobileStats openPanel={openPanel} sheet={sheet} />
      ) : (
        <CharacterSheetOverviewFacts openPanel={openPanel} sheet={sheet} showDefenses={false} />
      )
    case 'skills':
      return (
        <section className={mobileStyles.mobilePageStack} aria-label='Skills'>
          <CharacterSheetSkillsPanel
            abilities={sheet.overview.abilities}
            openPanel={openPanel}
            skills={sheet.overview.skills}
          />
        </section>
      )
    case 'proficiencies':
      return (
        <section className={mobileStyles.mobilePageStack} aria-label='Proficiencies'>
          <CharacterSheetProficiencySummary openPanel={openPanel} sheet={sheet} />
        </section>
      )
    default:
      return (
        <CharacterSheetFeaturePanel
          campaignInventory={campaignInventory}
          openPanel={openPanel}
          pending={pending}
          meta={sheet.meta}
          submitCommand={submitCommand}
          tab={tab}
        />
      )
  }
}
