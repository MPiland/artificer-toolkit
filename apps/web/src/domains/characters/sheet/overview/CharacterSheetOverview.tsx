import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Text } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import * as coreStyles from '../core/sheetShell.css'
import * as overviewStyles from './overview.css'
import * as proficiencyStyles from './proficiencies.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'
import {
  CharacterSheetSavingThrowsPanel,
  CharacterSheetSkillsPanel
} from './CharacterSheetOverviewProficiencies'
import { formatProficiencySummaryLabel } from './characterSheetOverview.utils'
import type { OpenSheetPanel } from '../core/CharacterSheet.types'

export function CharacterSheetSensesPanel({
  sheet,
  openPanel,
  headingId = 'character-sheet-senses'
}: {
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
  headingId?: string
}) {
  const passiveFacts = sheet.overview.facts.filter((fact) =>
    fact.label.toLowerCase().startsWith('passive')
  )
  const senses = sheet.reference.senses

  return (
    <section className={overviewStyles.overviewPanel} aria-labelledby={headingId}>
      <div className={overviewStyles.overviewPanelHeader}>
        <Text id={headingId} className={proficiencyStyles.proficiencyHeading}>
          Senses
        </Text>
      </div>
      <div className={rowStyles.compactDataList}>
        {passiveFacts.map((fact) => {
          const skill = sheet.overview.skills.find(
            (candidate) =>
              candidate.label.toLowerCase() ===
              fact.label.replace(/^passive\s+/iu, '').toLowerCase()
          )
          return skill && openPanel ? (
            <button
              aria-label={`Inspect ${fact.label}`}
              className={rowStyles.compactDataRowButton}
              key={fact.label}
              type='button'
              onClick={() =>
                openPanel({
                  kind: 'SENSES',
                  entry: { kind: 'PASSIVE', skillId: skill.skillId }
                })
              }
            >
              <Text>{fact.label}</Text>
              <Text fw={800}>{fact.value}</Text>
            </button>
          ) : (
            <div className={rowStyles.compactDataRow} key={fact.label}>
              <Text>{fact.label}</Text>
              <Text fw={800}>{fact.value}</Text>
            </div>
          )
        })}
        {senses.map((sense) =>
          openPanel ? (
            <button
              aria-label={`Inspect ${sense.label}`}
              className={rowStyles.compactDataRowButton}
              key={sense.label}
              type='button'
              onClick={() =>
                openPanel({
                  kind: 'SENSES',
                  entry: { kind: 'SENSE', senseId: sense.senseId }
                })
              }
            >
              <Text>{sense.label}</Text>
              <Text fw={800}>{sense.value}</Text>
            </button>
          ) : (
            <div className={rowStyles.compactDataRow} key={sense.label}>
              <Text>{sense.label}</Text>
              <Text fw={800}>{sense.value}</Text>
            </div>
          )
        )}
        {!passiveFacts.length && !senses.length ? (
          <Text className={panelStyles.muted}>No senses are currently available.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetDefensesPanel({
  sheet,
  openPanel,
  headingId = 'character-sheet-defenses'
}: {
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
  headingId?: string
}) {
  return (
    <section className={overviewStyles.overviewPanel} aria-labelledby={headingId}>
      <div className={overviewStyles.overviewPanelHeader}>
        <button
          className={overviewStyles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'DEFENSES' })}
        >
          <Text id={headingId} className={proficiencyStyles.proficiencyHeading}>
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
  openPanel,
  headingId = 'character-sheet-proficiency-summary'
}: {
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
  headingId?: string
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
      aria-labelledby={headingId}
    >
      <div className={overviewStyles.overviewPanelHeader}>
        <button
          className={overviewStyles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'PROFICIENCIES' })}
        >
          <Text id={headingId} className={proficiencyStyles.proficiencyHeading}>
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
  sheet,
  showDefenses = true
}: {
  openPanel?: OpenSheetPanel
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  showDefenses?: boolean
}) {
  return (
    <section className={overviewStyles.tabletOverviewGrid} aria-label='Overview facts'>
      <CharacterSheetSavingThrowsPanel
        headingId='character-sheet-tablet-saving-throws'
        openPanel={openPanel}
        savingThrows={sheet.overview.savingThrows}
      />
      <CharacterSheetSensesPanel
        headingId='character-sheet-tablet-senses'
        openPanel={openPanel}
        sheet={sheet}
      />
      {showDefenses ? (
        <CharacterSheetDefensesPanel
          headingId='character-sheet-tablet-defenses'
          openPanel={openPanel}
          sheet={sheet}
        />
      ) : null}
      <CharacterSheetProficiencySummary
        headingId='character-sheet-tablet-proficiency-summary'
        openPanel={openPanel}
        sheet={sheet}
      />
    </section>
  )
}

export function CharacterSheetOverview({
  openPanel,
  sheet,
  showDefenses = true,
  tabletSkillsOnly = false
}: {
  openPanel?: OpenSheetPanel
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  showDefenses?: boolean
  tabletSkillsOnly?: boolean
}) {
  return (
    <section className={overviewStyles.overviewLayout} aria-labelledby='character-sheet-overview'>
      <h2 id='character-sheet-overview' className={coreStyles.visuallyHidden}>
        Overview
      </h2>
      <div
        className={clsx(
          overviewStyles.playSheetGrid,
          tabletSkillsOnly && overviewStyles.tabletSkillsOnlyGrid
        )}
      >
        <div
          className={clsx(
            overviewStyles.overviewLeftRail,
            tabletSkillsOnly && overviewStyles.tabletHiddenFacts
          )}
        >
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
      </div>
    </section>
  )
}
