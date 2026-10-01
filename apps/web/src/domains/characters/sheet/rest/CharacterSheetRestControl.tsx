import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Button } from '@mantine/core'
import { Coffee, Moon } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type { CharacterRestPreviewRequestDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as rowStyles from '../shared/rows.css'
import * as vitalsStyles from '../vitals/vitals.css'
import { CharacterSheetRestOverlay } from './CharacterSheetRestOverlay'
import { CharacterSheetRestPreviewContent } from './CharacterSheetRestPreviewContent'
import * as restStyles from './rest.css'
import { useCharacterRestPreviewState } from './useCharacterRestPreviewState'

export function CharacterSheetRestControl({
  opened,
  onClose,
  onOpen,
  pending,
  restKind,
  sheet,
  submitCommand
}: {
  opened: boolean
  onClose: () => void
  onOpen: () => void
  pending: boolean
  restKind: CharacterRestPreviewRequestDto['restKind']
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  submitCommand: SubmitSheetCommand
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const title = restKind === 'SHORT' ? 'Short Rest' : 'Long Rest'
  const restPreview = useCharacterRestPreviewState({
    onComplete: () => {
      onClose()
      requestAnimationFrame(() => triggerRef.current?.focus())
    },
    onOpen,
    pending,
    restKind,
    sheet,
    submitCommand
  })
  const closeRest = useCallback(() => {
    restPreview.cancelPreview()
    onClose()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [onClose, restPreview])

  const trigger = (
    <Button
      className={`${rowStyles.compactActionControl} ${vitalsStyles.restActionButton}`}
      aria-expanded={opened}
      aria-haspopup='dialog'
      disabled={pending}
      leftSection={
        <span className={vitalsStyles.restActionIcon}>
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
          restPreview.startPreview()
        }
      }}
    >
      {title}
    </Button>
  )

  const actions = restPreview.preview ? (
    <div className={restStyles.actions}>
      {restPreview.applyError ? (
        <Button
          className={`${restStyles.actionButton} ${restStyles.refreshAction}`}
          disabled={restPreview.interactionPending}
          variant='default'
          onClick={() => void restPreview.refreshPreview()}
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
        disabled={restPreview.interactionPending || !restPreview.preview.canApply}
        loading={pending}
        onClick={() => void restPreview.completeRest()}
      >
        Take {title}
      </Button>
    </div>
  ) : null

  return (
    <CharacterSheetRestOverlay
      opened={opened}
      restKind={restKind}
      title={title}
      trigger={trigger}
      onClose={closeRest}
    >
      <div className={restStyles.previewLayout}>
        <CharacterSheetRestPreviewContent
          applyError={restPreview.applyError}
          healingMode={restPreview.healingMode}
          interactionPending={restPreview.interactionPending}
          manualHealingAccepted={restPreview.manualHealingAccepted}
          preview={restPreview.preview}
          previewError={restPreview.previewError}
          previewPending={restPreview.previewPending}
          resetMaximumHitPointModifier={restPreview.resetMaximumHitPointModifier}
          restKind={restKind}
          selectedCompanionInstanceIds={restPreview.selectedCompanionInstanceIds}
          selectedHitDice={restPreview.selectedHitDice}
          sheet={sheet}
          onAcceptManualHealing={restPreview.acceptManualHealing}
          onChangeCompanionSelection={restPreview.changeCompanionSelection}
          onChangeHealingMode={restPreview.changeHealingMode}
          onChangeHitDie={restPreview.changeHitDie}
          onChangeMaximumHitPointReset={restPreview.changeMaximumHitPointReset}
          onRefresh={() => void restPreview.refreshPreview()}
          onRequestRoll={restPreview.requestRoll}
        />
        {actions}
      </div>
    </CharacterSheetRestOverlay>
  )
}
