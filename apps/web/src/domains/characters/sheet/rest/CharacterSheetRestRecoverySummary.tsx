import { Text } from '@mantine/core'
import type { CharacterRestPreviewRequestDto, CharacterRestPreviewResponseDto } from '#app/lib/api'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import * as restStyles from './rest.css'
import { formatRestRecoveryLabels } from './rest.utils'

export function CharacterSheetRestRecoverySummary({
  preview,
  restKind,
  selectedHitDice,
  sheet
}: {
  preview: CharacterRestPreviewResponseDto
  restKind: CharacterRestPreviewRequestDto['restKind']
  selectedHitDice: CharacterRestPreviewRequestDto['selectedHitDice']
  sheet: CharacterSheet
}) {
  return (
    <div className={restStyles.recoverySummary}>
      {restKind === 'SHORT' ? (
        <div className={restStyles.recoveryLine}>
          <Text className={restStyles.recoveryLabel}>Roll status</Text>
          <Text className={restStyles.recoveryValue}>
            {preview.rollEvidence
              ? `${preview.rollEvidence.total} rolled`
              : selectedHitDice.length
                ? 'Ready to roll'
                : 'No hit dice selected'}
          </Text>
        </div>
      ) : null}
      <div className={restStyles.recoveryLine}>
        <Text className={restStyles.recoveryLabel}>Healing</Text>
        <Text className={restStyles.recoveryValue}>
          {restKind === 'LONG'
            ? `Restores to ${preview.hitPoints.maximum} / ${preview.hitPoints.maximum}`
            : preview.stagedHealing > 0
              ? `${preview.stagedHealing} HP staged`
              : `${preview.hitPoints.missing} HP missing`}
        </Text>
      </div>
      {restKind === 'LONG' ? (
        <>
          <div className={restStyles.recoveryLine}>
            <Text className={restStyles.recoveryLabel}>Hit Dice</Text>
            <Text className={restStyles.recoveryValue}>Recover by active rules</Text>
          </div>
          <div className={restStyles.recoveryLine}>
            <Text className={restStyles.recoveryLabel}>Exhaustion</Text>
            <Text className={restStyles.recoveryValue}>
              {sheet.overview.exhaustion.level > sheet.overview.exhaustion.minimumLevel
                ? `Reduces from Level ${sheet.overview.exhaustion.level}`
                : 'No exhaustion to reduce'}
            </Text>
          </div>
        </>
      ) : null}
      <div className={restStyles.recoveryLine}>
        <Text className={restStyles.recoveryLabel}>Also recover</Text>
        <Text className={restStyles.recoveryValue}>
          {formatRestRecoveryLabels(preview.automaticRecoveries)}
        </Text>
      </div>
      <Text className={restStyles.note}>
        {restKind === 'SHORT'
          ? 'Temp HP is unchanged. The roll and selected recoveries commit with the rest.'
          : 'Temp HP clears. Selected companion recoveries commit with the rest.'}
      </Text>
    </div>
  )
}
