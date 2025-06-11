import { z } from 'zod/v4'
import { useEffect, useMemo } from 'react'
import Collapsible from '@/components/Collapsible'
import { Attributes, Damages, Spells } from '@/enums'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEnumChecks, useSystemData } from '@/hooks'
import { startCase } from 'lodash'
import { Grid, UnstyledButton } from '@mantine/core'
import { withFieldGroup } from '../utils/factory'
import { useStore } from '@tanstack/react-form'
import {
  DamageInputSchema,
  SpellInputSchema,
  FeatInputSchema,
  FeatureInputSchema,
  EquipmentInputSchema,
  AncestryFeatureInputSchema,
  FeatureOptionInputSchema,
  DiePerLevelInputSchema,
  SetPerLevelInputSchema,
} from '@/schemas'
import { DIE_REGEX } from '../utils/utils'

const defaultValues: z.input<typeof DamageInputSchema> = DamageInputSchema.parse({})

type ParentFormInputType =
  | z.infer<typeof SpellInputSchema>
  | z.infer<typeof FeatInputSchema>
  | z.infer<typeof FeatureInputSchema>
  | z.infer<typeof EquipmentInputSchema>
  | z.infer<typeof AncestryFeatureInputSchema>
  | z.infer<typeof FeatureOptionInputSchema>

