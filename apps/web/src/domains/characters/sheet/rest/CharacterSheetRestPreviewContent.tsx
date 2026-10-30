import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Button, Checkbox, Text } from '@mantine/core'
import { Dices, Minus, Plus } from 'lucide-react'
import type {
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import * as coreStyles from '../core/sheetShell.css'
import { CharacterSheetRollDestination } from '../dice/CharacterSheetRollDestination'
import { useCharacterSheetRollDestination } from '../dice/rollContext'
import { CharacterSheetRestRecoverySummary } from './CharacterSheetRestRecoverySummary'
import * as restStyles from './rest.css'
import { formatCompanionRecovery } from './rest.utils'

export function CharacterSheetRestPreviewContent({
  applyError,
  healingMode,
  interactionPending,
  manualHealingAccepted,
  onAcceptManualHealing,
  onChangeCompanionSelection,
  onChangeHealingMode,
  onChangeHitDie,
  onChangeMaximumHitPointReset,
  onRefresh,
  onRequestRoll,
  preview,
  previewError,
  previewPending,
  resetMaximumHitPointModifier,
  restKind,
  selectedCompanionInstanceIds,
  selectedHitDice,
  sheet
}: {
  applyError: string | undefined
  healingMode: CharacterRestPreviewRequestDto['healingMode']
  interactionPending: boolean
  manualHealingAccepted: boolean
  onAcceptManualHealing: () => void
  onChangeCompanionSelection: (companionInstanceId: string, selected: boolean) => void
  onChangeHealingMode: (mode: CharacterRestPreviewRequestDto['healingMode']) => void
  onChangeHitDie: (die: number, count: number) => void
  onChangeMaximumHitPointReset: (checked: boolean) => void
  onRefresh: () => void
  onRequestRoll: () => void
  preview: CharacterRestPreviewResponseDto | undefined
  previewError: string | undefined
  previewPending: boolean
  resetMaximumHitPointModifier: boolean
  restKind: CharacterRestPreviewRequestDto['restKind']
  selectedCompanionInstanceIds: string[]
  selectedHitDice: CharacterRestPreviewRequestDto['selectedHitDice']
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
}) {
  const rollDestinations = useCharacterSheetRollDestination()
  if (!preview) {
    return (
      <div className={restStyles.scrollOwner} aria-busy={previewPending}>
        <Text className={restStyles.description}>
          {previewPending ? 'Preparing rest preview…' : 'Rest preview is unavailable.'}
        </Text>
        {previewError ? (
          <>
            <Text className={restStyles.error} role='alert'>
              {previewError}
            </Text>
            <Button
              className={restStyles.actionButton}
              disabled={previewPending}
              variant='default'
              onClick={onRefresh}
            >
              Refresh preview
            </Button>
          </>
        ) : null}
      </div>
    )
  }

  return (
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
            className={restStyles.optionRoot}
            description='Your Max HP override remains unchanged.'
            disabled={interactionPending || !preview.hitPoints.canResetMaximumHitPointModifier}
            label='Remove the current Max HP adjustment'
            onChange={(event) => onChangeMaximumHitPointReset(event.currentTarget.checked)}
          />
          {restKind === 'SHORT' ? (
            <Checkbox
              checked={healingMode === 'AUTOMATIC'}
              className={restStyles.optionRoot}
              disabled={interactionPending}
              label='Apply rolled healing automatically'
              onChange={(event) =>
                onChangeHealingMode(event.currentTarget.checked ? 'AUTOMATIC' : 'MANUAL')
              }
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
                      onClick={() => onChangeHitDie(pool.die, selected - 1)}
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
                      onClick={() => onChangeHitDie(pool.die, selected + 1)}
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
          {rollDestinations ? (
            <CharacterSheetRollDestination
              options={rollDestinations.stateRollDestinationOptions}
              value={rollDestinations.stateRollDestination}
              onChange={rollDestinations.setDestination}
            />
          ) : null}
          <Button
            className={restStyles.diceButton}
            disabled={interactionPending || selectedHitDice.length === 0}
            leftSection={<Dices aria-hidden='true' size={16} />}
            variant='default'
            onClick={onRequestRoll}
          >
            {preview.canonicalExpression
              ? `Roll ${preview.canonicalExpression}`
              : 'Choose hit dice to roll'}
          </Button>
        </div>
      ) : null}

      {healingMode === 'MANUAL' && preview.rollEvidence && !manualHealingAccepted ? (
        <Button
          className={restStyles.actionButton}
          disabled={interactionPending}
          variant='default'
          onClick={onAcceptManualHealing}
        >
          Use {preview.stagedHealing} HP healing
        </Button>
      ) : null}

      {preview.eligibleCompanions.length ? (
        <fieldset className={restStyles.section}>
          <legend className={restStyles.sectionTitle}>Companion Recovery</legend>
          <div className={restStyles.companionList}>
            {preview.eligibleCompanions.map((companion) => (
              <Checkbox
                checked={selectedCompanionInstanceIds.includes(companion.companionInstanceId)}
                className={restStyles.optionRoot}
                description={formatCompanionRecovery(companion)}
                disabled={interactionPending}
                key={companion.companionInstanceId}
                label={companion.label}
                onChange={(event) =>
                  onChangeCompanionSelection(
                    companion.companionInstanceId,
                    event.currentTarget.checked
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <CharacterSheetRestRecoverySummary
        preview={preview}
        restKind={restKind}
        selectedHitDice={selectedHitDice}
        sheet={sheet}
      />

      <Text className={coreStyles.visuallyHidden} aria-atomic='true' aria-live='polite'>
        {previewPending
          ? 'Updating rest preview.'
          : preview.rollEvidence
            ? `${preview.rollEvidence.total} rolled. ${preview.stagedHealing} hit points selected.`
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
    </div>
  )
}
