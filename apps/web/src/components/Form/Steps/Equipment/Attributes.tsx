import { useEffect } from 'react'
import { Attributes as AttributesEnum, Equipments, Features } from '~enums'
import { useEnumChecks, useSystemData, useFieldUpdates, useFormField } from '~hooks'
import { Grid, Divider } from '@mantine/core'
import { Damage } from '~components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import type { EquipmentInput } from '~types'

const AttributesStep = () => {
  const store = useTypedFormStore<EquipmentInput>()
  const { AppField } = useFormField({ store })

  const { category, updateField, properties, formAttributes, damage } = useOptimizedSelector(store, (state) => ({
    category: state.current?.category,
    updateField: state.updateField,
    properties: state.current?.properties,
    formAttributes: state.current?.attributes,
    damage: state.current?.damage,
  }))

  const { fieldListeners, fieldValidators } = useFieldUpdates()

  const { attributes, abilities } = useSystemData()

  const { getAttributes, getEquipCategories, getEquipProperties } = useEnumChecks()

  const { doesDamage, stackable, requiresSave, primaryAbility, addAbilityModifier } = getAttributes({
    attributes: formAttributes || undefined,
  })

  const { isArmor, isAdventuringGear, isShield, isWeapon } = getEquipCategories({ category })

  const { isSpecial } = getEquipProperties({ properties: properties || undefined })

  // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
  useEffect(() => {
    const cleanup = () => {
      return [
        {
          condition: !(isWeapon || !isSpecial || doesDamage) && damage != null,
          cleanup: () => {
            updateField({ path: 'damage', value: undefined })
          },
        },
      ]
    }

    const cleanupRules = cleanup()
    if (cleanupRules) {
      cleanupRules.forEach(({ condition, cleanup }) => {
        if (condition) cleanup()
      })
    }
  }, [damage, updateField, isWeapon, doesDamage, isSpecial])

  return (
    <Grid>
      <Grid.Col>
        <Grid>
          <>
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <AppField name='attributes' listeners={fieldListeners}>
                {({ DropdownField }) => (
                  <DropdownField
                    multiselect={true}
                    options={attributes
                      .filter((attribute) => {
                        if (attribute.equipment?.length) {
                          if (isArmor) {
                            return (
                              attribute.equipment.includes(Equipments.ARMOR) ||
                              attribute.equipment.includes(Equipments.ALL)
                            )
                          }
                          if (isAdventuringGear) {
                            return (
                              attribute.equipment.includes(Equipments.ADVENTURING_GEAR) ||
                              attribute.equipment.includes(Equipments.ALL)
                            )
                          }
                          if (isWeapon) {
                            return (
                              attribute.equipment.includes(Equipments.WEAPON) ||
                              attribute.equipment.includes(Equipments.ALL)
                            )
                          }
                          return attribute.equipment.includes(Equipments.ALL)
                        }
                      })
                      .filter((attribute) =>
                        primaryAbility ? attribute : attribute.id !== AttributesEnum.OPTIONAL_ABILITY
                      )}
                    label='Equipment Attributes'
                  />
                )}
              </AppField>
            </Grid.Col>
            {stackable && (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <AppField
                  name='maxStack'
                  validators={fieldValidators({
                    onChange: { type: 'integer', min: 1, name: 'Max Stack Amount' },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField label='Max Stack Amount' />}
                </AppField>
              </Grid.Col>
            )}
          </>
          {requiresSave && (
            <>
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <AppField
                  name='saveAbility.id'
                  validators={fieldValidators({
                    onBlur: 'Select a DC ability',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => <DropdownField required={true} options={abilities} label='DC Ability' />}
                </AppField>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <AppField name='saveAbility.attributes' listeners={fieldListeners}>
                  {({ DropdownField }) => (
                    <DropdownField
                      options={attributes.filter(
                        (attribute) => attribute.features && attribute.features.includes(Features.SAVE_ABILITY)
                      )}
                      label='DC Ability'
                    />
                  )}
                </AppField>
              </Grid.Col>
              {addAbilityModifier && (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='saveAbility.abilityModifier'
                    validators={fieldValidators({
                      onBlur: 'Select a modifier ability',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <DropdownField required={true} options={abilities} label='Modifier Ability' />
                    )}
                  </AppField>
                </Grid.Col>
              )}
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <AppField
                  name='saveAbility.minAmount'
                  validators={fieldValidators({
                    onBlur: 'Please enter a DC minimum value',
                    onChange: { type: 'integer', min: 1, name: 'DC Minimum Value' },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField label='DC Minimum Value' required={true} />}
                </AppField>
              </Grid.Col>
            </>
          )}
        </Grid>
      </Grid.Col>
      {(isArmor || isShield) && (
        <>
          <Divider label='Armor Stats' />
          <Grid.Col>
            <Grid>
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <AppField
                  name='armorClass'
                  validators={fieldValidators({
                    onBlur: 'Enter an armor value',
                    onChange: { type: 'integer', min: 1, name: 'Armor Value' },
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => <TextField required={true} label='Armor Value' />}
                </AppField>
              </Grid.Col>
              {isArmor && (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='primaryAbility' listeners={fieldListeners}>
                    {({ TextField }) => <TextField label='Primary Ability' />}
                  </AppField>
                </Grid.Col>
              )}
            </Grid>
          </Grid.Col>
        </>
      )}
      {doesDamage && <Damage />}
    </Grid>
  )
}

export default AttributesStep
