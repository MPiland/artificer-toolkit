import { Button, Checkbox, CloseButton, Drawer, Popover, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Coffee, Heart, Minus, Moon, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CharacterRestPreviewRequestDto, CharacterRestPreviewResponseDto } from '#app/lib/api'
import { useCharacterRestPreviewMutation } from '#app/data/characters/mutations'
import * as styles from './characterSheet.css'
import * as restStyles from './characterSheetRest.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'
import { formatCompanionRecovery, formatRestRecoveryLabels } from './characterSheetRest.utils'
import * as inspectorStyles from './panels/characterSheetInspector.css'

export function CharacterSheetRestControl({
  opened,
  onClose,
  onOpen,
  pending,
  restKind,
  sheet,
  submitCommand
}: CharacterSheetSectionProps & {
  opened: boolean
  onClose: () => void
  onOpen: () => void
  restKind: CharacterRestPreviewRequestDto['restKind']
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isMobile = useMediaQuery('(max-width: 48rem)', false)
  const previewMutation = useCharacterRestPreviewMutation(sheet.meta.characterId)
  const [preview, setPreview] = useState<CharacterRestPreviewResponseDto>()
  const [selectedHitDice, setSelectedHitDice] = useState<
    CharacterRestPreviewRequestDto['selectedHitDice']
  >([])
  const [resetMaximumHitPointModifier, setResetMaximumHitPointModifier] = useState(false)
  const [healingMode, setHealingMode] =
    useState<CharacterRestPreviewRequestDto['healingMode']>('AUTOMATIC')
  const [manualHealingAccepted, setManualHealingAccepted] = useState(false)
  const [selectedCompanionInstanceIds, setSelectedCompanionInstanceIds] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string>()
  const [applyError, setApplyError] = useState<string>()
  const title = restKind === 'SHORT' ? 'Short Rest' : 'Long Rest'
  const interactionPending = pending || previewMutation.isPending
  const closeRest = useCallback(() => {
    onClose()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [onClose])

  useEffect(() => {
    if (!opened) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeRest()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeRest, opened])

  async function requestPreview(
    overrides: Partial<CharacterRestPreviewRequestDto> = {}
  ): Promise<CharacterRestPreviewResponseDto | undefined> {
    const request = {
      restKind,
      expectedVersion: sheet.meta.streamVersion,
      selectedHitDice,
      resetMaximumHitPointModifier,
      healingMode,
      manualHealingAccepted,
      selectedCompanionInstanceIds,
      rollEvidence: preview?.rollEvidence,
      requestRoll: false,
      ...overrides
    } satisfies CharacterRestPreviewRequestDto

    setPreviewError(undefined)
    setApplyError(undefined)
    try {
      const nextPreview = await previewMutation.mutateAsync(request)
      setPreview(nextPreview)
      setSelectedHitDice(
        nextPreview.hitDice.flatMap((pool) =>
          pool.selected > 0 ? [{ die: pool.die, count: pool.selected }] : []
        )
      )
      setResetMaximumHitPointModifier(request.resetMaximumHitPointModifier)
      setHealingMode(nextPreview.healingMode)
      setManualHealingAccepted(nextPreview.manualHealingAccepted)
      setSelectedCompanionInstanceIds(
        nextPreview.eligibleCompanions
          .filter((companion) => companion.selected)
          .map((companion) => companion.companionInstanceId)
      )
      return nextPreview
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Rest preview could not be loaded.')
      return undefined
    }
  }

  function openRest() {
    const initialHitDice: CharacterRestPreviewRequestDto['selectedHitDice'] = []
    setPreview(undefined)
    setSelectedHitDice(initialHitDice)
    setResetMaximumHitPointModifier(false)
    setHealingMode('AUTOMATIC')
    setManualHealingAccepted(false)
    setSelectedCompanionInstanceIds([])
    setPreviewError(undefined)
    setApplyError(undefined)
    onOpen()
    void requestPreview({
      selectedHitDice: initialHitDice,
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      rollEvidence: undefined,
      requestRoll: false
    })
  }

  async function completeRest() {
    if (!preview) return

    setApplyError(undefined)
    const succeeded = await submitCommand({
      type: 'COMPLETE_REST',
      restKind,
      previewFingerprint: preview.previewFingerprint,
      selectedHitDice,
      resetMaximumHitPointModifier,
      healingMode,
      manualHealingAccepted,
      selectedCompanionInstanceIds,
      rollEvidence: preview.rollEvidence,
      expectedVersion: preview.streamVersion
    })

    if (succeeded) {
      closeRest()
      return
    }

    setApplyError('Rest could not be completed. Review the current Sheet and refresh the preview.')
  }

  function changeHitDie(die: number, count: number) {
    const nextSelections = [
      ...selectedHitDice.filter((selection) => selection.die !== die),
      ...(count > 0 ? [{ die, count }] : [])
    ].sort((left, right) => right.die - left.die)
    setSelectedHitDice(nextSelections)
    void requestPreview({
      selectedHitDice: nextSelections,
      rollEvidence: undefined,
      requestRoll: false,
      manualHealingAccepted: false
    })
  }

  const trigger = (
    <Button
      className={`${styles.compactActionControl} ${styles.restActionButton}`}
      aria-expanded={opened}
      aria-haspopup='dialog'
      disabled={pending}
      leftSection={
        <span className={styles.restActionIcon}>
          {restKind === 'SHORT' ? (
            <Coffee aria-hidden='true' size={14} />
          ) : (
            <Moon aria-hidden='true' size={14} />
          )}
        </span>
      }
      ref={triggerRef}
      size='xs'
      variant='default'
      onClick={() => {
        if (opened) {
          closeRest()
        } else {
          openRest()
        }
      }}
    >
      {title}
    </Button>
  )

  const previewBody = preview ? (
    <div className={restStyles.scrollOwner} aria-busy={interactionPending}>
      <Text className={restStyles.description}>
        {restKind === 'SHORT'
          ? 'Choose hit dice, then review the recovery before applying it.'
          : 'Review the full recovery before applying it.'}
      </Text>

      <div className={restStyles.vitals}>
        <div className={restStyles.vital}>
          <Text className={restStyles.label}>Current HP</Text>
          <Text className={restStyles.value}>
            {preview.hitPoints.current} / {preview.hitPoints.maximum}
          </Text>
        </div>
        <div className={restStyles.vital}>
          <Text className={restStyles.label}>Temp HP</Text>
          <Text className={restStyles.value}>{preview.hitPoints.temporary}</Text>
        </div>
        <div className={restStyles.vital}>
          <Text className={restStyles.label}>Missing</Text>
          <Text className={restStyles.value}>{preview.hitPoints.missing} HP</Text>
        </div>
      </div>

      <fieldset className={restStyles.section}>
        <legend className={restStyles.sectionTitle}>Recovery Options</legend>
        <div className={restStyles.options}>
          <Checkbox
            checked={resetMaximumHitPointModifier}
            disabled={interactionPending || !preview.hitPoints.canResetMaximumHitPointModifier}
            label='Reset Maximum HP changes during this rest'
            onChange={(event) => {
              const checked = event.currentTarget.checked
              setResetMaximumHitPointModifier(checked)
              void requestPreview({ resetMaximumHitPointModifier: checked })
            }}
          />
          {restKind === 'SHORT' ? (
            <Checkbox
              checked={healingMode === 'AUTOMATIC'}
              disabled={interactionPending}
              label='Automatically apply healing with dice result'
              onChange={(event) => {
                const nextMode = event.currentTarget.checked ? 'AUTOMATIC' : 'MANUAL'
                setHealingMode(nextMode)
                setManualHealingAccepted(false)
                void requestPreview({
                  healingMode: nextMode,
                  manualHealingAccepted: false
                })
              }}
            />
          ) : null}
        </div>
      </fieldset>

      {restKind === 'SHORT' ? (
        <fieldset className={restStyles.section}>
          <legend className={restStyles.sectionTitle}>Spend Hit Dice</legend>
          <div className={restStyles.sectionHeading}>
            <Text className={restStyles.sectionMeta}>
              {selectedHitDice.reduce((total, selection) => total + selection.count, 0)} selected
            </Text>
          </div>
          <div className={restStyles.hitDiceList}>
            {preview.hitDice.map((pool) => {
              const selected =
                selectedHitDice.find((selection) => selection.die === pool.die)?.count ?? 0
              const classLabel = pool.classLabels.join(' / ')
              const modifierLabel =
                pool.constitutionModifier >= 0
                  ? `+${pool.constitutionModifier}`
                  : String(pool.constitutionModifier)

              return (
                <div className={restStyles.hitDieRow} key={pool.die}>
                  <div className={restStyles.hitDieIdentity}>
                    <Text className={restStyles.hitDieName}>
                      {classLabel} d{pool.die}
                    </Text>
                    <Text className={restStyles.hitDieMeta}>
                      {pool.remaining} of {pool.total} available · adds {modifierLabel} CON
                    </Text>
                  </div>
                  <div
                    className={restStyles.stepper}
                    role='group'
                    aria-label={`Selected d${pool.die} hit dice`}
                  >
                    <Button
                      className={restStyles.stepperButton}
                      aria-label={`Remove one d${pool.die} hit die`}
                      disabled={interactionPending || selected === 0}
                      size='xs'
                      variant='default'
                      onClick={() => changeHitDie(pool.die, selected - 1)}
                    >
                      <Minus aria-hidden='true' size={14} />
                    </Button>
                    <Text className={restStyles.stepperValue}>{selected}</Text>
                    <Button
                      className={restStyles.stepperButton}
                      aria-label={`Add one d${pool.die} hit die`}
                      disabled={interactionPending || selected >= pool.remaining}
                      size='xs'
                      variant='default'
                      onClick={() => changeHitDie(pool.die, selected + 1)}
                    >
                      <Plus aria-hidden='true' size={14} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {restKind === 'SHORT' ? (
        <div className={restStyles.diceAction}>
          <Button
            className={restStyles.diceButton}
            disabled={interactionPending || selectedHitDice.length === 0}
            loading={previewMutation.isPending}
            rightSection={<Heart aria-hidden='true' size={15} />}
            variant='default'
            onClick={() =>
              void requestPreview({
                requestRoll: true,
                rollEvidence: undefined,
                manualHealingAccepted: false
              })
            }
          >
            {preview.canonicalExpression ?? 'Choose hit dice'}
          </Button>
        </div>
      ) : null}

      {healingMode === 'MANUAL' && preview.rollEvidence && !manualHealingAccepted ? (
        <Button
          className={restStyles.actionButton}
          disabled={interactionPending}
          variant='default'
          onClick={() => {
            setManualHealingAccepted(true)
            void requestPreview({ manualHealingAccepted: true })
          }}
        >
          Stage {preview.stagedHealing} HP healing
        </Button>
      ) : null}

      {preview.eligibleCompanions.length ? (
        <fieldset className={restStyles.section}>
          <legend className={restStyles.sectionTitle}>Companion Recovery</legend>
          <div className={restStyles.companionList}>
            {preview.eligibleCompanions.map((companion) => (
              <Checkbox
                checked={selectedCompanionInstanceIds.includes(companion.companionInstanceId)}
                description={formatCompanionRecovery(companion)}
                disabled={interactionPending}
                key={companion.companionInstanceId}
                label={companion.label}
                onChange={(event) => {
                  const selected = event.currentTarget.checked
                  const nextIds = selected
                    ? [...selectedCompanionInstanceIds, companion.companionInstanceId]
                    : selectedCompanionInstanceIds.filter(
                        (instanceId) => instanceId !== companion.companionInstanceId
                      )
                  setSelectedCompanionInstanceIds(nextIds)
                  void requestPreview({ selectedCompanionInstanceIds: nextIds })
                }}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className={restStyles.recoverySummary}>
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Roll status</Text>
          <Text className={restStyles.recoveryValue}>
            {restKind === 'LONG'
              ? 'No roll needed'
              : preview.rollEvidence
                ? `${preview.rollEvidence.total} rolled`
                : selectedHitDice.length
                  ? 'Ready to roll'
                  : 'No hit dice selected'}
          </Text>
        </div>
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Healing</Text>
          <Text className={restStyles.recoveryValue}>
            {preview.stagedHealing > 0
              ? `${preview.stagedHealing} HP staged`
              : `${preview.hitPoints.missing} HP missing`}
          </Text>
        </div>
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Automatic recovery</Text>
          <Text className={restStyles.recoveryValue}>
            {formatRestRecoveryLabels(preview.automaticRecoveries)}
          </Text>
        </div>
        <Text className={restStyles.note}>
          {restKind === 'SHORT'
            ? 'Temp HP is unchanged. The roll and selected recoveries commit with the rest.'
            : 'Current HP, Temp HP, hit dice, exhaustion, and selected recoveries commit together.'}
        </Text>
      </div>

      <Text className={restStyles.liveRegion} aria-live='polite'>
        {previewMutation.isPending
          ? 'Updating rest preview.'
          : preview.rollEvidence
            ? `${preview.rollEvidence.total} rolled. ${preview.stagedHealing} hit points staged.`
            : ''}
      </Text>
      {previewError ? (
        <Text className={restStyles.error} role='alert'>
          {previewError}
        </Text>
      ) : null}
      {applyError ? (
        <Text className={restStyles.error} role='alert'>
          {applyError}
        </Text>
      ) : null}
      <div className={restStyles.actions}>
        {applyError ? (
          <Button
            className={restStyles.actionButton}
            disabled={interactionPending}
            variant='default'
            onClick={() => void requestPreview()}
          >
            Refresh preview
          </Button>
        ) : null}
        <Button
          className={restStyles.actionButton}
          disabled={pending}
          variant='default'
          onClick={closeRest}
        >
          Cancel
        </Button>
        <Button
          className={restStyles.actionButton}
          disabled={interactionPending || !preview.canApply}
          loading={pending}
          onClick={() => void completeRest()}
        >
          Take {title}
        </Button>
      </div>
    </div>
  ) : (
    <div className={restStyles.scrollOwner} aria-busy={previewMutation.isPending}>
      <Text className={restStyles.description}>
        {previewMutation.isPending ? 'Preparing rest preview…' : 'Rest preview is unavailable.'}
      </Text>
      {previewError ? (
        <>
          <Text className={restStyles.error} role='alert'>
            {previewError}
          </Text>
          <Button
            className={restStyles.actionButton}
            disabled={previewMutation.isPending}
            variant='default'
            onClick={() => void requestPreview()}
          >
            Refresh preview
          </Button>
        </>
      ) : null}
    </div>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          classNames={{
            body: inspectorStyles.drawerBody,
            content: inspectorStyles.drawerContent,
            header: inspectorStyles.drawerHeader,
            title: inspectorStyles.drawerTitle
          }}
          closeButtonProps={{
            'aria-label': `Close ${title.toLowerCase()} preview`,
            className: restStyles.closeButton
          }}
          opened={opened}
          overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
          position='bottom'
          size='min(48rem, calc(100dvh - 3.5rem))'
          title={title}
          onClose={closeRest}
        >
          <div className={restStyles.drawerBody}>{previewBody}</div>
        </Drawer>
      </>
    )
  }

  return (
    <Popover
      hideDetached={false}
      opened={opened}
      position='bottom-end'
      trapFocus
      transitionProps={{ duration: 0 }}
      width={420}
      withinPortal
      onChange={(nextOpened) => {
        if (!nextOpened) closeRest()
      }}
    >
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown
        aria-labelledby={`character-sheet-${restKind.toLowerCase()}-rest-title`}
        className={restStyles.popover}
        role='dialog'
      >
        <div className={restStyles.header}>
          <Text
            className={restStyles.title}
            id={`character-sheet-${restKind.toLowerCase()}-rest-title`}
          >
            {title}
          </Text>
          <CloseButton
            aria-label={`Close ${title.toLowerCase()} preview`}
            className={restStyles.closeButton}
            onClick={closeRest}
          />
        </div>
        {previewBody}
      </Popover.Dropdown>
    </Popover>
  )
}
