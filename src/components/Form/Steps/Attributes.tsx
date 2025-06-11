import { z } from 'zod/v4'
import { useEffect, Fragment } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import { startCase } from 'lodash'
import Collapsible from '@/components/Collapsible'
// import Requirements from '../Substeps/Prerequisites'
import Damage from '../Substeps/Damage'
// import Upcast from '../Substeps/Upcast'
// import LevelAttributes from '../Substeps/Class/LevelAttributes'
// import Spellcasting from '../Substeps/Class/Spellcasting'
// import Resource from '../Substeps/Class/Resource'
// import LimitUse from '../Substeps/LimitUse'
// import Multiclass from '../Substeps/Class/Multiclass'
import {
  Attributes as AttributesEnum,
  Categories,
  Durations,
  Ranges,
  Shapes,
  Equipments,
  Classes,
  Feats,
  Spells,
  Features,
} from '@/enums'
import { useEnumChecks, useSystemData } from '@/hooks'
import { TbPlus, TbX } from 'react-icons/tb'
import { row_button } from '../Form.css'
// import type { FormStore } from '@/store'
import { Grid, Group, Divider, Button } from '@mantine/core'
import { withForm } from '../utils/factory'
import { discriminatedDomainInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@tanstack/react-form'

const defaultValues: z.input<typeof discriminatedDomainInputSchema> = discriminatedDomainInputSchema.parse({})

const AttributesStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const values = useStore(form.store, (state) => state.values)
    const { AppField, Subscribe } = form

    const {
      attributes,
      actions,
      rules,
      conditions,
      abilities,
      spells: { durations, shapes, ranges },
    } = useSystemData()

    const { getAttributes, getActions, getEquipProperties } = useEnumChecks({
      data: values,
    })

    const { specialPrimaryAction, specialSecondaryAction } = getAction({ action: values.actions })

    const {
      isSpecial,
      doesDamage,
      isWeapon,
      hasPrerequisites,
      isSpellcaster,
      canUpcast,
      equipmentProficiency,
      equipped,
      notEquipped,
      stackable,
      isAction,
      secondaryAction,
      requiresSave,
      primaryAbility,
      // hasResourcePoints,
      limitUse
    } = getAttributes({ attribute: values.attributes })

    const { resourceSetPerLevel } = getResources({ method: values.resources.method })

    const {,
      isArmor,
      isAdventuringGear,
      isShield
    } = getEquipProperties({properties: values.properties})

    
    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      if (!form.store) return

      const cleanup = () => {
        switch (values.__kind) {
          case 'EquipmentInput':
            return [
              {
                condition: !(isWeapon || !isSpecial || doesDamage) && values.damage != null,
                cleanup: () => form.setFieldValue('damage', undefined),
              },
            ]
          case 'SpellInput':
            return [
              {
                condition: !doesDamage && values.damage != null,
                cleanup: () => form.setFieldValue('damage', undefined),
              },
              {
                condition: !canUpcast && values.upcast != null,
                cleanup: () => form.setFieldValue('upcast', undefined),
              },
            ]
          case 'ClassInput':
            return [
              {
                condition: !isSpellcaster && values.spellcasting != null,
                cleanup: () => {
                  form.setFieldValue('spellcasting', undefined)
                  if (values.__kind === 'ClassInput') {
                    values.levelAttributes?.map((_, index) => {
                      form.setFieldValue(`levelAttributes[${index}].spellSlots`, undefined)
                    })
                  }
                },
              },
              {
                condition: values.category !== Categories.SUBCLASS && values.subtypes?.length,
                cleanup: () => {
                  form.setFieldValue('subtypes', undefined)
                },
              },
            ]
          case 'FeatInput':
            return [
              {
                condition: !hasPrerequisites && values.prerequisites != null,
                cleanup: () => form.setFieldValue('prerequisites', undefined),
              },
              {
                condition: !equipmentProficiency && values.prerequisites?.equipmentProficiencies?.length,
                cleanup: () => form.setFieldValue('prerequisites.equipmentProficiencies', undefined),
              },
              {
                condition: !equipped && values.prerequisites?.equipped?.length,
                cleanup: () => form.setFieldValue('prerequisites.equipped', undefined),
              },
              {
                condition: !notEquipped && values.prerequisites?.notEquipped?.length,
                cleanup: () => form.setFieldValue('prerequisites.notEquipped', undefined),
              },
            ]
        }
      }

      const cleanupRules = cleanup()
      if (cleanupRules) {
        cleanupRules.forEach(({ condition, cleanup }) => {
          if (condition) cleanup()
        })
      }
    }, [
      form,
      canUpcast,
      isSpellcaster,
      isWeapon,
      doesDamage,
      hasPrerequisites,
      equipmentProficiency,
      equipped,
      notEquipped,
      isSpecial,
      values,
    ])

    // Add Subtypes to Class as necessary
    useEffect(() => {
      if (values.__kind !== 'ClassInput' || values.category !== Categories.SUBCLASS || values.subtypes?.length)
        form.setFieldValue('subtypes', [{ __kind: 'SubtypeInput', id: uuidv4(), label: '' }])
    }, [values, form])

    const typeMap = {
      EquipmentInput: 'equipment',
      RaceInput: 'races',
      ClassInput: 'classes',
      BackgroundInput: 'backgrounds',
      SpellInput: 'spells',
      FeatInput: 'feats',
      CharacterInput: 'characters',
    } as const

    return (
      <Grid>
        <Grid.Col>
          <Grid>
            {values.__kind !== 'RaceInput' &&
              values.__kind !== 'BackgroundInput' &&
              values.__kind !== 'CharacterInput' && (
                <>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField name='attributes'>
                      {({ DropdownField }) => (
                        <DropdownField
                          multiselect={true}
                          options={attributes
                            .filter((attribute) => {
                              if (values.__kind === 'EquipmentInput' && attribute?.equipment?.length) {
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
                              if (values.__kind === 'ClassInput' && attribute?.classes?.length) {
                                return (
                                  attribute.classes.includes(Classes.BASE) ||
                                  (values?.category === Categories.SUBCLASS &&
                                    attribute.classes.includes(Classes.SUBCLASS)) ||
                                  attribute.classes.includes(Classes.ALL)
                                )
                              }
                              if (values.__kind === 'FeatInput' && attribute?.feats?.length) {
                                return attribute.feats.includes(Feats.ALL)
                              }
                              if (values.__kind === 'SpellInput' && attribute?.spells?.length) {
                                return attribute.spells.includes(Spells.ALL)
                              }
                              return false
                            })
                            .filter((attribute) =>
                              primaryAbility ? attribute : attribute.id !== AttributesEnum.OPTIONAL_ABILITY
                            )}
                          label={`${startCase(values.__kind.replace('Input', ''))} Attributes`}
                        />
                      )}
                    </AppField>
                  </Grid.Col>
                  {values.__kind === 'EquipmentInput' && stackable && (
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
              )}
            {(values.__kind === 'SpellInput' || values.__kind === 'FeatInput') && isAction && (
              <>
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='actions.primary.id'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Select the type of action',
                    }}
                  >
                    {({ DropdownField }) => (
                      <DropdownField
                        label={values.__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'}
                        required={true}
                        options={actions.filter((action) => action[typeMap[values.__kind]])}
                      />
                    )}
                  </AppField>
                </Grid.Col>
                {!specialPrimaryAction && (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='actions.primary.amount'
                      validators={{
                        onChange: z
                          .number(`${values.__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'} must be a number`)
                          .int(
                            `${values.__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'} must be a whole number`
                          )
                          .gte(
                            1,
                            `${values.__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'} must be greater than 0`
                          ),
                      }}
                    >
                      {({ TextField }) => (
                        <TextField
                          required={true}
                          label={values.__kind === 'SpellInput' ? 'Casting Time' : 'Action Increment'}
                        />
                      )}
                    </AppField>
                  </Grid.Col>
                )}
              </>
            )}
            {values.__kind === 'SpellInput' && (
              <>
                {secondaryAction && (
                  <>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField
                        name='actions.secondary.id'
                        validators={{ onSubmit: ({ value }) => !value && 'Select the type of action' }}
                      >
                        {({ DropdownField }) => (
                          <DropdownField
                            label='Secondary Action'
                            required={true}
                            options={actions.filter((action) => action[typeMap[values.__kind]])}
                          />
                        )}
                      </AppField>
                    </Grid.Col>
                    {!specialSecondaryAction && (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='actions.secondary.amount'
                          validators={{
                            onChange: z
                              .number('Increment must be a number')
                              .int('Increment must be a whole number')
                              .gte(1, 'Increment must be greater than 0'),
                            onSubmit: ({ value }) => !value && 'Please enter an increment',
                          }}
                        >
                          {({ TextField }) => <TextField label='Sec. Increment' required={true} />}
                        </AppField>
                      </Grid.Col>
                    )}
                  </>
                )}
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='duration.id'
                    validators={{
                      onSubmit: ({ value }) => !value && 'Select a duration',
                    }}
                  >
                    {({ DropdownField }) => <DropdownField required={true} options={durations} label='Duration' />}
                  </AppField>
                </Grid.Col>
                {values?.duration &&
                  values.duration?.id !== Durations.INSTANTANEOUS &&
                  values.duration?.id !== Durations.UNTIL_DISPELLED &&
                  values.duration?.id !== Durations.SPECIAL && (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField
                        name='duration.amount'
                        validators={{
                          onSubmit: ({ value }) => !value && 'Please enter a duration increment',
                          onChange: z
                            .number('Duration must be a number')
                            .int('Duration must be a whole number')
                            .gte(1, 'Duration must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => <TextField label='Duration Increment' required={true} />}
                      </AppField>
                    </Grid.Col>
                  )}
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='range.id' validators={{ onSubmit: ({ value }) => !value && 'Select a range' }}>
                    {({ DropdownField }) => <DropdownField required={true} options={ranges} label='Range' />}
                  </AppField>
                </Grid.Col>
                {values?.range?.id !== Ranges.TOUCH &&
                  values.range?.id !== Ranges.SIGHT &&
                  values.range?.id !== Ranges.UNLIMITED &&
                  values.range?.id !== Ranges.SELF && (
                    <>
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='range.minRange'
                          validators={{
                            onSubmit: ({ value }) =>
                              values.range?.id === Ranges.DISTANCE ? !value && 'Please enter a min range' : null,
                            onChange: z
                              .number('Min. range must be a number')
                              .gte(1, 'Min. range must be greater than 0'),
                          }}
                        >
                          {({ TextField }) => (
                            <TextField
                              label='Min. Range'
                              required={values.range?.id === Ranges.DISTANCE ? true : false}
                            />
                          )}
                        </AppField>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='range.maxRange'
                          validators={{
                            onSubmit: ({ value }) =>
                              values.range?.id === Ranges.DISTANCE ? !value && 'Please enter a max range' : null,
                            onChange: z
                              .number('Max. range must be a number')
                              .gte(1, 'Max. range must be greater than 0'),
                          }}
                        >
                          {({ TextField }) => (
                            <TextField
                              label='Max. Range'
                              required={values.range?.id === Ranges.DISTANCE ? true : false}
                            />
                          )}
                        </AppField>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='range.unit'
                          validators={{ onSubmit: ({ value }) => !value && 'Select a range unit of measurement' }}
                        >
                          {({ DropdownField }) => (
                            <DropdownField required={true} options={rules.measurements.imperial.length} label='UoM' />
                          )}
                        </AppField>
                      </Grid.Col>
                    </>
                  )}
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField name='shape.id' validators={{ onSubmit: ({ value }) => !value && 'Select a shape' }}>
                    {({ DropdownField }) => <DropdownField required={true} options={shapes} label='Shape' />}
                  </AppField>
                </Grid.Col>
                {values?.shape?.id && values.shape?.id !== Shapes.NONE && values.shape?.id !== Shapes.WEAPON && (
                  <>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField
                        name='shape.size'
                        validators={{
                          onChange: z.number('Shape size must be a number').gte(1, 'Shape size must be greater than 0'),
                        }}
                      >
                        {({ TextField }) => <TextField label='Shape Size' />}
                      </AppField>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField
                        name='shape.unit'
                        validators={{
                          onSubmit: ({ value }) =>
                            values?.shape?.size != null ? !value && 'Select a shape size unit of measurement' : null,
                        }}
                      >
                        {({ DropdownField }) => (
                          <DropdownField required={values?.shape?.size != null} options={shapes} label='UoM' />
                        )}
                      </AppField>
                    </Grid.Col>
                  </>
                )}
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <AppField
                    name='targets'
                    validators={{
                      onChange: z
                        .number('Target count must be a number')
                        .int('Target count must be a whole number')
                        .gte(1, 'Target count must be greater than 0'),
                    }}
                  >
                    {({ TextField }) => <TextField label='Target Count' />}
                  </AppField>
                </Grid.Col>
                {values?.attributes?.some((attribute) => attribute === AttributesEnum.APPLIES_CONDITION) && (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='conditions'
                      validators={{ onSubmit: ({ value }) => !value && 'Select a condition' }}
                    >
                      {({ DropdownField }) => <DropdownField required={true} options={conditions} label='Condition' />}
                    </AppField>
                  </Grid.Col>
                )}
              </>
            )}
            {values.__kind !== 'RaceInput' &&
              values.__kind !== 'BackgroundInput' &&
              values.__kind !== 'CharacterInput' &&
              values.__kind !== 'ClassInput' &&
              requiresSave && (
                <>
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <AppField
                      name='saveAbility.id'
                      validators={{ onSubmit: ({ value }) => !value && 'Select a DC ability' }}
                    >
                      {({ DropdownField }) => <DropdownField required={true} options={abilities} label='DC Ability' />}
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
                  {values?.saveAbility?.attributes?.some(
                    (attribute) => attribute === AttributesEnum.ADD_ABILITY_MODIFIER
                  ) && (
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
                  {values.__kind !== 'SpellInput' && (
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
                  )}
                </>
              )}
          </Grid>
        </Grid.Col>
        {values.__kind === 'ClassInput' && (
          <>
            {/* {primaryAbility && <Multiclass formStore={formStore as FormStore<typeof data>} />}
                {hasResourcePoints && <Resource formStore={formStore as FormStore<typeof data>} />}
                {isSpellcaster && <Spellcasting formStore={formStore as FormStore<typeof data>} />}
                {(isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
                  <LevelAttributes formStore={formStore as FormStore<typeof data>} />
                )} */}
            {values?.subtypes?.length && (
              <Collapsible>
                <Collapsible.Trigger title={'Subtypes'} />
                <Collapsible.Content>
                  <Grid>
                    <Grid.Col>Name</Grid.Col>
                    {values.subtypes?.length && (
                      <AppField name='subtypes' mode='array'>
                        {(field) =>
                          field.state.value?.map((_, i) => (
                            <Fragment key={i}>
                              <Grid.Col span={6}>
                                <AppField
                                  name={`subtypes[${i}].label`}
                                  validators={{ onSubmit: ({ value }) => !value && 'Please enter a subtype name' }}
                                >
                                  {({ TextField }) => <TextField label='Name' />}
                                </AppField>
                              </Grid.Col>
                              <Grid.Col
                                span={{ base: 6, md: 4, lg: 2 }}
                                className={sprinkles({ alignContent: 'center' })}
                              >
                                <Group justify='flex-start' grow>
                                  <Button
                                    variant='unstyled'
                                    className={row_button}
                                    onClick={() =>
                                      field.pushValue({
                                        __kind: 'SubtypeInput',
                                        id: uuidv4(),
                                        label: '',
                                      })
                                    }
                                  >
                                    <TbPlus />
                                  </Button>
                                  {i !== 0 && (
                                    <Button
                                      variant='unstyled'
                                      className={row_button}
                                      onClick={() => field.removeValue(i)}
                                    >
                                      <TbX />
                                    </Button>
                                  )}
                                </Group>
                              </Grid.Col>
                            </Fragment>
                          ))
                        }
                      </AppField>
                    )}
                  </Grid>
                </Collapsible.Content>
              </Collapsible>
            )}
          </>
        )}
        {(((values.__kind === 'SpellInput' || values.__kind === 'FeatInput') && doesDamage) ||
          (values.__kind === 'EquipmentInput' && (isWeapon || isSpecial))) && <Damage form={form} fields='damage' />}
        {values.__kind === 'EquipmentInput' && (isArmor || isShield) && (
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
        {/* {values.__kind === 'SpellInput' && canUpcast && <Upcast formStore={formStore as FormStore<typeof data>} />}
            {values.__kind === 'FeatInput' && limitUse && <LimitUse formStore={formStore as FormStore<typeof data>} />}
            {values.__kind === 'FeatInput' && hasPrerequisites && (
              <Requirements formStore={formStore as FormStore<typeof data>} />
            )} */}
      </Grid>
    )
  },
})

export default AttributesStep