const Damage = withFieldGroup({
  defaultValues: defaultValues,
  render: function Render({ group }) {
    const values = useStore(group.store, (state) => state.values)
    const formValues = useStore(group.form.store, (state) => state.values) as ParentFormInputType

    const { abilities, attributes, damageTypes } = useSystemData()
    const { secondaryDamage, bonusDamage, isVersatile } = useEnumChecks({
      data: values || undefined,
    })

    // Set Damage types for spells, weapons, items
    const formDamageTypes = useMemo(() => {
      let types: ('primary' | 'secondary' | 'bonus' | 'versatile')[] = ['primary'] // Create a copy of damageTypes array

      // Handle secondary
      if (secondaryDamage) {
        if (!types.includes('secondary')) {
          types.push('secondary')
        }
      } else if (types.includes('secondary')) {
        types = types.filter((type) => type !== 'secondary')
      }

      // Handle bonus damage
      if (bonusDamage) {
        if (!types.includes('bonus')) {
          types.push('bonus')
        }
      } else if (types.includes('bonus')) {
        types = types.filter((type) => type !== 'bonus')
      }

      if (formValues.__kind === 'EquipmentInput' && isVersatile) {
        if (!types.includes('versatile')) {
          types.push('versatile')
        }
      } else if (types.includes('versatile')) {
        types = types.filter((type) => type !== 'versatile')
      }
      return types
    }, [formValues.__kind, bonusDamage, secondaryDamage, isVersatile])

    // Add primary damage if doesn't exist
    useEffect(() => {
      if (!values?.primary) {
        group.setFieldValue('primary', { __kind: 'DamageFieldsInput' })
      }
    }, [values?.primary, group])

    // Add/remove Die Per Level table
    useEffect(() => {
      const diePerLevel = {
        primary: values?.primary?.attribute === Attributes.DIE_PER_LEVEL,
        secondary: values?.secondary?.attribute === Attributes.DIE_PER_LEVEL,
        bonus: values?.bonus?.attribute === Attributes.DIE_PER_LEVEL,
      }
      // Potential damage properties
      const keys = ['primary', 'secondary', 'bonus'] as const
      type DamageKey = (typeof keys)[number]
      keys.forEach((key: DamageKey) => {
        if (diePerLevel[key] && !values?.diePerLevel?.some((level) => level?.[key] != null) && values?.[key]) {
          group.setFieldValue(`diePerLevel[0].${key}`, { __kind: 'DamageFieldsInput' })
        }
        if (!diePerLevel[key] && values?.diePerLevel?.find((level) => level?.[key]) != null) {
          const diePerLevelArray = values?.diePerLevel?.map((level) => {
            const levelObject = { ...level }
            delete levelObject[key]
            return levelObject
          })
          group.setFieldValue('diePerLevel', diePerLevelArray)
        }
      })
    }, [group, values])

    // Add/remove Set Per Level table
    useEffect(() => {
      const setPerLevel = {
        primary: values?.primary?.attribute === Attributes.SET_PER_LEVEL,
        secondary: values?.secondary?.attribute === Attributes.SET_PER_LEVEL,
        bonus: values?.bonus?.attribute === Attributes.SET_PER_LEVEL,
      }
      // Potential damage properties
      const keys = ['primary', 'secondary', 'bonus'] as const
      type DamageKey = (typeof keys)[number]
      keys.forEach((key: DamageKey) => {
        if (setPerLevel[key] && !values?.setPerLevel?.some((level) => level?.[key] != null) && values?.[key]) {
          group.setFieldValue(`setPerLevel[0].${key}`, 0)
        }
        if (!setPerLevel[key] && values?.setPerLevel?.find((level) => level?.[key]) != null) {
          const setPerLevelArray = values?.setPerLevel?.map((level) => {
            const levelObject = { ...level }
            delete levelObject[key]
            return levelObject
          })
          group.setFieldValue('setPerLevel', setPerLevelArray)
        }
      })
    }, [group, values])

    // Remove Damage data
    useEffect(() => {
      if (values?.secondary && !secondaryDamage) {
        group.setFieldValue('secondary', undefined)
      }
      if (values?.bonus && !bonusDamage) {
        group.setFieldValue('bonus', undefined)
      }
      if (
        (formValues.__kind !== 'EquipmentInput' && values?.versatile) ||
        (formValues.__kind === 'EquipmentInput' && !isVersatile)
      ) {
        group.setFieldValue('versatile', undefined)
      }
    }, [group, values, bonusDamage, secondaryDamage, isVersatile, formValues])

    return (
      <>
        <group.AppField name='attributes'>
          {({ DropdownField }) => (
            <Grid.Col span={2}>
              <DropdownField
                label='Damage Attributes'
                options={attributes.filter((attribute) =>
                  formValues.__kind !== 'SpellInput' ?
                    attribute?.damage?.length && formValues.__kind === 'EquipmentInput' ?
                      attribute?.damage?.includes(Damages.EQUIPMENT)
                    : attribute?.damage?.includes(Damages.ALL)
                  : attribute?.spells?.length && attribute.spells.includes(Spells.DAMAGE)
                )}
                multiselect={true}
              />
            </Grid.Col>
          )}
        </group.AppField>
        {formDamageTypes.map((type, index) => {
          return (
            <Grid.Col key={index}>
              <Grid>
                {type !== 'versatile' && (
                  <>
                    <group.AppField name={`${type}.attribute`}>
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            label={`${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Dmg. Attribute`}
                            options={attributes.filter((attribute) =>
                              attribute?.damage?.length && formValues.__kind === 'EquipmentInput' ?
                                attribute?.damage?.includes(Damages.EQUIPMENT)
                              : attribute?.damage?.includes(Damages.MAIN)
                            )}
                          />
                        </Grid.Col>
                      )}
                    </group.AppField>
                    <group.AppField name={`${type}.id`}>
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            label={`${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Dmg. Type`}
                            options={[
                              ...damageTypes,
                              {
                                id: 'matchWeapon',
                                value: 'matchWeapon',
                                label: 'Match Weapon',
                              },
                            ]}
                          />
                        </Grid.Col>
                      )}
                    </group.AppField>
                  </>
                )}
                {values?.[type]?.attribute !== Attributes.DIE_PER_LEVEL &&
                  values?.[type]?.attribute !== Attributes.SET_PER_LEVEL &&
                  (values?.[type]?.attribute === Attributes.SET_AMOUNT ?
                    <group.AppField
                      name={`${type}.setAmount`}
                      validators={{
                        onChange: z
                          .number('Set amount must be a number')
                          .int('Set amount must be a whole number')
                          .gte(1, 'Set amount must be greater than 0'),
                        onSubmit: ({ value }) => !value && 'Enter a damage amount',
                      }}
                    >
                      {({ TextField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <TextField
                            label={`Set ${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Value`}
                          />
                        </Grid.Col>
                      )}
                    </group.AppField>
                  : (
                    values?.[type]?.attribute === Attributes.ABILITY ||
                    values?.[type]?.attribute === Attributes.SPELLCASTING_ABILITY ||
                    values?.[type]?.attribute === Attributes.PROFICIENCY
                  ) ?
                    <>
                      {values?.[type]?.attribute === Attributes.ABILITY && (
                        <group.AppField
                          name={`${type}.ability`}
                          validators={{
                            onSubmit: ({ value }) => !value && 'Choose an ability',
                          }}
                        >
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                label={`${
                                  type === 'primary' ? 'Main'
                                  : type === 'secondary' ? 'Sec.'
                                  : 'Bonus'
                                } Ability`}
                                options={abilities}
                              />
                            </Grid.Col>
                          )}
                        </group.AppField>
                      )}
                      <group.AppField
                        name={`${type}.minAmount`}
                        validators={{
                          onChange: z
                            .number('Min amount must be a number')
                            .int('Min amount must be a whole number')
                            .gte(1, 'Min amount must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField
                              label={`${
                                type === 'primary' ? 'Main'
                                : type === 'secondary' ? 'Sec.'
                                : 'Bonus'
                              } Min. Amount`}
                            />
                          </Grid.Col>
                        )}
                      </group.AppField>
                      <group.AppField
                        name={`${type}.maxAmount`}
                        validators={{
                          onChange: z
                            .number('Max amount must be a number')
                            .int('Max amount must be a whole number')
                            .gte(1, 'Max amount must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField
                              label={`${
                                type === 'primary' ? 'Main'
                                : type === 'secondary' ? 'Sec.'
                                : 'Bonus'
                              } Max Amount`}
                            />
                          </Grid.Col>
                        )}
                      </group.AppField>
                      <group.AppField
                        name={`${type}.multiplier`}
                        validators={{
                          onChange: z
                            .number('Multiplier must be a number')
                            .int('Multiplier must be a whole number')
                            .gte(1, 'Multiplier must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField
                              label={`${
                                type === 'primary' ? 'Main'
                                : type === 'secondary' ? 'Sec.'
                                : 'Bonus'
                              } Max Amount`}
                            />
                          </Grid.Col>
                        )}
                      </group.AppField>
                    </>
                  : values?.[type]?.attribute === Attributes.DAMAGE_POOL ?
                    <>
                      <group.AppField
                        name={`${type}.pool.attribute`}
                        validators={{
                          onSubmit: ({ value }) => !value && 'Choose a damage pool attribute',
                        }}
                      >
                        {({ DropdownField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <DropdownField
                              label={`${
                                type === 'primary' ? 'Main'
                                : type === 'secondary' ? 'Sec.'
                                : 'Bonus'
                              } Dmg. Pool Attribute`}
                              options={attributes.filter(
                                (attribute) => attribute?.damage?.length && attribute?.damage.includes(Damages.POOL)
                              )}
                            />
                          </Grid.Col>
                        )}
                      </group.AppField>
                      {(
                        values?.[type]?.pool?.attribute === Attributes.ABILITY ||
                        values?.[type]?.pool?.attribute === Attributes.SPELLCASTING_ABILITY ||
                        values?.[type]?.pool?.attribute === Attributes.PROFICIENCY
                      ) ?
                        <>
                          {values?.[type]?.pool?.attribute === Attributes.ABILITY && (
                            <group.AppField
                              name={`${type}.pool.ability`}
                              validators={{
                                onSubmit: ({ value }) => !value && 'Choose a damage pool ability',
                              }}
                            >
                              {({ DropdownField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <DropdownField
                                    label={`${
                                      type === 'primary' ? 'Main'
                                      : type === 'secondary' ? 'Sec.'
                                      : 'Bonus'
                                    } Dmg. Pool Abilty`}
                                    options={abilities}
                                  />
                                </Grid.Col>
                              )}
                            </group.AppField>
                          )}
                          <group.AppField
                            name={`${type}.pool.minAmount`}
                            validators={{
                              onChange: z
                                .number('Min amount must be a number')
                                .int('Min amount must be a whole number')
                                .gte(1, 'Min amount must be greater than 0'),
                            }}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField
                                  label={`${
                                    type === 'primary' ? 'Main'
                                    : type === 'secondary' ? 'Sec.'
                                    : 'Bonus'
                                  } Min. Amount`}
                                />
                              </Grid.Col>
                            )}
                          </group.AppField>
                          <group.AppField
                            name={`${type}.pool.maxAmount`}
                            validators={{
                              onChange: z
                                .number('Max amount must be a number')
                                .int('Max amount must be a whole number')
                                .gte(1, 'Max amount must be greater than 0'),
                            }}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField
                                  label={`${
                                    type === 'primary' ? 'Main'
                                    : type === 'secondary' ? 'Sec.'
                                    : 'Bonus'
                                  } Max Amount`}
                                />
                              </Grid.Col>
                            )}
                          </group.AppField>
                          <group.AppField
                            name={`${type}.pool.multiplier`}
                            validators={{
                              onChange: z
                                .number('Multiplier must be a number')
                                .int('Multiplier must be a whole number')
                                .gte(1, 'Multiplier must be greater than 0'),
                            }}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField
                                  label={`${
                                    type === 'primary' ? 'Main'
                                    : type === 'secondary' ? 'Sec.'
                                    : 'Bonus'
                                  } Max Amount`}
                                />
                              </Grid.Col>
                            )}
                          </group.AppField>
                        </>
                      : values?.[type]?.pool?.attribute === Attributes.SET_AMOUNT && (
                          <group.AppField
                            name={`${type}.pool.setAmount`}
                            validators={{
                              onChange: z
                                .number('Set amount must be a number')
                                .int('Set amount must be a whole number')
                                .gte(1, 'Set amount must be greater than 0'),
                              onSubmit: ({ value }) => !value && 'Enter a damage amount',
                            }}
                          >
                            {({ TextField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <TextField
                                  label={`Set ${
                                    type === 'primary' ? 'Main'
                                    : type === 'secondary' ? 'Sec.'
                                    : 'Bonus'
                                  } Pool Value`}
                                />
                              </Grid.Col>
                            )}
                          </group.AppField>
                        )
                      }
                    </>
                  : <>
                      <group.AppField
                        name={`${type}.dieConfig`}
                        validators={{
                          onChange: z.string().regex(DIE_REGEX, 'Enter a valid die configuration (ex: 2d12)'),
                          onSubmit: ({ value }) => !value && type === 'primary' && 'Enter a damage die configuration',
                        }}
                      >
                        {({ TextField }) => (
                          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                            <TextField
                              label={`Set ${
                                type === 'primary' ? 'Main'
                                : type === 'secondary' ? 'Sec.'
                                : 'Bonus'
                              } Pool Value`}
                            />
                          </Grid.Col>
                        )}
                      </group.AppField>
                    </>)}
              </Grid>
            </Grid.Col>
          )
        })}
        {(values?.primary?.attribute === Attributes.DIE_PER_LEVEL ||
          values?.secondary?.attribute === Attributes.DIE_PER_LEVEL ||
          values?.bonus?.attribute === Attributes.DIE_PER_LEVEL) && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title={`Damage Die By Level`} />
              <Collapsible.Content>
                <Grid>
                  <Grid.Col>
                    <Grid>
                      <Grid.Col>Level</Grid.Col>
                      {formDamageTypes.map((type) => {
                        if (values?.[type]?.attribute === Attributes.DIE_PER_LEVEL) {
                          return <Grid.Col key={type}>{`${startCase(type)} Die Roll`}</Grid.Col>
                        }
                      })}
                      <Grid.Col>Remove Row</Grid.Col>
                      <Grid.Col>Add Row</Grid.Col>
                    </Grid>
                  </Grid.Col>
                  {values.diePerLevel?.length && (
                    <group.AppField name='diePerLevel' mode='array'>
                      {(field) =>
                        field.state.value?.map((_, i) => (
                          <Grid.Col key={`${i}-diePerLevel`}>
                            <Grid>
                              <group.AppField
                                name={`diePerLevel[${i}].level`}
                                validators={{
                                  onSubmit: ({ value }) => (!value || value === '') && 'Enter a level',
                                }}
                              >
                                {({ TextField }) => (
                                  <Grid.Col>
                                    <TextField />
                                  </Grid.Col>
                                )}
                              </group.AppField>
                              {formDamageTypes.map((type) => {
                                if (type !== 'versatile' && values?.[type]?.attribute === Attributes.DIE_PER_LEVEL) {
                                  return (
                                    <group.AppField
                                      name={`diePerLevel[${i}].${type}.dieConfig`}
                                      validators={{
                                        onSubmit: ({ value }) =>
                                          (!value || value === '') && 'Enter a die configuration (ex: 2d12)',
                                        onChange: z
                                          .string()
                                          .regex(DIE_REGEX, 'Enter a valid die configuration (ex: 2d12)'),
                                      }}
                                    >
                                      {({ TextField }) => (
                                        <Grid.Col>
                                          <TextField />
                                        </Grid.Col>
                                      )}
                                    </group.AppField>
                                  )
                                }
                              })}
                              <Grid.Col>
                                <UnstyledButton className={row_button} onClick={() => field.removeValue(i)}>
                                  <TbX />
                                </UnstyledButton>
                              </Grid.Col>
                              <Grid.Col>
                                <UnstyledButton
                                  className={row_button}
                                  onClick={() =>
                                    group.setFieldValue(`diePerLevel[${i + 1}]`, DiePerLevelInputSchema.parse({}))
                                  }
                                >
                                  <TbPlus />
                                </UnstyledButton>
                              </Grid.Col>
                            </Grid>
                          </Grid.Col>
                        ))
                      }
                    </group.AppField>
                  )}
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
        {(values?.primary?.attribute === Attributes.SET_PER_LEVEL ||
          values?.secondary?.attribute === Attributes.SET_PER_LEVEL ||
          values?.bonus?.attribute === Attributes.SET_PER_LEVEL) && (
          <Grid.Col>
            <Collapsible>
              <Collapsible.Trigger title={`Damage Die By Level`} />
              <Collapsible.Content>
                <Grid>
                  <Grid.Col>
                    <Grid>
                      <Grid.Col>Level</Grid.Col>
                      {formDamageTypes.map((type) => {
                        if (values?.[type]?.attribute === Attributes.SET_PER_LEVEL) {
                          return <Grid.Col key={type}>{`${startCase(type)} Die Roll`}</Grid.Col>
                        }
                      })}
                      <Grid.Col>Remove Row</Grid.Col>
                      <Grid.Col>Add Row</Grid.Col>
                    </Grid>
                  </Grid.Col>
                  <group.AppField name='setPerLevel' mode='array'>
                    {(field) =>
                      field.state.value?.map((_, i) => (
                        <Grid.Col key={`${i}-setPerLevel`}>
                          <Grid>
                            <group.AppField
                              name={`setPerLevel[${i}].level`}
                              validators={{
                                onSubmit: ({ value }) => (!value || value === '') && 'Enter a level',
                              }}
                            >
                              {({ TextField }) => (
                                <Grid.Col>
                                  <TextField />
                                </Grid.Col>
                              )}
                            </group.AppField>
                            {formDamageTypes.map((type) => {
                              if (type !== 'versatile' && values?.[type]?.attribute === Attributes.SET_PER_LEVEL) {
                                return (
                                  <group.AppField
                                    name={`setPerLevel[${i}].${type}`}
                                    key={type}
                                    validators={{
                                      onSubmit: ({ value }) => !value && 'Enter a damage amount',
                                      onChange: z
                                        .number('Enter a number')
                                        .int('Enter a whole number')
                                        .gte(1, 'Enter a number greater than 0'),
                                    }}
                                  >
                                    {({ TextField }) => (
                                      <Grid.Col>
                                        <TextField />
                                      </Grid.Col>
                                    )}
                                  </group.AppField>
                                )
                              }
                            })}
                            <Grid.Col>
                              <UnstyledButton className={row_button} onClick={() => field.removeValue(i)}>
                                <TbX />
                              </UnstyledButton>
                            </Grid.Col>
                            <Grid.Col>
                              <UnstyledButton
                                className={row_button}
                                onClick={() =>
                                  group.setFieldValue(`setPerLevel[${i + 1}]`, SetPerLevelInputSchema.parse({}))
                                }
                              >
                                <TbPlus />
                              </UnstyledButton>
                            </Grid.Col>
                          </Grid>
                        </Grid.Col>
                      ))
                    }
                  </group.AppField>
                </Grid>
              </Collapsible.Content>
            </Collapsible>
          </Grid.Col>
        )}
      </>
    )
  },
})

export default Damage
