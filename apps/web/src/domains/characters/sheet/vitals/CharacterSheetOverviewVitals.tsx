import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Button, CloseButton, Drawer, Popover, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import type { OpenSheetPanel, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
import { formatHitDiceSummary } from '../overview/characterSheetOverview.utils'
import { CharacterSheetRestControl } from '../rest/CharacterSheetRestControl'
import * as sheetOverlayStyles from '../shared/sheetOverlay.css'
import { CharacterSheetDeathSaves } from './CharacterSheetDeathSaves'
import { CharacterSheetHpEditor } from './CharacterSheetHpEditor'
import * as coreStyles from '../core/sheetShell.css'
import * as overviewStyles from '../overview/overview.css'
import * as proficiencyStyles from '../overview/proficiencies.css'
import * as rowStyles from '../shared/rows.css'
import * as vitalsStyles from './vitals.css'
import { CharacterSheetRollValue } from '../dice/CharacterSheetRollValue'
import { withRollModifier } from '../dice/dice.utils'

export function CharacterSheetOverviewVitals({
  closePanel,
  openPanel,
  overlayEpoch,
  pending,
  sheet,
  showDefenses = false,
  submitCommand
}: {
  closePanel?: () => void
  openPanel?: OpenSheetPanel
  overlayEpoch?: number
  pending: boolean
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  showDefenses?: boolean
  submitCommand: SubmitSheetCommand
}) {
  const version = sheet.meta.streamVersion
  const [hpControlsOpen, setHpControlsOpen] = useState(false)
  const [activeRestKind, setActiveRestKind] = useState<'SHORT' | 'LONG'>()
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const speedFact = sheet.overview.facts.find((fact) => fact.label.toLowerCase() === 'speed')
  const primaryFacts = [
    { label: 'Armor Class', mobileLabel: 'AC', value: String(sheet.overview.armorClass) },
    { label: 'Initiative', mobileLabel: 'Init.', value: formatSigned(sheet.overview.initiative) },
    {
      label: 'Proficiency',
      mobileLabel: 'Prof.',
      value: formatSigned(sheet.overview.proficiencyBonus)
    },
    ...(speedFact ? [speedFact] : [])
  ]
  const defenseGroups = [
    { kind: 'RESISTANCE', label: 'Resistances' },
    { kind: 'IMMUNITY', label: 'Immunities' },
    { kind: 'VULNERABILITY', label: 'Vulnerabilities' }
  ] as const
  const restActions = (['SHORT', 'LONG'] as const).map((restKind) => (
    <CharacterSheetRestControl
      key={restKind}
      opened={activeRestKind === restKind}
      pending={pending}
      restKind={restKind}
      sheet={sheet}
      submitCommand={submitCommand}
      onClose={() => setActiveRestKind(undefined)}
      onOpen={() => {
        setHpControlsOpen(false)
        closePanel?.()
        setActiveRestKind(restKind)
      }}
    />
  ))

  useEffect(() => {
    setHpControlsOpen(false)
    setActiveRestKind(undefined)
  }, [overlayEpoch])

  return (
    <>
      <section className={vitalsStyles.combatPanel} aria-labelledby='character-sheet-vitals'>
        <h2 id='character-sheet-vitals' className={coreStyles.visuallyHidden}>
          Combat facts and hit points
        </h2>
        <div className={vitalsStyles.combatSummaryCard}>
          <div className={vitalsStyles.combatFactGrid}>
            {primaryFacts.map((fact) =>
              fact.label.toLowerCase() === 'speed' ? (
                <button
                  className={`${vitalsStyles.combatFact} ${vitalsStyles.combatFactButton} ${overviewStyles.sheetInspectorTrigger}`}
                  disabled={!openPanel}
                  key={`${fact.label}:${fact.value}`}
                  type='button'
                  onClick={() => openPanel?.({ kind: 'MOVEMENT' })}
                >
                  <Text className={overviewStyles.metricLabel}>
                    <span className={vitalsStyles.combatFactDesktopLabel}>{fact.label}</span>
                    <span className={vitalsStyles.combatFactMobileLabel}>
                      {'mobileLabel' in fact ? fact.mobileLabel : fact.label}
                    </span>
                  </Text>
                  <Text className={overviewStyles.metricValue}>{fact.value}</Text>
                </button>
              ) : (
                <div className={vitalsStyles.combatFact} key={`${fact.label}:${fact.value}`}>
                  <Text className={overviewStyles.metricLabel}>
                    <span className={vitalsStyles.combatFactDesktopLabel}>{fact.label}</span>
                    <span className={vitalsStyles.combatFactMobileLabel}>
                      {'mobileLabel' in fact ? fact.mobileLabel : fact.label}
                    </span>
                  </Text>
                  <Text className={overviewStyles.metricValue} component='div'>
                    {fact.label === 'Initiative' ? (
                      <CharacterSheetRollValue
                        request={{
                          expression: withRollModifier('1d20', sheet.overview.initiative),
                          rollMode: sheet.overview.initiativeRollMode,
                          source: { kind: 'INITIATIVE', label: 'Initiative' }
                        }}
                      >
                        {fact.value}
                      </CharacterSheetRollValue>
                    ) : (
                      fact.value
                    )}
                  </Text>
                </div>
              )
            )}
          </div>
          {showDefenses ? (
            <div className={vitalsStyles.desktopDefenseSummary}>
              <div className={vitalsStyles.desktopDefenseGrid}>
                {defenseGroups.map((group) => {
                  const labels = sheet.reference.defenses
                    .filter((defense) => defense.kind === group.kind)
                    .map((defense) => defense.label)

                  return (
                    <button
                      aria-label={`Manage ${group.label}: ${labels.length ? labels.join(', ') : 'None'}`}
                      className={vitalsStyles.desktopDefenseGroupButton}
                      disabled={!openPanel}
                      key={group.kind}
                      type='button'
                      onClick={() => openPanel?.({ kind: 'DEFENSES' })}
                    >
                      <Text className={proficiencyStyles.proficiencyMeta}>{group.label}</Text>
                      <Text className={vitalsStyles.desktopDefenseValue}>
                        {labels.length ? labels.join(', ') : 'None'}
                      </Text>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className={vitalsStyles.hpCard}>
          <div className={vitalsStyles.hpReadout}>
            <div className={vitalsStyles.hpTopLine}>
              <Text className={overviewStyles.metricLabel}>HP</Text>
              <Text className={vitalsStyles.hpValue}>
                {sheet.overview.currentHitPoints}
                <span className={vitalsStyles.hpValueSeparator}>/</span>
                {sheet.overview.maxHitPoints}
              </Text>
            </div>
            <div className={vitalsStyles.hpMinorFacts}>
              <Text className={vitalsStyles.hpMinorFact}>
                <span>Temp</span>
                <strong className={vitalsStyles.hpMinorValue}>
                  {sheet.overview.tempHitPoints || '-'}
                </strong>
              </Text>
              <Text className={vitalsStyles.hpMinorFact}>
                <span>Hit Dice</span>
                <strong className={`${vitalsStyles.hpMinorValue} ${vitalsStyles.hpHitDiceValue}`}>
                  {formatHitDiceSummary(sheet.overview.hitDice)}
                </strong>
              </Text>
            </div>
          </div>
          <CharacterSheetDeathSaves pending={pending} sheet={sheet} submitCommand={submitCommand} />
          <div className={vitalsStyles.hpActionCluster}>
            {isMobile ? (
              <Button
                className={`${rowStyles.compactActionControl} ${vitalsStyles.hpManageButton}`}
                aria-label='Manage hit points'
                aria-expanded={hpControlsOpen}
                aria-haspopup='dialog'
                disabled={pending}
                size='xs'
                variant='default'
                onClick={() => {
                  setActiveRestKind(undefined)
                  closePanel?.()
                  setHpControlsOpen(true)
                }}
              >
                Manage HP
              </Button>
            ) : (
              <Popover
                hideDetached={false}
                opened={hpControlsOpen}
                position='bottom-end'
                transitionProps={{ duration: 0 }}
                width={420}
                withinPortal
                onChange={setHpControlsOpen}
              >
                <Popover.Target>
                  <Button
                    className={`${rowStyles.compactActionControl} ${vitalsStyles.hpManageButton}`}
                    aria-label='Manage hit points'
                    aria-expanded={hpControlsOpen}
                    aria-haspopup='dialog'
                    disabled={pending}
                    size='xs'
                    variant='default'
                    onClick={() => {
                      setActiveRestKind(undefined)
                      closePanel?.()
                      setHpControlsOpen((current) => !current)
                    }}
                  >
                    Manage HP
                  </Button>
                </Popover.Target>
                <Popover.Dropdown
                  aria-labelledby='character-sheet-hp-management-title'
                  className={vitalsStyles.hpManagementPopover}
                  role='dialog'
                >
                  <div className={vitalsStyles.hpManagementPopoverHeader}>
                    <Text
                      className={vitalsStyles.hpManagementPopoverTitle}
                      id='character-sheet-hp-management-title'
                    >
                      Manage Hit Points
                    </Text>
                    <CloseButton
                      aria-label='Close hit point management'
                      className={coreStyles.sheetOverlayCloseButton}
                      onClick={() => setHpControlsOpen(false)}
                    />
                  </div>
                  <CharacterSheetHpEditor
                    key={version}
                    pending={pending}
                    sheet={sheet}
                    submitCommand={submitCommand}
                    version={version}
                  />
                </Popover.Dropdown>
              </Popover>
            )}
            {restActions}
          </div>
        </div>
      </section>
      {isMobile ? (
        <Drawer
          classNames={{
            body: sheetOverlayStyles.drawerBody,
            content: sheetOverlayStyles.drawerContent,
            header: sheetOverlayStyles.drawerHeader,
            title: sheetOverlayStyles.drawerTitle
          }}
          closeButtonProps={{
            'aria-label': 'Close hit point management',
            className: coreStyles.sheetOverlayCloseButton
          }}
          opened={hpControlsOpen}
          overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
          position='bottom'
          size='21rem'
          title='Manage Hit Points'
          onClose={() => setHpControlsOpen(false)}
        >
          <div className={vitalsStyles.hpManagementDrawerBody}>
            <CharacterSheetHpEditor
              key={version}
              pending={pending}
              sheet={sheet}
              submitCommand={submitCommand}
              version={version}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  )
}
