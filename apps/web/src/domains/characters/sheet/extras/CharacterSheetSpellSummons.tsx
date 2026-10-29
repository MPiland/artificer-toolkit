import type { CharacterSheetExtrasSliceDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Badge, Button, NumberInput, Text } from '@mantine/core'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as extrasStyles from './extras.css'

type SpellSummon = Extract<
  CharacterSheetExtrasSliceDto['extras']['items'][number],
  { kind: 'SPELL_SUMMON' }
>

/**
 * Creatures this Character's spell casts conjured (D190). A Sheet summon is tracked here until it
 * ends; an Encounter summon is its Run actor, read live and changed only in the Encounter.
 */
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
              {summon.actions.length ? (
                <ul
                  className={extrasStyles.summonActions}
                  aria-label={`${summon.displayName} attacks`}
                >
                  {summon.actions.map((action) => (
                    <li key={action.id}>
                      {action.description
                        ? `${action.label} · ${action.description}`
                        : action.label}
                    </li>
                  ))}
                </ul>
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
              {hitPoints && summon.encounterActorId ? (
                <span className={extrasStyles.extraMetric} data-extra-metric='HP'>
                  <small className={extrasStyles.extraMetricLabel}>HP / {hitPoints.maximum}</small>
                  <strong>
                    {hitPoints.temp ? `${hitPoints.current} +${hitPoints.temp}` : hitPoints.current}
                  </strong>
                </span>
              ) : hitPoints ? (
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
              {summon.encounterActorId ? null : (
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
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
