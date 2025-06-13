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
import { DamageInputSchema, DiePerLevelInputSchema, SetPerLevelInputSchema } from '@/schemas'
import { DIE_REGEX } from '../utils/utils'

const defaultValues: z.input<typeof DamageInputSchema> = DamageInputSchema.parse({})

const Damage = withFieldGroup({
  defaultValues: defaultValues,
  props: {
    __kind: '' as
      | 'SpellInput'
      | 'EquipmentInput'
      | 'FeatInput'
      | 'FeatureInput'
      | 'FeatureOptionInput'
      | 'AncestryFeatureInput',
    properties: [] as string[] | null | undefined,
  },
  render: function Render({ group, __kind, properties: formProperties }) {
    const {
      attributes: formAttributes,
      primary,
      secondary,
      bonus,
      versatile,
      diePerLevel,
      setPerLevel,
    } = useStore(group.store, (state) => ({
      attributes: state.values.attributes,
      primary: state.values.primary,
      secondary: state.values.secondary,
      bonus: state.values.bonus,
      versatile: state.values.versatile,
      diePerLevel: state.values.diePerLevel,
      setPerLevel: state.values.setPerLevel,
    }))

    const { AppField, Subscribe } = group

    const { abilities, attributes, damageTypes } = useSystemData()
    const { getAttributes, getEquipProperties } = useEnumChecks()
    const { secondaryDamage, bonusDamage } = getAttributes({ attributes: formAttributes ?? [] })
    const { isVersatile } = getEquipProperties({ properties: formProperties ?? [] })

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

      if (__kind === 'EquipmentInput' && isVersatile) {
        if (!types.includes('versatile')) {
          types.push('versatile')
        }
      } else if (types.includes('versatile')) {
        types = types.filter((type) => type !== 'versatile')
      }
      return types
    }, [__kind, bonusDamage, secondaryDamage, isVersatile])

    // Add primary damage if doesn't exist
    useEffect(() => {
      if (!primary) {
        group.setFieldValue('primary', { __kind: 'DamageFieldsInput' })
      }
    }, [primary, group])

    // Add/remove Die Per Level table
    useEffect(() => {
      const diePerLevelMap = {
        primary: primary?.attribute === Attributes.DIE_PER_LEVEL,
        secondary: secondary?.attribute === Attributes.DIE_PER_LEVEL,
        bonus: bonus?.attribute === Attributes.DIE_PER_LEVEL,
      }
      // Potential damage properties
      const keys = ['primary', 'secondary', 'bonus'] as const
      type DamageKey = (typeof keys)[number]
      keys.forEach((key: DamageKey) => {
        if (diePerLevelMap[key] && !diePerLevel?.some((level) => level?.[key] != null) && key) {
          group.setFieldValue(`diePerLevel[0].${key}`, { __kind: 'DamageFieldsInput' })
        }
        if (!diePerLevelMap[key] && diePerLevel?.find((level) => level?.[key]) != null) {
          const diePerLevelArray = diePerLevel?.map((level) => {
            const levelObject = { ...level }
            delete levelObject[key]
            return levelObject
          })
          group.setFieldValue('diePerLevel', diePerLevelArray)
        }
      })
    }, [group, diePerLevel, bonus, primary, secondary])

    // Add/remove Set Per Level table
    useEffect(() => {
      const setPerLevelMap = {
        primary: primary?.attribute === Attributes.SET_PER_LEVEL,
        secondary: secondary?.attribute === Attributes.SET_PER_LEVEL,
        bonus: bonus?.attribute === Attributes.SET_PER_LEVEL,
      }
      // Potential damage properties
      const keys = ['primary', 'secondary', 'bonus'] as const
      type DamageKey = (typeof keys)[number]
      keys.forEach((key: DamageKey) => {
        if (setPerLevelMap[key] && !setPerLevel?.some((level) => level?.[key] != null) && key) {
          group.setFieldValue(`setPerLevel[0].${key}`, 0)
        }
        if (!setPerLevelMap[key] && setPerLevel?.find((level) => level?.[key]) != null) {
          const setPerLevelArray = setPerLevel?.map((level) => {
            const levelObject = { ...level }
            delete levelObject[key]
            return levelObject
          })
          group.setFieldValue('setPerLevel', setPerLevelArray)
        }
      })
    }, [group, setPerLevel, bonus, primary, secondary])

    // Remove Damage data
    useEffect(() => {
      if (secondary && !secondaryDamage) {
        group.setFieldValue('secondary', undefined)
      }
      if (bonus && !bonusDamage) {
        group.setFieldValue('bonus', undefined)
      }
      if ((__kind !== 'EquipmentInput' && versatile) || (__kind === 'EquipmentInput' && !isVersatile)) {
        group.setFieldValue('versatile', undefined)
      }
    }, [group, bonus, secondary, versatile, bonusDamage, secondaryDamage, isVersatile, __kind])

    return (
      <Subscribe
        selector={(state) => ({
          primary: state.values.primary,
          secondary: state.values.secondary,
          bonus: state.values.bonus,
          versatile: state.values.versatile,
          diePerLevel: state.values.diePerLevel,
        })}
      >
        {({ primary, secondary, bonus, versatile, diePerLevel }) => (
          <>
            <AppField name='attributes'>
              {({ DropdownField }) => (
                <Grid.Col span={2}>
                  <DropdownField
                    label='Damage Attributes'
                    options={attributes.filter((attribute) =>
                      __kind !== 'SpellInput' ?
                        attribute?.damage?.length && __kind === 'EquipmentInput' ?
                          attribute?.damage?.includes(Damages.EQUIPMENT)
                        : attribute?.damage?.includes(Damages.ALL)
                      : attribute?.spells?.length && attribute.spells.includes(Spells.DAMAGE)
                    )}
                    multiselect={true}
                  />
                </Grid.Col>
              )}
            </AppField>
            {formDamageTypes.map((type, index) => {
              const damageObject =
                type === 'primary' ? primary
                : type === 'secondary' ? secondary
                : type === 'versatile' ? versatile
                : bonus
              return (
                <Grid.Col key={index}>
                  <Grid>
                    {type !== 'versatile' && (
                      <>
                        <AppField name={`${type}.attribute`}>
                          {({ DropdownField }) => (
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <DropdownField
                                label={`${
                                  type === 'primary' ? 'Main'
                                  : type === 'secondary' ? 'Sec.'
                                  : 'Bonus'
                                } Dmg. Attribute`}
                                options={attributes.filter((attribute) =>
                                  attribute?.damage?.length && __kind === 'EquipmentInput' ?
                                    attribute?.damage?.includes(Damages.EQUIPMENT)
                                  : attribute?.damage?.includes(Damages.MAIN)
                                )}
                              />
                            </Grid.Col>
                          )}
                        </AppField>
                        <AppField name={`${type}.id`}>
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
                        </AppField>
                      </>
                    )}
                    {damageObject?.attribute !== Attributes.DIE_PER_LEVEL &&
                      damageObject?.attribute !== Attributes.SET_PER_LEVEL &&
                      (damageObject?.attribute === Attributes.SET_AMOUNT ?
                        <AppField
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
                        </AppField>
                      : (
                        damageObject?.attribute === Attributes.ABILITY ||
                        damageObject?.attribute === Attributes.SPELLCASTING_ABILITY ||
                        damageObject?.attribute === Attributes.PROFICIENCY
                      ) ?
                        <>
                          {damageObject?.attribute === Attributes.ABILITY && (
                            <AppField
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
                            </AppField>
                          )}
                          <AppField
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
                          </AppField>
                          <AppField
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
                          </AppField>
                          <AppField
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
                          </AppField>
                        </>
                      : damageObject?.attribute === Attributes.DAMAGE_POOL ?
                        <>
                          <AppField
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
                          </AppField>
                          {(
                            damageObject?.pool?.attribute === Attributes.ABILITY ||
                            damageObject?.pool?.attribute === Attributes.SPELLCASTING_ABILITY ||
                            damageObject?.pool?.attribute === Attributes.PROFICIENCY
                          ) ?
                            <>
                              {damageObject?.pool?.attribute === Attributes.ABILITY && (
                                <AppField
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
                                </AppField>
                              )}
                              <AppField
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
                              </AppField>
                              <AppField
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
                              </AppField>
                              <AppField
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
                              </AppField>
                            </>
                          : damageObject?.pool?.attribute === Attributes.SET_AMOUNT && (
                              <AppField
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
                              </AppField>
                            )
                          }
                        </>
                      : <>
                          <AppField
                            name={`${type}.dieConfig`}
                            validators={{
                              onChange: z.string().regex(DIE_REGEX, 'Enter a valid die configuration (ex: 2d12)'),
                              onSubmit: ({ value }) =>
                                !value && type === 'primary' && 'Enter a damage die configuration',
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
                          </AppField>
                        </>)}
                  </Grid>
                </Grid.Col>
              )
            })}
            {(primary?.attribute === Attributes.DIE_PER_LEVEL ||
              secondary?.attribute === Attributes.DIE_PER_LEVEL ||
              bonus?.attribute === Attributes.DIE_PER_LEVEL) && (
              <Grid.Col>
                <Collapsible>
                  <Collapsible.Trigger title={`Damage Die By Level`} />
                  <Collapsible.Content>
                    <Grid>
                      <Grid.Col>
                        <Grid>
                          <Grid.Col>Level</Grid.Col>
                          {formDamageTypes.map((type) => {
                            const damageObject =
                              type === 'primary' ? primary
                              : type === 'secondary' ? secondary
                              : type === 'versatile' ? versatile
                              : bonus
                            if (damageObject?.attribute === Attributes.DIE_PER_LEVEL) {
                              return <Grid.Col key={type}>{`${startCase(type)} Die Roll`}</Grid.Col>
                            }
                          })}
                          <Grid.Col>Remove Row</Grid.Col>
                          <Grid.Col>Add Row</Grid.Col>
                        </Grid>
                      </Grid.Col>
                      {diePerLevel?.length && (
                        <AppField name='diePerLevel' mode='array'>
                          {(field) =>
                            field.state.value?.map((_, i) => (
                              <Grid.Col key={`${i}-diePerLevel`}>
                                <Grid>
                                  <AppField
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
                                  </AppField>
                                  {formDamageTypes.map((type) => {
                                    const damageObject =
                                      type === 'primary' ? primary
                                      : type === 'secondary' ? secondary
                                      : type === 'versatile' ? versatile
                                      : bonus
                                    if (type !== 'versatile' && damageObject?.attribute === Attributes.DIE_PER_LEVEL) {
                                      return (
                                        <AppField
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
                                        </AppField>
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
                                      onClick={() => field.pushValue(DiePerLevelInputSchema.parse({}))}
                                    >
                                      <TbPlus />
                                    </UnstyledButton>
                                  </Grid.Col>
                                </Grid>
                              </Grid.Col>
                            ))
                          }
                        </AppField>
                      )}
                    </Grid>
                  </Collapsible.Content>
                </Collapsible>
              </Grid.Col>
            )}
            {(primary?.attribute === Attributes.SET_PER_LEVEL ||
              secondary?.attribute === Attributes.SET_PER_LEVEL ||
              bonus?.attribute === Attributes.SET_PER_LEVEL) && (
              <Grid.Col>
                <Collapsible>
                  <Collapsible.Trigger title={`Damage Die By Level`} />
                  <Collapsible.Content>
                    <Grid>
                      <Grid.Col>
                        <Grid>
                          <Grid.Col>Level</Grid.Col>
                          {formDamageTypes.map((type) => {
                            const damageObject =
                              type === 'primary' ? primary
                              : type === 'secondary' ? secondary
                              : type === 'versatile' ? versatile
                              : bonus
                            if (damageObject?.attribute === Attributes.SET_PER_LEVEL) {
                              return <Grid.Col key={type}>{`${startCase(type)} Die Roll`}</Grid.Col>
                            }
                          })}
                          <Grid.Col>Remove Row</Grid.Col>
                          <Grid.Col>Add Row</Grid.Col>
                        </Grid>
                      </Grid.Col>
                      <AppField name='setPerLevel' mode='array'>
                        {(field) =>
                          field.state.value?.map((_, i) => (
                            <Grid.Col key={`${i}-setPerLevel`}>
                              <Grid>
                                <AppField
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
                                </AppField>
                                {formDamageTypes.map((type) => {
                                  const damageObject =
                                    type === 'primary' ? primary
                                    : type === 'secondary' ? secondary
                                    : type === 'versatile' ? versatile
                                    : bonus
                                  if (type !== 'versatile' && damageObject?.attribute === Attributes.SET_PER_LEVEL) {
                                    return (
                                      <AppField
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
                                      </AppField>
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
                      </AppField>
                    </Grid>
                  </Collapsible.Content>
                </Collapsible>
              </Grid.Col>
            )}
          </>
        )}
      </Subscribe>
    )
  },
})

export default Damage
