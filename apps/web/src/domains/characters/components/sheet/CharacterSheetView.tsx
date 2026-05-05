import { Alert, Tabs } from '@mantine/core'
import { useCharacterSheetCommandMutation } from '#app/data/characters/mutations'
import { CharacterSheetActions } from './CharacterSheetActions'
import { CharacterSheetHero } from './CharacterSheetHero'
import { CharacterSheetHistory } from './CharacterSheetHistory'
import { CharacterSheetInventory } from './CharacterSheetInventory'
import { CharacterSheetNotes } from './CharacterSheetNotes'
import { CharacterSheetOverview } from './CharacterSheetOverview'
import { CharacterSheetReference } from './CharacterSheetReference'
import { CharacterSheetResources } from './CharacterSheetResources'
import { CharacterSheetSpells } from './CharacterSheetSpells'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetTabId } from './CharacterSheet.types'

export function CharacterSheetView({
  hasDraft,
  initialTab = 'overview',
  sheet
}: {
  hasDraft: boolean
  initialTab?: CharacterSheetTabId
  sheet: CharacterSheet
}) {
  const commandMutation = useCharacterSheetCommandMutation(sheet.meta.characterId)
  const pending = commandMutation.isPending
  const sectionProps = {
    pending,
    sheet,
    submitCommand: commandMutation.mutate
  }

  return (
    <div className={styles.shell}>
      <CharacterSheetHero hasDraft={hasDraft} sheet={sheet} />
      {hasDraft
        ? (
            <Alert color='yellow'>
              This character has builder draft work. The sheet is showing the last finalized active character until that builder draft is saved.
            </Alert>
          )
        : null}
      {commandMutation.error
        ? <Alert color='red'>{commandMutation.error.message}</Alert>
        : null}

      <Tabs defaultValue={initialTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value='overview'>Overview</Tabs.Tab>
          <Tabs.Tab value='actions'>Actions</Tabs.Tab>
          <Tabs.Tab value='resources'>Resources</Tabs.Tab>
          <Tabs.Tab value='spells'>Spells</Tabs.Tab>
          <Tabs.Tab value='inventory'>Inventory</Tabs.Tab>
          <Tabs.Tab value='reference'>Reference</Tabs.Tab>
          <Tabs.Tab value='notes'>Notes</Tabs.Tab>
          <Tabs.Tab value='history'>History</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value='overview' pt='md'>
          <div className={styles.contentGrid}>
            <CharacterSheetOverview {...sectionProps} />
            <aside className={styles.sidebar}>
              <CharacterSheetResources {...sectionProps} />
            </aside>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value='actions' pt='md'>
          <CharacterSheetActions sheet={sheet} />
        </Tabs.Panel>
        <Tabs.Panel value='resources' pt='md'>
          <CharacterSheetResources {...sectionProps} />
        </Tabs.Panel>
        <Tabs.Panel value='spells' pt='md'>
          <CharacterSheetSpells {...sectionProps} />
        </Tabs.Panel>
        <Tabs.Panel value='inventory' pt='md'>
          <CharacterSheetInventory {...sectionProps} />
        </Tabs.Panel>
        <Tabs.Panel value='reference' pt='md'>
          <CharacterSheetReference sheet={sheet} />
        </Tabs.Panel>
        <Tabs.Panel value='notes' pt='md'>
          <CharacterSheetNotes {...sectionProps} />
        </Tabs.Panel>
        <Tabs.Panel value='history' pt='md'>
          <CharacterSheetHistory characterId={sheet.meta.characterId} />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
