import { useEffect, useMemo, useCallback } from 'react'
import Collapsible from '~/components/Collapse'
import { Attributes, Damages, Spells } from '~/enums'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEnumChecks, useFieldUpdates, useFormField, useSystemData } from '~/hooks'
import { startCase } from 'lodash-es'
import { Grid, UnstyledButton } from '@mantine/core'
import { DamageFieldsInputSchema, DiePerLevelInputSchema, SetPerLevelInputSchema } from '~/schemas'
import type { CharacterInput, FormDataType } from '~/types'
import { useTypedFormStore } from '~/store'
import type { UnionToIntersection, SetOptional } from 'type-fest'

type FeaturePath =
  | `ancestry.options[${number}].features[${number}].damage`
  | `ancestry.options[${number}].features[${number}].options[${number}].damage`
  | `features[${number}].damage`
  | `features[${number}].options[${number}].damage`
  | 'damage'
type StoreType = UnionToIntersection<SetOptional<Exclude<FormDataType, CharacterInput>, '__kind'>>

const Damage = () => {
  const store = useTypedFormStore<StoreType>()

  const { AppField } = useFormField({ store })

  const {
    formAttributes,
    primary,
    secondary,
    bonus,
    versatile,
    diePerLevel,
    setPerLevel,
    __kind,
    formProperties,
    updateField,
    meta,
  } = store((state) => ({
    formAttributes: state.current?.damage?.attributes,
    primary: state.current?.damage?.primary,
    bonus: state.current?.damage?.bonus,
    secondary: state.current?.damage?.secondary,
    versatile: state.current?.damage?.versatile,
    diePerLevel: state.current?.damage?.diePerLevel,
    setPerLevel: state.current?.damage?.setPerLevel,
    __kind: state.current?.__kind,
    formProperties: state.current?.__kind === 'EquipmentInput' ? state.current?.properties : undefined,
    updateField: state.updateField,
    meta: state.meta,
  }))

  const computePath = useCallback(() => {
    const segments: string[] = []

    if (meta.editing.ancestryOptionIndex && __kind === 'RaceInput') {
      segments.push(`ancestry.options[${meta.editing.ancestryOptionIndex}]`)
    }

    if (meta.editing.featureIndex !== undefined) {
      segments.push(`features[${meta.editing.featureIndex}]`)
    }

    if (meta.editing.optionIndex !== undefined) {
      segments.push(`options[${meta.editing.optionIndex}]`)
    }

    if (meta.editing.sectionType && meta.editing.sectionIndex !== undefined) {
      segments.push(`${meta.editing.sectionType}[${meta.editing.sectionIndex}]`)
    }

    return segments.join('.') + '.'
  }, [meta, __kind])

  const path = useMemo(() => {
    return computePath() + 'damage'
  }, [computePath]) as FeaturePath

  const { fieldListeners, fieldValidators } = useFieldUpdates()

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
      updateField({ path: `${path}.primary`, value: damageObject })
    }
  }, [primary, updateField, path])

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
        updateField({ path: `${path}.diePerLevel[0]`, value: damageObject })
      }
      if (!diePerLevelMap[key] && diePerLevel?.find((level) => level?.[key]) != null) {
        const diePerLevelArray = diePerLevel?.map((level) => {
          const levelObject = { ...level }
          delete levelObject[key]
          return levelObject
        })
        updateField({ path: `${path}.diePerLevel`, value: diePerLevelArray })
      }
    })
  }, [diePerLevel, bonus, primary, secondary, updateField, path])

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
        updateField({ path: `${path}.setPerLevel[0]`, value: 0 })
      }
      if (!setPerLevelMap[key] && setPerLevel?.find((level) => level?.[key]) != null) {
        const setPerLevelArray = setPerLevel?.map((level) => {
          const levelObject = { ...level }
          delete levelObject[key]
          return levelObject
        })
        updateField({ path: `${path}.setPerLevel`, value: setPerLevelArray })
      }
    })
  }, [setPerLevel, bonus, primary, secondary, updateField, path])

  // Remove Damage data
  useEffect(() => {
    if (secondary && !secondaryDamage) {
      updateField({ path: `${path}.secondary`, value: undefined })
    }
    if (bonus && !bonusDamage) {
      updateField({ path: `${path}.bonus`, value: undefined })
    }
    if ((__kind !== 'EquipmentInput' && versatile) || (__kind === 'EquipmentInput' && !isVersatile)) {
      updateField({ path: `${path}.versatile`, value: undefined })
    }
  }, [bonus, secondary, versatile, bonusDamage, secondaryDamage, isVersatile, __kind, updateField, path])

  return (
    <>
      <AppField name={`${path}.attributes`} listeners={fieldListeners}>
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
                  <AppField name={`${path}.${type}.attribute`} listeners={fieldListeners}>
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
                  <AppField name={`${path}.${type}.id`} listeners={fieldListeners}>
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
                    name={`${path}.${type}.setAmount`}
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
                        name={`${path}.${type}.ability`}
                        validators={fieldValidators({
                          onBlur: 'Choose an ability',
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
                              } Ability`}
                              options={abilities}
                            />
                          </Grid.Col>
                        )}
                      </AppField>
                    )}
                    <AppField
                      name={`${path}.${type}.minAmount`}
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
                      name={`${path}.${type}.maxAmount`}
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
                      name={`${path}.${type}.multiplier`}
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
                      name={`${path}.${type}.pool.attribute`}
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
                            name={`${path}.${type}.pool.ability`}
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
                          name={`${path}.${type}.pool.minAmount`}
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
                          name={`${path}.${type}.pool.maxAmount`}
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
                          name={`${path}.${type}.pool.multiplier`}
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
                          name={`${path}.${type}.pool.setAmount`}
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
                      name={`${path}.${type}.dieConfig`}
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
          <Collapsible
            props={{
              trigger: {
                title: 'Damage Die By Level',
              },
            }}
          >
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
                <AppField name='damage.diePerLevel' mode='array'>
                  {(field) =>
                    field.state.value?.map((_, i) => (
                      <Grid.Col key={`diePerLevel-${i}`}>
                        <Grid>
                          <AppField
                            name={`${path}.diePerLevel[${i}].level`}
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
                                  name={`${path}.diePerLevel[${i}].${type}.dieConfig`}
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
                                updateField({ path: `${path}.diePerLevel[${i}]`, value: undefined })
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
                                updateField({ path: `${path}.diePerLevel[${i + 1}]`, value: damageInputObj })
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
          </Collapsible>
        </Grid.Col>
      )}
      {(primary?.attribute === Attributes.SET_PER_LEVEL ||
        secondary?.attribute === Attributes.SET_PER_LEVEL ||
        bonus?.attribute === Attributes.SET_PER_LEVEL) && (
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: 'Damage Set By Level',
              },
            }}
          >
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
              <AppField name='damage.setPerLevel' mode='array'>
                {(field) =>
                  field.state.value?.map((_, i) => (
                    <Grid.Col key={`setPerLevel-${i}`}>
                      <Grid>
                        <AppField
                          name={`${path}.setPerLevel[${i}].level`}
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
                                name={`${path}.setPerLevel[${i}].${type}`}
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
                              updateField({ path: `${path}.setPerLevel[${i}]`, value: undefined })
                            }}
                          >
                            <TbX />
                          </UnstyledButton>
                        </Grid.Col>
                        <Grid.Col>
                          <UnstyledButton
                            className={row_button}
                            onClick={() => {
                              const damageInputObj = SetPerLevelInputSchema.parse({ __kind: 'SetPerLevelInput' })
                              field.pushValue(damageInputObj)
                              updateField({ path: `${path}.setPerLevel[${i + 1}]`, value: damageInputObj })
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
          </Collapsible>
        </Grid.Col>
      )}
    </>
  )
}

export default Damage
