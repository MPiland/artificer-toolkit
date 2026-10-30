import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { useRef, useState } from 'react'
import type {
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { useCharacterRestPreviewMutation } from '#app/data/characters/mutations'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { useCharacterSheetRoll, useCharacterSheetRollPresentation } from '../dice/rollContext'

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
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  submitCommand: SubmitSheetCommand
}) {
  const previewMutation = useCharacterRestPreviewMutation(
    sheet.meta.characterId,
    sheet.meta.campaignId
  )
  const previewRequestSequence = useRef(0)
  const rolls = useCharacterSheetRoll()
  const rollPresentation = useCharacterSheetRollPresentation()
  const [preview, setPreview] = useState<CharacterRestPreviewResponseDto>()
  const [selectedHitDice, setSelectedHitDice] = useState<
    CharacterRestPreviewRequestDto['selectedHitDice']
  >([])
  const [resetMaximumHitPointModifier, setResetMaximumHitPointModifier] = useState(false)
  const [healingMode, setHealingMode] =
    useState<CharacterRestPreviewRequestDto['healingMode']>('AUTOMATIC')
  const [manualHealingAccepted, setManualHealingAccepted] = useState(false)
  const [selectedCompanionInstanceIds, setSelectedCompanionInstanceIds] = useState<string[]>([])
  const [rollId, setRollId] = useState<string>()
  const [previewError, setPreviewError] = useState<string>()
  const [applyError, setApplyError] = useState<string>()
  const interactionPending =
    pending ||
    previewMutation.isPending ||
    Boolean(rolls?.pending) ||
    Boolean(rollPresentation?.presentationPending)

  async function requestPreview(
    overrides: Partial<CharacterRestPreviewRequestDto> = {}
  ): Promise<CharacterRestPreviewResponseDto | undefined> {
    const requestSequence = ++previewRequestSequence.current
    const request = {
      restKind,
      expectedVersion: sheet.meta.streamVersion,
      selectedHitDice,
      resetMaximumHitPointModifier,
      healingMode,
      manualHealingAccepted,
      selectedCompanionInstanceIds,
      rollId,
      rollEvidence: preview?.rollEvidence,
      requestRoll: false,
      ...overrides
    } satisfies CharacterRestPreviewRequestDto

    setPreviewError(undefined)
    setApplyError(undefined)
    try {
      const nextPreview = await previewMutation.mutateAsync(request)
      if (requestSequence !== previewRequestSequence.current) return undefined
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
      if (requestSequence === previewRequestSequence.current) {
        setPreviewError('Rest preview could not be updated. Refresh the preview and try again.')
      }
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
    setRollId(undefined)
    setPreviewError(undefined)
    setApplyError(undefined)
    onOpen()
    void requestPreview({
      selectedHitDice: initialHitDice,
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      rollId: undefined,
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
      rollId,
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
    setRollId(undefined)
    void requestPreview({
      selectedHitDice: nextSelections,
      rollId: undefined,
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

  async function requestRoll() {
    if (!rolls || !preview?.canonicalExpression) {
      setPreviewError('The dice roller is not available. Close the rest panel and try again.')
      return
    }

    setRollId(undefined)
    setPreview(undefined)
    void requestPreview({
      rollId: undefined,
      rollEvidence: undefined,
      requestRoll: false,
      manualHealingAccepted: false
    })
    const rollRequestSequence = previewRequestSequence.current
    const roll = await rolls.executeRoll({
      expression: preview.canonicalExpression,
      source: {
        kind: 'HIT_DIE',
        label: `${restKind === 'SHORT' ? 'Short' : 'Long'} rest hit dice`
      }
    })
    if (!roll || rollRequestSequence !== previewRequestSequence.current) return

    const terms = selectedHitDice.flatMap((selection) => {
      const pool = preview.hitDice.find((candidate) => candidate.die === selection.die)
      const rolled = roll.evidence.terms.find((candidate) => candidate.die === selection.die)
      if (!pool || !rolled) return []
      return [
        {
          die: selection.die,
          count: selection.count,
          modifierPerDie: pool.constitutionModifier,
          rolls: rolled.rolls
        }
      ]
    })
    if (terms.length !== selectedHitDice.length) {
      setPreviewError('The hit-die result did not match the selected dice. Try the roll again.')
      return
    }

    const nextPreview = await requestPreview({
      requestRoll: false,
      rollId: roll.id,
      rollEvidence: {
        expression: roll.normalizedExpression,
        terms,
        total: roll.evidence.total
      },
      manualHealingAccepted: false
    })
    if (nextPreview) setRollId(roll.id)
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

  function cancelPreview() {
    previewRequestSequence.current += 1
    setRollId(undefined)
    if (rollPresentation?.presentationPending) rollPresentation.dismissRoll(true)
  }

  return {
    acceptManualHealing,
    applyError,
    changeCompanionSelection,
    changeHealingMode,
    changeHitDie,
    changeMaximumHitPointReset,
    cancelPreview,
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
