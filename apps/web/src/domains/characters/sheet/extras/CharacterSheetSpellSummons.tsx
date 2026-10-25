import type { CharacterSheetExtrasSliceDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Badge, Button, NumberInput, Text } from '@mantine/core'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as extrasStyles from './extras.css'

type SpellSummon = Extract<
  CharacterSheetExtrasSliceDto['extras']['items'][number],
  { kind: 'SPELL_SUMMON' }
>

/** Creatures a spell cast from the Sheet conjured (D190): tracked here until they end. */
export function CharacterSheetSpellSummons({
  expectedVersion,
  pending,
  submitCommand,
  summons
}: {
  expectedVersion: number
  pending: boolean
  submitCommand: SubmitSheetCommand
  summons: SpellSummon[]
}) {
  if (!summons.length) return null

  return (
    <section className={extrasStyles.extraGroup} aria-label='Summons'>
      <Text className={extrasStyles.extraGroupTitle} component='h3'>
        Summons
      </Text>
      <div className={extrasStyles.extraGroupRows}>
        {summons.map(({ hitPoints, ...summon }) => (
          <div className={extrasStyles.summonRow} key={summon.id} data-summon={summon.id}>
            <span className={extrasStyles.extraIdentity}>
              <strong>{summon.displayName}</strong>
              {summon.concentration ? (
                <Badge size='xs' variant='light'>
                  Concentration
                </Badge>
              ) : null}
            </span>
            <span className={extrasStyles.extraStatBlock}>
              <span className={extrasStyles.extraMetric} data-extra-metric='AC'>
                <small className={extrasStyles.extraMetricLabel}>AC</small>
                <strong>{summon.armorClass ?? '-'}</strong>
              </span>
              <span className={extrasStyles.extraMetric} data-extra-metric='Speed'>
                <small className={extrasStyles.extraMetricLabel}>Speed</small>
                <strong>{summon.speedLabel ?? '-'}</strong>
              </span>
              {hitPoints ? (
                <NumberInput
                  aria-label={`${summon.displayName} current hit points`}
                  clampBehavior='strict'
                  defaultValue={hitPoints.current}
                  disabled={pending}
                  hideControls
                  key={hitPoints.current}
                  label={`HP / ${hitPoints.maximum}`}
                  max={hitPoints.maximum}
                  min={0}
                  size='xs'
                  onBlur={(event) => {
                    const currentHitPoints = Number(event.currentTarget.value)
                    if (
                      Number.isInteger(currentHitPoints) &&
                      currentHitPoints !== hitPoints.current
                    )
                      void submitCommand({
                        type: 'UPDATE_SHEET_EXTRA',
                        expectedVersion,
                        extra: { kind: 'SPELL_SUMMON', extraId: summon.id, currentHitPoints }
                      })
                  }}
                />
              ) : null}
              <Button
                disabled={pending}
                size='xs'
                variant='default'
                onClick={() =>
                  void submitCommand({
                    type: 'REMOVE_SHEET_EXTRA',
                    expectedVersion,
                    extra: { kind: 'SPELL_SUMMON', extraId: summon.id }
                  })
                }
              >
                Dismiss
              </Button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
