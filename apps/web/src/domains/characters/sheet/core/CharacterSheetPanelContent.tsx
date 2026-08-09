import type { ReactNode } from 'react'
import { CharacterSheetActions } from '../actions/CharacterSheetActions'
import { CharacterSheetExtras } from '../extras/CharacterSheetExtras'
import { CharacterSheetInventory } from '../inventory/CharacterSheetInventory'
import { CharacterSheetMobileActions } from '../mobile/CharacterSheetMobileActions'
import { CharacterSheetMobileNotes } from '../mobile/CharacterSheetMobileNotes'
import { CharacterSheetMobileStats } from '../mobile/CharacterSheetMobileStats'
import { CharacterSheetNotes } from '../notes/CharacterSheetNotes'
import {
  CharacterSheetOverviewFacts,
  CharacterSheetProficiencySummary
} from '../overview/CharacterSheetOverview'
import { CharacterSheetSkillsPanel } from '../overview/CharacterSheetOverviewProficiencies'
import { CharacterSheetReference } from '../reference/CharacterSheetReference'
import * as mobileStyles from '../mobile/mobile.css'
import { CharacterSheetSpells } from '../spells/CharacterSheetSpells'
import type {
  CharacterSheet,
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
  sheet: CharacterSheet
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
    case 'actions':
      return mobile ? (
        <CharacterSheetMobileActions
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      ) : (
        <CharacterSheetActions
          hideTitle
          openPanel={openPanel}
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'spells':
      return (
        <CharacterSheetSpells
          hideTitle
          openPanel={openPanel}
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'extras':
      return (
        <CharacterSheetExtras
          hideTitle
          openPanel={openPanel}
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'equipment':
      return (
        <CharacterSheetInventory
          editable={sheet.meta.capabilities.manageInventory}
          partyInventory={campaignInventory}
          hideTitle
          openPanel={openPanel}
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'features':
      return (
        <CharacterSheetReference
          hideTitle
          mode='features'
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'inventory':
      return (
        <CharacterSheetInventory
          editable={sheet.meta.capabilities.manageInventory}
          partyInventory={campaignInventory}
          hideTitle
          openPanel={openPanel}
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'reference':
      return (
        <CharacterSheetReference
          hideTitle
          mode='features'
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      )
    case 'notes':
      return mobile ? (
        <CharacterSheetMobileNotes pending={pending} sheet={sheet} submitCommand={submitCommand} />
      ) : (
        <CharacterSheetNotes
          hideTitle
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
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
      return mobile ? (
        <CharacterSheetMobileStats openPanel={openPanel} sheet={sheet} />
      ) : (
        <CharacterSheetOverviewFacts openPanel={openPanel} sheet={sheet} showDefenses={false} />
      )
  }
}
