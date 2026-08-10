import { Alert, Stack, Text } from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import {
  GUIDED_ABILITY_OPTIONS,
  GUIDED_DURATION_OPTIONS,
  type GuidedSpellDraft
} from '#forms/guided/guidedSimpleEffect.types'
import * as styles from '#forms/guided/guidedAuthoring.css'

export function GuidedSpellReviewScreen({
  canFinalize,
  description,
  draft,
  label,
  level,
  system
}: {
  canFinalize: boolean
  description?: string
  draft: GuidedSpellDraft
  label: string
  level?: number
  system: NonNullable<SystemResponseDto>
}) {
  const typeLabel = system.damageTypes.find((item) => item.id === draft.damageTypeId)?.label
  const conditionLabel = system.conditionTypes.find(
    (item) => item.id === draft.conditionTypeId
  )?.label
  const targetLabel =
    draft.target === 'SELF' ? 'Self' : `One creature within ${draft.targetDistance} feet`
  const saveLabel = draft.saveAbility
    ? (GUIDED_ABILITY_OPTIONS.find((item) => item.value === draft.saveAbility)?.label ??
      draft.saveAbility)
    : 'No saving throw'

  const outcome =
    draft.intent === 'DAMAGE'
      ? `${draft.damageDice} ${typeLabel ?? 'damage'}`
      : draft.intent === 'CONDITION'
        ? `${conditionLabel ?? 'Condition'} for ${
            GUIDED_DURATION_OPTIONS.find((item) => item.value === draft.conditionDuration)?.label
          }`
        : draft.intent === 'HEALING'
          ? `${draft.healingDice} ${draft.temporaryHealing ? 'temporary hit points' : 'hit points'}`
          : `${draft.movementDirection === 'TOWARD_SOURCE' ? 'Pull' : 'Push'} ${draft.movementAmount} feet`

  return (
    <Stack gap='lg'>
      {!canFinalize ? (
        <Alert color='yellow'>
          Activation is not ready yet. Go Back to fix details or switch to advanced authoring.
        </Alert>
      ) : null}
      <dl className={styles.summary}>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Name</dt>
          <dd className={styles.summaryValue}>{label || 'Untitled Spell'}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Level</dt>
          <dd className={styles.summaryValue}>{formatSpellLevel(level)}</dd>
        </div>
        {description ? (
          <div className={styles.summaryRow}>
            <dt className={styles.summaryLabel}>Description</dt>
            <dd className={styles.summaryValue}>{description}</dd>
          </div>
        ) : null}
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Outcome</dt>
          <dd className={styles.summaryValue}>{outcome}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Target</dt>
          <dd className={styles.summaryValue}>{targetLabel}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Save</dt>
          <dd className={styles.summaryValue}>{saveLabel}</dd>
        </div>
      </dl>
      <Text c='dimmed'>
        Save Draft keeps your work in progress. Review the details before activating it for play.
      </Text>
    </Stack>
  )
}

function formatSpellLevel(level: number | undefined): string {
  return level === 0 ? 'Cantrip' : `Level ${level ?? 0}`
}
