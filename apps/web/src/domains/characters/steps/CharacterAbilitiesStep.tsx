import { Alert, Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { withForm } from '#forms'
import { AppSelect } from '#ui/primitives/Select'
import {
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
import {
  createDefaultAbilityAssignments,
  syncHitpointLevels
} from './CharacterAbilitiesStep.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterAbilitiesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterAbilities({ form, payload, readOnly }) {
    const requiredLevels = Math.max(payload.resolution.summary.totalLevel, 1)

    return (
      <section className={styles.section} aria-labelledby='character-abilities-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-abilities-title' className={styles.sectionTitle}>Abilities & hit points</h3>
        </div>
        <form.AppField name='intent.abilities'>
          {(abilityField) => {
            const abilityMethod = abilityField.state.value.method
            const assignmentOptions = abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
              ? pointBuyOptions
              : standardArrayOptions

            return (
              <>
                <div className={styles.fieldGrid}>
                  <div className={styles.fieldSpan6}>
                    <AppSelect
                      label='Ability Method'
                      data={abilityMethodOptions}
                      value={abilityMethod}
                      disabled={readOnly}
                      onChange={(value) => {
                        if (!value) return
                        const cache = cacheActiveAbilityIntent(form.state.values.builderIntent?.abilities, abilityField.state.value)

                        abilityField.handleChange(getCachedAbilityIntent(cache, value))
                        form.setFieldValue('builderIntent.abilities', {
                          ...cache,
                          activeMethod: value
                        })
                      }}
                    />
                  </div>
                  <div className={styles.fieldSpan6}>
                    <form.AppField name='intent.hitpoints'>
                      {(field) => (
                        <AppSelect
                          label='Hit Point Method'
                          data={hitpointMethodOptions}
                          value={field.state.value.method}
                          required
                          disabled={readOnly}
                          onChange={(value) => {
                            if (!value) return
                            field.handleChange({
                              ...field.state.value,
                              method: value
                            })
                          }}
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
                                ? <Text className={styles.mutedText}>No ability scores assigned yet.</Text>
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
              </>
            )
          }}
        </form.AppField>
        <form.AppField name='intent.hitpoints'>
          {(hitpointField) => {
            const hitpointMethod = hitpointField.state.value.method
            const isManualHitpoints = hitpointMethod === HITPOINT_CALCULATION_METHOD_CODE.MANUAL

            return (
              <form.AppField name='intent.hitpoints.levels' mode='array'>
                {(field) => {
                  const rows = field.state.value ?? []

                  return (
                    <Stack gap='md' className={styles.inlinePanel}>
                      <Group justify='space-between'>
                        <div>
                          <Text fw={700}>Hit point entries</Text>
                          <Text className={styles.mutedText}>
                            {isManualHitpoints
                              ? 'Manual HP records the rolled total you choose to keep for each level.'
                              : 'Fixed HP records the fixed total for each level from your character options.'}
                          </Text>
                        </div>
                        {!readOnly
                          ? (
                              <Button
                                type='button'
                                variant='default'
                                onClick={() => field.handleChange(syncHitpointLevels({
                                  character: form.state.values,
                                  classReferences: payload.references.classes,
                                  requiredLevels,
                                  resolvedAbilityScores: payload.resolution.summary.abilities,
                                  rows
                                }))}
                              >
                                Add Missing Levels
                              </Button>
                            )
                          : null}
                      </Group>
                      {rows.length === 0
                        ? <Text className={styles.mutedText}>No hit point levels have been added yet.</Text>
                        : rows.map((row, index) => (
                            <Group key={`hp-${row.level}-${index}`} align='flex-end'>
                              <NumberInput hideControls label='Level' value={row.level} readOnly />
                              <NumberInput
                                hideControls
                                label={isManualHitpoints ? 'Rolled HP Total' : 'Fixed HP Total'}
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
            )
          }}
        </form.AppField>
      </section>
    )
  }
})
