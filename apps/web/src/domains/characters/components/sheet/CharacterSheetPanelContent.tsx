import { CharacterSheetActions } from './CharacterSheetActions'
import { CharacterSheetInventory } from './CharacterSheetInventory'
import { CharacterSheetMobileActions } from './CharacterSheetMobileActions'
import { CharacterSheetMobileNotes } from './CharacterSheetMobileNotes'
import { CharacterSheetMobileStats } from './CharacterSheetMobileStats'
import { CharacterSheetNotes } from './CharacterSheetNotes'
import { CharacterSheetOverview } from './CharacterSheetOverview'
import { CharacterSheetReference } from './CharacterSheetReference'
import { CharacterSheetResources } from './CharacterSheetResources'
import { CharacterSheetSpells } from './CharacterSheetSpells'
import { CharacterSheetSkillsPanel } from './CharacterSheetOverviewProficiencies'
import * as styles from './characterSheet.css'
import type { CharacterSheetPageId, CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetPanelContent({
  mobile,
  sectionProps,
  tab
}: {
  mobile?: boolean
  sectionProps: CharacterSheetSectionProps
  tab: CharacterSheetPageId
}) {
  switch (tab) {
    case 'overview':
      return mobile ? <CharacterSheetMobileStats {...sectionProps} /> : <CharacterSheetOverview {...sectionProps} />
    case 'actions':
      return mobile ? <CharacterSheetMobileActions {...sectionProps} /> : <CharacterSheetActions sheet={sectionProps.sheet} />
    case 'spells':
      return <CharacterSheetSpells {...sectionProps} />
    case 'equipment':
      return <CharacterSheetInventory {...sectionProps} />
    case 'features':
      return <CharacterSheetReference mode='features' sheet={sectionProps.sheet} />
    case 'resources':
      return <CharacterSheetResources {...sectionProps} />
    case 'inventory':
      return <CharacterSheetInventory {...sectionProps} />
    case 'reference':
      return <CharacterSheetReference mode='features' sheet={sectionProps.sheet} />
    case 'notes':
      return mobile ? <CharacterSheetMobileNotes {...sectionProps} /> : <CharacterSheetNotes {...sectionProps} />
    case 'skills':
      return (
        <section className={styles.mobilePageStack} aria-label='Skills'>
          <CharacterSheetSkillsPanel
            abilities={sectionProps.sheet.overview.abilities}
            openPanel={sectionProps.openPanel}
            skills={sectionProps.sheet.overview.skills}
          />
        </section>
      )
    case 'proficiencies':
      return (
        <section className={styles.mobilePageStack} aria-label='Proficiencies'>
          <CharacterSheetReference mode='proficiencies' sheet={sectionProps.sheet} />
        </section>
      )
    default:
      return mobile ? <CharacterSheetMobileStats {...sectionProps} /> : <CharacterSheetOverview {...sectionProps} />
  }
}
