import { z } from 'zod/v4'
import { useEffect } from 'react'
import { Attributes as AttributesEnum, Equipments, Features } from '@/enums'
import { useEnumChecks, useSystemData } from '@/hooks'
import { Grid, Divider } from '@mantine/core'
import { withForm } from '../../utils/factory'
import { EquipmentInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'

const defaultValues: z.input<typeof EquipmentInputSchema> = EquipmentInputSchema.parse({})

const AttributesStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const { formAttributes, properties, damage, category } = useStore(form.store, (state) => ({
      formAttributes: state.values.attributes,
      properties: state.values.properties,
      damage: state.values.damage,
      category: state.values.category,
    }))
    const { AppField, Subscribe, setFieldValue } = form

    const { attributes, abilities } = useSystemData()

    const { getAttributes, getEquipCategories, getEquipProperties } = useEnumChecks()

    const { doesDamage, stackable, requiresSave, primaryAbility } = getAttributes({ attributes: formAttributes })

    const { isArmor, isAdventuringGear, isShield, isWeapon } = getEquipCategories({ category })

    const { isSpecial } = getEquipProperties({ properties })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
        return [
          {
            condition: !(isWeapon || !isSpecial || doesDamage) && damage != null,
            cleanup: () => setFieldValue('damage', undefined),
          },
        ]
      }

      const cleanupRules = cleanup()
      if (cleanupRules) {
        cleanupRules.forEach(({ condition, cleanup }) => {
          if (condition) cleanup()
        })
      }
    }, [damage, setFieldValue, isWeapon, doesDamage, isSpecial])

    return (
      <Subscribe
        selector={(state) => ({
          formAttributes: state.values.attributes,
        })}
      >
        {({ formAttributes }) => (
          <Grid>
            <Grid.Col>
              <Grid>
                <>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField name='attributes'>
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
                        validators={{
                          onChange: z
                            .number('Stack size must be a number')
                            .int('Stack size must be a whole number')
                            .gte(1, 'Stack size must be greater than 0'),
                        }}
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
                        validators={{ onSubmit: ({ value }) => !value && 'Select a DC ability' }}
                      >
                        {({ DropdownField }) => (
                          <DropdownField required={true} options={abilities} label='DC Ability' />
                        )}
                      </AppField>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField name='saveAbility.attributes'>
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
                    {formAttributes?.some((attribute) => attribute === AttributesEnum.ADD_ABILITY_MODIFIER) && (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='saveAbility.abilityModifier'
                          validators={{ onSubmit: ({ value }) => !value && 'Select a modifier ability' }}
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
                        validators={{
                          onSubmit: ({ value }) => !value && 'Please enter a DC minimum value',
                          onChange: z
                            .number('DC minimum value must be a number')
                            .int('DC minimum value must be a whole number')
                            .gte(1, 'DC minimum value must be greater than 0'),
                        }}
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
                        validators={{
                          onSubmit: ({ value }) => !value && 'Enter an armor value',
                          onChange: z
                            .number('Armor value must be a number')
                            .int('Armor value must be a whole number')
                            .gte(1, 'Armor value must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => <TextField required={true} label='Armor Value' />}
                      </AppField>
                    </Grid.Col>
                    {isArmor && (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField name='primaryAbility'>
                          {({ TextField }) => <TextField label='Primary Ability' />}
                        </AppField>
                      </Grid.Col>
                    )}
                  </Grid>
                </Grid.Col>
              </>
            )}
          </Grid>
        )}
      </Subscribe>
    )
  },
})

export default AttributesStep
