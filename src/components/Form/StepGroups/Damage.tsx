import { useEffect, useMemo } from 'react'
import Collapsible from '@/components/Collapsible'
import { Attributes, Damages, Spells } from '@/enums'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEnumChecks, useFieldUpdates, useSystemData } from '@/hooks'
import { startCase } from 'lodash'
import { Grid, UnstyledButton } from '@mantine/core'
import { withFieldGroup } from '@/components/Form'
import { useStore } from '@tanstack/react-form'
import { DamageFieldsInputSchema, DiePerLevelInputSchema, SetPerLevelInputSchema } from '@/schemas'
import type { DamageInput } from 'gql/types'

type DamageProps = {
  __kind: 'SpellInput' | 'EquipmentInput' | 'FeatInput' | 'FeatureInput' | 'FeatureOptionInput' | 'AncestryFeatureInput'
  properties?: string[] | null | undefined
  removeFn: (arg: { path: string }) => void
  updateFn: (arg: { path: string; value: unknown }) => void
}

const Damage = withFieldGroup({
  defaultValues: {} as DamageInput,
  props: {
    __kind: 'SpellInput',
    properties: undefined,
    removeFn: (() => undefined) as () => void,
    updateFn: (() => undefined) as () => void,
  } as DamageProps,
  render: function Render({ group, __kind, properties: formProperties, updateFn, removeFn }) {
    const { AppField, Subscribe } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({
      data:
        __kind === 'EquipmentInput' || __kind === 'SpellInput' || __kind === 'FeatInput' ? 'form'
        : __kind === 'FeatureOptionInput' ? 'option'
        : 'feature',
      path: 'damage',
    })

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
        const damageObject = DamageFieldsInputSchema.parse({})
        group.setFieldValue('primary', damageObject)
        updateFn({ path: 'damage.primary', value: damageObject })
      }
    }, [primary, group, updateFn])

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
          const damageObject = DamageFieldsInputSchema.parse({})
          group.setFieldValue(`diePerLevel[0].${key}`, damageObject)
          updateFn({ path: 'damage.diePerLevel[0]', value: damageObject })
        }
        if (!diePerLevelMap[key] && diePerLevel?.find((level) => level?.[key]) != null) {
          const diePerLevelArray = diePerLevel?.map((level) => {
            const levelObject = { ...level }
            delete levelObject[key]
            return levelObject
          })
          group.setFieldValue('diePerLevel', diePerLevelArray)
          updateFn({ path: 'damage.diePerLevel', value: diePerLevelArray })
        }
      })
    }, [group, diePerLevel, bonus, primary, secondary, updateFn])

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
          updateFn({ path: 'damage.setPerLevel[0]', value: 0 })
        }
        if (!setPerLevelMap[key] && setPerLevel?.find((level) => level?.[key]) != null) {
          const setPerLevelArray = setPerLevel?.map((level) => {
            const levelObject = { ...level }
            delete levelObject[key]
            return levelObject
          })
          group.setFieldValue('setPerLevel', setPerLevelArray)
          updateFn({ path: 'damage.setPerLevel', value: setPerLevel })
        }
      })
    }, [group, setPerLevel, bonus, primary, secondary, updateFn])

    // Remove Damage data
    useEffect(() => {
      if (secondary && !secondaryDamage) {
        group.setFieldValue('secondary', undefined)
        removeFn({ path: 'damage.secondary' })
      }
      if (bonus && !bonusDamage) {
        group.setFieldValue('bonus', undefined)
        removeFn({ path: 'damage.bonus' })
      }
      if ((__kind !== 'EquipmentInput' && versatile) || (__kind === 'EquipmentInput' && !isVersatile)) {
        group.setFieldValue('versatile', undefined)
        removeFn({ path: 'damage.versatile' })
      }
    }, [group, bonus, secondary, versatile, bonusDamage, secondaryDamage, isVersatile, __kind, removeFn])

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
            <AppField name='attributes' listeners={fieldListeners}>
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
                        <AppField name={`${type}.attribute`} listeners={fieldListeners}>
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
                        <AppField name={`${type}.id`} listeners={fieldListeners}>
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
                          validators={fieldValidators({
                            onChange: { type: 'integer', name: 'Set amount', min: 1 },
                            onBlur: 'Enter a damage amount',
                          })}
                          listeners={fieldListeners}
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
                                onBlur: ({ value }) => !value && 'Choose an ability',
                              }}
                              listeners={fieldListeners}
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
                            validators={fieldValidators({
                              onChange: { type: 'integer', name: 'Min amount', min: 1 },
                            })}
                            listeners={fieldListeners}
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
                            validators={fieldValidators({
                              onChange: { type: 'integer', name: 'Max amount', min: 1 },
                            })}
                            listeners={fieldListeners}
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
                            validators={fieldValidators({
                              onChange: { type: 'integer', name: 'Multiplier', min: 1 },
                            })}
                            listeners={fieldListeners}
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
                            validators={fieldValidators({
                              onBlur: 'Choose a damage pool attribute',
                            })}
                            listeners={fieldListeners}
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
                                  validators={fieldValidators({
                                    onBlur: 'Choose a damage pool ability',
                                  })}
                                  listeners={fieldListeners}
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
                                validators={fieldValidators({
                                  onChange: { type: 'integer', name: 'Min amount', min: 1 },
                                })}
                                listeners={fieldListeners}
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
                                validators={fieldValidators({
                                  onChange: { type: 'integer', name: 'Max amount', min: 1 },
                                })}
                                listeners={fieldListeners}
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
                                validators={fieldValidators({
                                  onChange: { type: 'integer', name: 'Multiplier', min: 1 },
                                })}
                                listeners={fieldListeners}
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
                                validators={fieldValidators({
                                  onChange: { type: 'integer', name: 'Set amount', min: 1 },
                                  onBlur: 'Enter a damage amount',
                                })}
                                listeners={fieldListeners}
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
                            validators={fieldValidators({
                              onChange: { type: 'string', name: 'Die configuration' },
                              onBlur: 'Enter a damage die configuration',
                            })}
                            listeners={fieldListeners}
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
                                    validators={fieldValidators({
                                      onBlur: 'Enter a level',
                                    })}
                                    listeners={fieldListeners}
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
                                          validators={fieldValidators({
                                            onChange: { type: 'string', name: 'Die configuration' },
                                            onBlur: 'Enter a die configuration (ex: 2d12)',
                                          })}
                                          listeners={fieldListeners}
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
                                    <UnstyledButton
                                      className={row_button}
                                      onClick={() => {
                                        field.removeValue(i)
                                        removeFn({ path: `damage.diePerLevel[${i}]` })
                                      }}
                                    >
                                      <TbX />
                                    </UnstyledButton>
                                  </Grid.Col>
                                  <Grid.Col>
                                    <UnstyledButton
                                      className={row_button}
                                      onClick={() => {
                                        const damageInputObj = DiePerLevelInputSchema.parse({})
                                        field.pushValue(damageInputObj)
                                        updateFn({ path: `damage.diePerLevel[${i + 1}]`, value: damageInputObj })
                                      }}
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
                                  validators={fieldValidators({
                                    onBlur: 'Enter a level',
                                  })}
                                  listeners={fieldListeners}
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
                                        validators={fieldValidators({
                                          onChange: { type: 'integer', name: 'Set amount', min: 1 },
                                          onBlur: 'Enter a set amount',
                                        })}
                                        listeners={fieldListeners}
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
                                  <UnstyledButton
                                    className={row_button}
                                    onClick={() => {
                                      field.removeValue(i)
                                      removeFn({ path: `damage.setPerLevel[${i}]` })
                                    }}
                                  >
                                    <TbX />
                                  </UnstyledButton>
                                </Grid.Col>
                                <Grid.Col>
                                  <UnstyledButton
                                    className={row_button}
                                    onClick={() => {
                                      const damageInputObj = SetPerLevelInputSchema.parse({})
                                      field.pushValue(damageInputObj)
                                      updateFn({ path: `damage.setPerLevel[${i + 1}]`, value: damageInputObj })
                                    }}
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
