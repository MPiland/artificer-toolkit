import { useState } from 'react'
import type { CharacterRestPreviewRequestDto, CharacterRestPreviewResponseDto } from '#app/lib/api'
import { useCharacterRestPreviewMutation } from '#app/data/characters/mutations'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'

export function useCharacterRestPreviewState({
  onComplete,
  onOpen,
  pending,
  restKind,
  sheet,
  submitCommand
}: {
  onComplete: () => void
  onOpen: () => void
  pending: boolean
  restKind: CharacterRestPreviewRequestDto['restKind']
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
}) {
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
  const interactionPending = pending || previewMutation.isPending

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
    } catch {
      setPreviewError('Rest preview could not be updated. Refresh the preview and try again.')
      return undefined
    }
  }

  function startPreview() {
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
      onComplete()
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

  function changeMaximumHitPointReset(checked: boolean) {
    setResetMaximumHitPointModifier(checked)
    void requestPreview({ resetMaximumHitPointModifier: checked })
  }

  function changeHealingMode(nextMode: CharacterRestPreviewRequestDto['healingMode']) {
    setHealingMode(nextMode)
    setManualHealingAccepted(false)
    void requestPreview({
      healingMode: nextMode,
      manualHealingAccepted: false
    })
  }

  function requestRoll() {
    void requestPreview({
      requestRoll: true,
      rollEvidence: undefined,
      manualHealingAccepted: false
    })
  }

  function acceptManualHealing() {
    setManualHealingAccepted(true)
    void requestPreview({ manualHealingAccepted: true })
  }

  function changeCompanionSelection(companionInstanceId: string, selected: boolean) {
    const nextIds = selected
      ? [...selectedCompanionInstanceIds, companionInstanceId]
      : selectedCompanionInstanceIds.filter((instanceId) => instanceId !== companionInstanceId)
    setSelectedCompanionInstanceIds(nextIds)
    void requestPreview({ selectedCompanionInstanceIds: nextIds })
  }

  return {
    acceptManualHealing,
    applyError,
    changeCompanionSelection,
    changeHealingMode,
    changeHitDie,
    changeMaximumHitPointReset,
    completeRest,
    healingMode,
    interactionPending,
    manualHealingAccepted,
    preview,
    previewError,
    previewPending: previewMutation.isPending,
    refreshPreview: requestPreview,
    requestRoll,
    resetMaximumHitPointModifier,
    selectedCompanionInstanceIds,
    selectedHitDice,
    startPreview
  }
}
