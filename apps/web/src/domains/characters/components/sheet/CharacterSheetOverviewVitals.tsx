import { Button, CloseButton, Drawer, NumberInput, Popover, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import { CharacterSheetRestControl } from './CharacterSheetRestControl'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { formatSigned, toNumber } from './characterSheet.utils'
import { formatHitDiceSummary } from './characterSheetOverview.utils'
import * as inspectorStyles from './panels/characterSheetInspector.css'

const hpFieldClassNames = {
  root: inputStyles.root,
  label: inputStyles.label,
  description: inputStyles.description,
  required: inputStyles.required,
  input: inputStyles.input
}

function CharacterSheetHpControls({
  pending,
  sheet,
  submitCommand,
  version
}: CharacterSheetSectionProps & { version: number }) {
  const [hitPointDelta, setHitPointDelta] = useState(1)
  const [tempHitPoints, setTempHitPoints] = useState(sheet.overview.tempHitPoints)
  const [maxOverride, setMaxOverride] = useState<string | number>(
    sheet.overview.maxHitPointsOverride ?? ''
  )
  const [maxModifier, setMaxModifier] = useState<string | number>(
    sheet.overview.maxHitPointsModifier
  )
  const [settingsError, setSettingsError] = useState(false)
  const [modifierError, setModifierError] = useState(false)
  const lastSubmittedSettings = useRef({
    temp: sheet.overview.tempHitPoints,
    maxOverride: sheet.overview.maxHitPointsOverride
  })
  const lastSubmittedModifier = useRef(sheet.overview.maxHitPointsModifier)

  const normalizedMaxOverride = maxOverride === '' ? null : toNumber(maxOverride)
  const commitSettings = async () => {
    if (
      tempHitPoints === lastSubmittedSettings.current.temp &&
      normalizedMaxOverride === lastSubmittedSettings.current.maxOverride
    ) {
      return
    }

    setSettingsError(false)
    const succeeded = await submitCommand({
      type: 'SET_HIT_POINTS',
      temp: tempHitPoints,
      maxOverride: normalizedMaxOverride,
      expectedVersion: version
    })

    if (succeeded) {
      lastSubmittedSettings.current = {
        temp: tempHitPoints,
        maxOverride: normalizedMaxOverride
      }
      return
    }

    setTempHitPoints(sheet.overview.tempHitPoints)
    setMaxOverride(sheet.overview.maxHitPointsOverride ?? '')
    setSettingsError(true)
  }

  const commitMaxModifier = async () => {
    const normalizedModifier = toNumber(maxModifier)
    if (normalizedModifier === lastSubmittedModifier.current) return

    setModifierError(false)
    const adjustmentId = sheet.overview.maxHitPointsModifierAdjustmentId
    const succeeded =
      normalizedModifier === 0 && adjustmentId
        ? await submitCommand({
            type: 'REMOVE_SHEET_ADJUSTMENT',
            adjustmentId,
            target: { kind: 'HIT_POINTS' },
            family: 'HIT_POINTS',
            expectedVersion: version
          })
        : await submitCommand({
            type: 'UPSERT_SHEET_ADJUSTMENT',
            adjustment: {
              ...(adjustmentId ? { id: adjustmentId } : {}),
              family: 'HIT_POINTS',
              field: 'MAXIMUM_MODIFIER',
              value: normalizedModifier
            },
            expectedVersion: version
          })

    if (succeeded) {
      lastSubmittedModifier.current = normalizedModifier
      return
    }

    setModifierError(true)
  }

  return (
    <div className={styles.hpControlGrid}>
      <div className={styles.hpDeltaRow}>
        <Button
          className={styles.hpControlTarget}
          color='red'
          disabled={pending || hitPointDelta <= 0}
          onClick={() =>
            submitCommand({
              type: 'ADJUST_HIT_POINTS',
              amount: hitPointDelta,
              mode: 'DAMAGE',
              expectedVersion: version
            })
          }
        >
          Damage
        </Button>
        <NumberInput
          aria-label='Hit point amount'
          classNames={hpFieldClassNames}
          disabled={pending}
          hideControls
          min={0}
          value={hitPointDelta}
          onChange={(value) => setHitPointDelta(toNumber(value))}
        />
        <Button
          className={styles.hpControlTarget}
          disabled={pending || hitPointDelta <= 0}
          variant='default'
          onClick={() =>
            submitCommand({
              type: 'ADJUST_HIT_POINTS',
              amount: hitPointDelta,
              mode: 'HEAL',
              expectedVersion: version
            })
          }
        >
          Heal
        </Button>
      </div>
      <div className={styles.hpSettingsRow}>
        <NumberInput
          classNames={hpFieldClassNames}
          disabled={pending}
          hideControls
          label='Temp HP'
          min={0}
          value={tempHitPoints}
          onBlur={commitSettings}
          onChange={(value) => setTempHitPoints(toNumber(value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <NumberInput
          classNames={hpFieldClassNames}
          disabled={pending}
          hideControls
          label='Max HP adjustment'
          placeholder='0'
          value={maxModifier}
          onBlur={commitMaxModifier}
          onChange={setMaxModifier}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <NumberInput
          classNames={hpFieldClassNames}
          disabled={pending}
          hideControls
          label='Max HP override'
          min={0}
          placeholder={String(sheet.overview.maxHitPoints)}
          value={maxOverride}
          onBlur={commitSettings}
          onChange={setMaxOverride}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
      {settingsError ? (
        <Text className={styles.commandInlineError} role='alert'>
          Hit point settings could not be updated. The sheet was refreshed; try again.
        </Text>
      ) : null}
      {modifierError ? (
        <Text className={styles.commandInlineError} role='alert'>
          Maximum HP adjustment could not be updated. The Sheet was refreshed; try again.
        </Text>
      ) : null}
    </div>
  )
}

export function CharacterSheetOverviewVitals({
  closePanel,
  openPanel,
  overlayEpoch,
  pending,
  sheet,
  showDefenses = false,
  submitCommand
}: CharacterSheetSectionProps & { showDefenses?: boolean }) {
  const version = sheet.meta.streamVersion
  const [hpControlsOpen, setHpControlsOpen] = useState(false)
  const [activeRestKind, setActiveRestKind] = useState<'SHORT' | 'LONG'>()
  const isMobile = useMediaQuery('(max-width: 48rem)', false)
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
  const restActions = (
    <div className={styles.restActionDock} aria-label='Recovery actions'>
      {(['SHORT', 'LONG'] as const).map((restKind) => (
        <CharacterSheetRestControl
          closePanel={closePanel}
          key={restKind}
          opened={activeRestKind === restKind}
          overlayEpoch={overlayEpoch}
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
      ))}
    </div>
  )

  useEffect(() => {
    setHpControlsOpen(false)
    setActiveRestKind(undefined)
  }, [overlayEpoch])

  return (
    <>
      <section className={styles.combatPanel} aria-labelledby='character-sheet-vitals'>
        <h2 id='character-sheet-vitals' className={styles.visuallyHidden}>
          Combat facts and hit points
        </h2>
        <div className={styles.combatSummaryCard}>
          <div className={styles.combatFactGrid}>
            {primaryFacts.map((fact) =>
              fact.label.toLowerCase() === 'speed' ? (
                <button
                  className={`${styles.combatFact} ${styles.combatFactButton} ${styles.sheetInspectorTrigger}`}
                  disabled={!openPanel}
                  key={`${fact.label}:${fact.value}`}
                  type='button'
                  onClick={() => openPanel?.({ kind: 'MOVEMENT' })}
                >
                  <Text className={styles.metricLabel}>
                    <span className={styles.combatFactDesktopLabel}>{fact.label}</span>
                    <span className={styles.combatFactMobileLabel}>
                      {'mobileLabel' in fact ? fact.mobileLabel : fact.label}
                    </span>
                  </Text>
                  <Text className={styles.metricValue}>{fact.value}</Text>
                </button>
              ) : (
                <div className={styles.combatFact} key={`${fact.label}:${fact.value}`}>
                  <Text className={styles.metricLabel}>
                    <span className={styles.combatFactDesktopLabel}>{fact.label}</span>
                    <span className={styles.combatFactMobileLabel}>
                      {'mobileLabel' in fact ? fact.mobileLabel : fact.label}
                    </span>
                  </Text>
                  <Text className={styles.metricValue}>{fact.value}</Text>
                </div>
              )
            )}
          </div>
          {showDefenses ? (
            <div className={styles.desktopDefenseSummary}>
              <button
                className={styles.panelHeadingTrigger}
                disabled={!openPanel}
                type='button'
                onClick={() => openPanel?.({ kind: 'DEFENSES' })}
              >
                <Text className={styles.metricLabel}>Defenses</Text>
                <ChevronRight aria-hidden='true' size={14} />
              </button>
              <div className={styles.desktopDefenseGrid}>
                {defenseGroups.map((group) => {
                  const labels = sheet.reference.defenses
                    .filter((defense) => defense.kind === group.kind)
                    .map((defense) => defense.label)

                  return (
                    <div className={styles.desktopDefenseGroup} key={group.kind}>
                      <Text className={styles.proficiencyMeta}>{group.label}</Text>
                      <Text className={styles.desktopDefenseValue}>
                        {labels.length ? labels.join(', ') : 'None'}
                      </Text>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.hpReadout}>
          <div className={styles.hpTopLine}>
            <Text className={styles.metricLabel}>HP</Text>
            <Text className={styles.hpValue}>
              {sheet.overview.currentHitPoints}
              <span className={styles.hpValueSeparator}>/</span>
              {sheet.overview.maxHitPoints}
            </Text>
          </div>
          <div className={styles.hpMinorFacts}>
            <Text className={styles.hpMinorFact}>
              <span>Temp</span>
              <strong className={styles.hpMinorValue}>{sheet.overview.tempHitPoints || '-'}</strong>
            </Text>
            <Text className={styles.hpMinorFact}>
              <span>Hit Dice</span>
              <strong className={`${styles.hpMinorValue} ${styles.hpHitDiceValue}`}>
                {formatHitDiceSummary(sheet.overview.hitDice)}
              </strong>
            </Text>
          </div>
          <div className={styles.hpActionCluster}>
            {isMobile ? (
              <Button
                className={`${styles.compactActionControl} ${styles.hpManageButton}`}
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
                <span className={styles.hpManageLabel}>Manage HP</span>
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
                    className={`${styles.compactActionControl} ${styles.hpManageButton}`}
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
                    <span className={styles.hpManageLabel}>Manage HP</span>
                  </Button>
                </Popover.Target>
                <Popover.Dropdown
                  aria-labelledby='character-sheet-hp-management-title'
                  className={styles.hpManagementPopover}
                  role='dialog'
                >
                  <div className={styles.hpManagementPopoverHeader}>
                    <Text
                      className={styles.hpManagementPopoverTitle}
                      id='character-sheet-hp-management-title'
                    >
                      Manage Hit Points
                    </Text>
                    <CloseButton
                      aria-label='Close hit point management'
                      onClick={() => setHpControlsOpen(false)}
                    />
                  </div>
                  <CharacterSheetHpControls
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
            body: inspectorStyles.drawerBody,
            content: inspectorStyles.drawerContent,
            header: inspectorStyles.drawerHeader,
            title: inspectorStyles.drawerTitle
          }}
          closeButtonProps={{ 'aria-label': 'Close hit point management' }}
          opened={hpControlsOpen}
          overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
          position='bottom'
          size='21rem'
          title='Manage Hit Points'
          onClose={() => setHpControlsOpen(false)}
        >
          <div className={styles.hpManagementDrawerBody}>
            <CharacterSheetHpControls
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
