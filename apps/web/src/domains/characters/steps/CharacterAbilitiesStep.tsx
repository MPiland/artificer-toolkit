import { Alert, Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import { withForm } from '#forms'
import { AppSelect } from '#ui/primitives/Select'
import {
  abilityCodes,
  abilityMethodOptions,
  abilityOptions,
  cacheActiveAbilityIntent,
  createFallbackCharacterFormValues,
  getCachedAbilityIntent,
  hitpointMethodOptions,
  isCharacterAbilityCode,
  pointBuyOptions,
  standardArrayOptions
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterFormValues } from '../characterBuilder.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

type AbilityAssignment = CharacterFormValues['intent']['abilities']['assignments'][number]

type HitpointLevel = CharacterFormValues['intent']['hitpoints']['levels'][number]

export const CharacterAbilitiesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterAbilities({ form, payload, readOnly }) {
    const abilityMethod = payload.character.intent.abilities.method
    const assignmentOptions = abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
      ? pointBuyOptions
      : standardArrayOptions
    const requiredLevels = Math.max(payload.resolution.summary.totalLevel, 1)

    return (
      <section className={styles.section} aria-labelledby='character-abilities-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-abilities-title' className={styles.sectionTitle}>Abilities & hit points</h3>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldSpan6}>
            <form.AppField name='intent.abilities'>
              {(field) => (
                <AppSelect
                  label='Ability Method'
                  data={abilityMethodOptions}
                  value={field.state.value.method}
                  disabled={readOnly}
                  onChange={(value) => {
                    if (!value) return
                    const cache = cacheActiveAbilityIntent(form.state.values.builderIntent?.abilities, field.state.value)

                    field.handleChange(getCachedAbilityIntent(cache, value))
                    form.setFieldValue('builderIntent.abilities', {
                      ...cache,
                      activeMethod: value
                    })
                  }}
                />
              )}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='intent.hitpoints.method'>
              {(field) => (
                <field.SelectField
                  label='Hit Point Method'
                  data={hitpointMethodOptions}
                  required
                  readOnly={readOnly}
                />
              )}
            </form.AppField>
          </div>
        </div>
        {abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
          ? (
              <Alert color='yellow'>
                Manual roll provenance is preserved by the schema, but the MVP builder currently records finalized
                ability assignments through standard array or point buy.
              </Alert>
            )
          : (
              <form.AppField name='intent.abilities.assignments' mode='array'>
                {(field) => {
                  const rows = field.state.value ?? []

                  return (
                    <Stack gap='md' className={styles.inlinePanel}>
                      <Group justify='space-between'>
                        <Text fw={700}>Ability assignments</Text>
                        {!readOnly
                          ? (
                              <Button
                                type='button'
                                variant='default'
                                onClick={() => field.handleChange(createDefaultAbilityAssignments())}
                              >
                                Fill Six Abilities
                              </Button>
                            )
                          : null}
                      </Group>
                      {rows.length === 0
                        ? <Text c='dimmed'>No ability scores assigned yet.</Text>
                        : rows.map((row, index) => (
                            <Group key={`${row.ability}-${index}`} align='flex-end'>
                              <AppSelect
                                label='Ability'
                                data={abilityOptions}
                                value={row.ability}
                                disabled={readOnly}
                                onChange={(value) => {
                                  if (!value || !isCharacterAbilityCode(value)) return
                                  field.replaceValue(index, {
                                    ...row,
                                    ability: value
                                  })
                                }}
                              />
                              <AppSelect
                                label='Score'
                                data={assignmentOptions}
                                value={row.option}
                                disabled={readOnly}
                                onChange={(value) => {
                                  if (!value) return
                                  field.replaceValue(index, {
                                    ...row,
                                    option: value
                                  })
                                }}
                              />
                              {!readOnly
                                ? (
                                    <Button type='button' variant='subtle' color='red' onClick={() => field.removeValue(index)}>
                                      Remove
                                    </Button>
                                  )
                                : null}
                            </Group>
                          ))}
                    </Stack>
                  )
                }}
              </form.AppField>
            )}
        <form.AppField name='intent.hitpoints.levels' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md' className={styles.inlinePanel}>
                <Group justify='space-between'>
                  <Text fw={700}>Hit point entries</Text>
                  {!readOnly
                    ? (
                        <Button
                          type='button'
                          variant='default'
                          onClick={() => field.handleChange(createDefaultHitpointLevels(rows, requiredLevels))}
                        >
                          Sync Levels
                        </Button>
                      )
                    : null}
                </Group>
                {rows.length === 0
                  ? <Text c='dimmed'>No hit point levels have been added yet.</Text>
                  : rows.map((row, index) => (
                      <Group key={`hp-${row.level}-${index}`} align='flex-end'>
                        <NumberInput label='Level' value={row.level} readOnly />
                        <NumberInput
                          label='Hit Points'
                          min={1}
                          value={row.value}
                          disabled={readOnly}
                          onChange={(value) => {
                            field.replaceValue(index, {
                              ...row,
                              value: typeof value === 'number' ? value : 1
                            })
                          }}
                        />
                      </Group>
                    ))}
              </Stack>
            )
          }}
        </form.AppField>
      </section>
    )
  }
})

function createDefaultAbilityAssignments(): AbilityAssignment[] {
  return abilityCodes.map((ability, index) => ({
    ability,
    option: standardArrayOptions[index]?.value ?? '8'
  }))
}

function createDefaultHitpointLevels(rows: HitpointLevel[], requiredLevels: number): HitpointLevel[] {
  return Array.from({ length: requiredLevels }, (_, index) => {
    const level = index + 1
    return rows.find((row) => row.level === level) ?? {
      level,
      value: level === 1 ? 8 : 5
    }
  })
}
