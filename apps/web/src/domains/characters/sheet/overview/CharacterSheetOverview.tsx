import { Text } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import * as coreStyles from '../core/sheetShell.css'
import * as overviewStyles from './overview.css'
import * as proficiencyStyles from './proficiencies.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'
import { CharacterSheetOverviewPlayArea } from './CharacterSheetOverviewPlayArea'
import {
  CharacterSheetSavingThrowsPanel,
  CharacterSheetSkillsPanel
} from './CharacterSheetOverviewProficiencies'
import { formatProficiencySummaryLabel } from './characterSheetOverview.utils'
import type { CharacterSheet, OpenSheetPanel } from '../core/CharacterSheet.types'

export function CharacterSheetSensesPanel({
  sheet,
  openPanel
}: {
  sheet: CharacterSheet
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  const passiveFacts = sheet.overview.facts.filter((fact) =>
    fact.label.toLowerCase().startsWith('passive')
  )
  const senses = sheet.reference.senses

  return (
    <section className={overviewStyles.overviewPanel} aria-labelledby='character-sheet-senses'>
      <div className={overviewStyles.overviewPanelHeader}>
        <button
          className={overviewStyles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'SENSES' })}
        >
          <Text id='character-sheet-senses' className={proficiencyStyles.proficiencyHeading}>
            Senses
          </Text>
          <ChevronRight aria-hidden='true' size={16} />
        </button>
      </div>
      <div className={rowStyles.compactDataList}>
        {passiveFacts.map((fact) => (
          <div className={rowStyles.compactDataRow} key={fact.label}>
            <Text>{fact.label}</Text>
            <Text fw={800}>{fact.value}</Text>
          </div>
        ))}
        {senses.map((sense) => (
          <div className={rowStyles.compactDataRow} key={sense.label}>
            <Text>{sense.label}</Text>
            <Text fw={800}>{sense.value}</Text>
          </div>
        ))}
        {!passiveFacts.length && !senses.length ? (
          <Text className={panelStyles.muted}>No senses are currently available.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetDefensesPanel({
  sheet,
  openPanel
}: {
  sheet: CharacterSheet
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  return (
    <section className={overviewStyles.overviewPanel} aria-labelledby='character-sheet-defenses'>
      <div className={overviewStyles.overviewPanelHeader}>
        <button
          className={overviewStyles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'DEFENSES' })}
        >
          <Text id='character-sheet-defenses' className={proficiencyStyles.proficiencyHeading}>
            Defenses
          </Text>
          <ChevronRight aria-hidden='true' size={16} />
        </button>
      </div>
      <div className={rowStyles.compactDataList}>
        {sheet.reference.defenses.map((defense) => (
          <div className={rowStyles.compactDataRow} key={`${defense.kind}:${defense.damageTypeId}`}>
            <Text>{defense.label}</Text>
            <Text fw={800}>{defense.value}</Text>
          </div>
        ))}
        {!sheet.reference.defenses.length ? (
          <Text className={panelStyles.muted}>No resistances, immunities, or vulnerabilities.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetProficiencySummary({
  sheet,
  openPanel
}: {
  sheet: CharacterSheet
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  const groups = [
    { kind: 'ARMOR', label: 'Armor' },
    { kind: 'WEAPON', label: 'Weapons' },
    { kind: 'TOOL', label: 'Tools' },
    { kind: 'LANGUAGE', label: 'Languages' }
  ] as const
  const populatedGroups = groups
    .map((group) => ({
      ...group,
      items: sheet.reference.proficiencies.filter((proficiency) => proficiency.kind === group.kind)
    }))
    .filter((group) => group.items.length)

  return (
    <section
      className={`${overviewStyles.overviewPanel} ${proficiencyStyles.proficiencySummaryPanel}`}
      aria-labelledby='character-sheet-proficiency-summary'
    >
      <div className={overviewStyles.overviewPanelHeader}>
        <button
          className={overviewStyles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'PROFICIENCIES' })}
        >
          <Text
            id='character-sheet-proficiency-summary'
            className={proficiencyStyles.proficiencyHeading}
          >
            Proficiencies
          </Text>
          <ChevronRight aria-hidden='true' size={16} />
        </button>
      </div>
      <div className={proficiencyStyles.proficiencySummaryList}>
        {populatedGroups.map((group) => (
          <div className={proficiencyStyles.proficiencySummaryGroup} key={group.kind}>
            <Text className={overviewStyles.metricLabel}>{group.label}</Text>
            <Text className={proficiencyStyles.proficiencySummaryValues}>
              {group.items.map(formatProficiencySummaryLabel).join(', ')}
            </Text>
          </div>
        ))}
        {!populatedGroups.length ? (
          <Text className={panelStyles.muted}>No proficiencies are currently available.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetOverviewFacts({
  openPanel,
  sheet
}: {
  openPanel?: OpenSheetPanel
  sheet: CharacterSheet
}) {
  return (
    <section className={overviewStyles.tabletOverviewGrid} aria-label='Overview facts'>
      <CharacterSheetSavingThrowsPanel
        openPanel={openPanel}
        savingThrows={sheet.overview.savingThrows}
      />
      <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
      <CharacterSheetDefensesPanel openPanel={openPanel} sheet={sheet} />
      <CharacterSheetProficiencySummary openPanel={openPanel} sheet={sheet} />
    </section>
  )
}

export function CharacterSheetOverview({
  openPanel,
  sheet,
  showDefenses = true
}: {
  openPanel?: OpenSheetPanel
  sheet: CharacterSheet
  showDefenses?: boolean
}) {
  return (
    <section className={overviewStyles.overviewLayout} aria-labelledby='character-sheet-overview'>
      <h2 id='character-sheet-overview' className={coreStyles.visuallyHidden}>
        Overview
      </h2>
      <div className={overviewStyles.playSheetGrid}>
        <div className={overviewStyles.overviewLeftRail}>
          <CharacterSheetSavingThrowsPanel
            openPanel={openPanel}
            savingThrows={sheet.overview.savingThrows}
          />
          <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
          {showDefenses ? (
            <CharacterSheetDefensesPanel openPanel={openPanel} sheet={sheet} />
          ) : null}
          <CharacterSheetProficiencySummary openPanel={openPanel} sheet={sheet} />
        </div>
        <CharacterSheetSkillsPanel
          abilities={sheet.overview.abilities}
          openPanel={openPanel}
          skills={sheet.overview.skills}
        />
        <div className={overviewStyles.playAreaStack}>
          <CharacterSheetOverviewPlayArea sheet={sheet} />
        </div>
      </div>
    </section>
  )
}
