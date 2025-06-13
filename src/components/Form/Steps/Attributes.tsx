import { z } from 'zod/v4'
import { useEffect, Fragment, useMemo, type ReactNode } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import { startCase } from 'lodash'
import Collapsible from '@/components/Collapsible'
import Prerequisites from '../Substeps/Prerequisites'
import Damage from '../Substeps/Damage'
import Upcast from '../Substeps/Upcast'
import LevelAttributes from '../Substeps/Class/LevelAttributes'
import Spellcasting from '../Substeps/Class/Spellcasting'
import Resource from '../Substeps/Class/Resource'
import LimitUse from '../Substeps/LimitUse'
import Multiclass from '../Substeps/Class/Multiclass'
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
import { Grid, Group, Divider, Button } from '@mantine/core'
import { withForm } from '../utils/factory'
import { discriminatedDomainInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@tanstack/react-form'
import { getUpcastOptions } from '../utils/utils'
import type { RangeInput, EquipmentRangeInput, AncestryFeatureInput, FeatureInput } from '@/types'

const defaultValues: z.input<typeof discriminatedDomainInputSchema> = discriminatedDomainInputSchema.parse({})

const AttributesStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const {
      __kind,
      formActions,
      formAttributes,
      resourceMethod,
      properties,
      damage,
      upcast,
      spellcasting,
      levelAttributes,
      category,
      subtypes,
      prerequisites,
      maxSpellLevel,
    } = useStore(form.store, (state) => ({
      __kind: state.values.__kind,
      formActions:
        state.values.__kind === 'SpellInput' || state.values.__kind === 'FeatInput' ? state.values.actions : undefined,
      formAttributes: [
        ...((
          state.values.__kind === 'EquipmentInput' ||
          state.values.__kind === 'SpellInput' ||
          state.values.__kind === 'ClassInput' ||
          state.values.__kind === 'FeatInput'
        ) ?
          (state.values.attributes ?? [])
        : []),
      ],
      resourceMethod: state.values.__kind === 'ClassInput' ? state.values.resource?.method : undefined,
      properties: state.values.__kind === 'EquipmentInput' ? state.values.properties : undefined,
      damage:
        (
          state.values.__kind === 'EquipmentInput' ||
          state.values.__kind === 'FeatInput' ||
          state.values.__kind === 'SpellInput'
        ) ?
          state.values.damage
        : undefined,
      upcast: state.values.__kind === 'SpellInput' ? state.values.upcast : undefined,
      spellcasting: state.values.__kind === 'ClassInput' ? state.values.spellcasting : undefined,
      levelAttributes: state.values.__kind === 'ClassInput' ? state.values.levelAttributes : undefined,
      category:
        (
          state.values.__kind === 'EquipmentInput' ||
          state.values.__kind === 'ClassInput' ||
          state.values.__kind === 'RaceInput'
        ) ?
          state.values.category
        : undefined,
      subtypes: state.values.__kind === 'ClassInput' ? state.values.subtypes : undefined,
      prerequisites: state.values.__kind === 'FeatInput' ? state.values.prerequisites : undefined,
      maxSpellLevel: state.values.__kind === 'ClassInput' ? state.values.spellcasting?.maxSpellLevel : undefined,
    }))
    const { AppField, Subscribe, setFieldValue } = form

    const {
      attributes,
      actions,
      rules,
      conditions,
      abilities,
      spells: { durations, shapes, ranges },
    } = useSystemData()

    const { getAttributes, getActions, getEquipCategories, getResourceMethods, getPrerequisites, getEquipProperties } =
      useEnumChecks()

    const { specialPrimaryAction, specialSecondaryAction } = getActions({ actions: formActions })

    const {
      doesDamage,
      hasPrerequisites,
      isSpellcaster,
      canUpcast,
      stackable,
      isAction,
      secondaryAction,
      requiresSave,
      primaryAbility,
      secondaryAbility,
      optionalAbility,
      hasSubtypes,
      hasResourcePoints,
      limitUse,
      limitKnownSpells,
      magicName,
      preparesSpells,
    } = getAttributes({ attributes: formAttributes })

    const { resourceSetPerLevel } = getResourceMethods({ method: resourceMethod })

    const { isArmor, isAdventuringGear, isShield, isWeapon } = getEquipCategories({ category })

    const { isSpecial } = getEquipProperties({ properties })

    const { equipped, notEquipped, equipmentProficiency } = getPrerequisites({ options: prerequisites?.options })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
        switch (__kind) {
          case 'EquipmentInput':
            return [
              {
                condition: !(isWeapon || !isSpecial || doesDamage) && damage != null,
                cleanup: () => setFieldValue('damage', undefined),
              },
            ]
          case 'SpellInput':
            return [
              {
                condition: !doesDamage && damage != null,
                cleanup: () => setFieldValue('damage', undefined),
              },
              {
                condition: !canUpcast && upcast != null,
                cleanup: () => setFieldValue('upcast', undefined),
              },
            ]
          case 'ClassInput':
            return [
              {
                condition: !isSpellcaster && spellcasting != null,
                cleanup: () => {
                  setFieldValue('spellcasting', undefined)
                  if (__kind === 'ClassInput') {
                    levelAttributes?.map((_, index) => {
                      setFieldValue(`levelAttributes[${index}].spellSlots`, undefined)
                    })
                  }
                },
              },
              {
                condition: (category !== Categories.SUBCLASS || !hasSubtypes) && subtypes?.length,
                cleanup: () => {
                  setFieldValue('subtypes', undefined)
                },
              },
            ]
          case 'FeatInput':
            return [
              {
                condition: !hasPrerequisites && prerequisites != null,
                cleanup: () => setFieldValue('prerequisites', undefined),
              },
              {
                condition: !equipmentProficiency && prerequisites?.equipmentProficiencies?.length,
                cleanup: () => setFieldValue('prerequisites.equipmentProficiencies', undefined),
              },
              {
                condition: !equipped && prerequisites?.equipped?.length,
                cleanup: () => setFieldValue('prerequisites.equipped', undefined),
              },
              {
                condition: !notEquipped && prerequisites?.notEquipped?.length,
                cleanup: () => setFieldValue('prerequisites.notEquipped', undefined),
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
      __kind,
      category,
      upcast,
      prerequisites,
      damage,
      levelAttributes,
      spellcasting,
      subtypes,
      setFieldValue,
      canUpcast,
      isSpellcaster,
      isWeapon,
      doesDamage,
      hasPrerequisites,
      equipmentProficiency,
      equipped,
      notEquipped,
      isSpecial,
      hasSubtypes,
    ])

    // Add Subtypes to Class as necessary
    useEffect(() => {
      if (__kind === 'ClassInput' && category !== Categories.SUBCLASS && hasSubtypes && !subtypes?.length)
        setFieldValue('subtypes', [{ __kind: 'SubtypeInput', id: uuidv4(), label: '' }])
    }, [__kind, category, hasSubtypes, subtypes, setFieldValue])

    // Memoize spell slot labels
    const spellSlotLabels = useMemo(() => {
      const spellLabels: ReactNode[] = []
      if (maxSpellLevel) {
        for (let i = 0; i < maxSpellLevel; i++) {
          spellLabels.push(
            <Grid.Col key={`spell-label-${i}`}>
              <span>{i + 1}</span>
            </Grid.Col>
          )
        }
      }
      return spellLabels
    }, [maxSpellLevel])

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
      <Subscribe
        selector={(state) => ({
          __kind: state.values.__kind,
          category:
            (
              state.values.__kind === 'EquipmentInput' ||
              state.values.__kind === 'ClassInput' ||
              state.values.__kind === 'RaceInput'
            ) ?
              state.values.category
            : null,
          duration: state.values.__kind === 'SpellInput' ? state.values.duration : null,
          shape: state.values.__kind === 'SpellInput' ? state.values.shape : null,
          range:
            state.values.__kind === 'SpellInput' ? (state.values.range as RangeInput)
            : state.values.__kind === 'EquipmentInput' ? (state.values.range as EquipmentRangeInput)
            : null,
          formAttributes: [
            ...(state.values.__kind === 'EquipmentInput' || state.values.__kind === 'SpellInput' ?
              (state.values.attributes ?? [])
            : []),
            ...(state.values.__kind === 'EquipmentInput' || state.values.__kind === 'SpellInput' ?
              (state.values.damage?.attributes ?? [])
            : []),
            ...((
              state.values.__kind === 'EquipmentInput' ||
              state.values.__kind === 'SpellInput' ||
              state.values.__kind === 'FeatInput'
            ) ?
              (state.values.saveAbility?.attributes ?? [])
            : []),
          ],
          features: [
            ...((state.values.__kind !== 'CharacterInput' && state.values.__kind !== 'SpellInput' ?
              (state.values.features ?? [])
            : []) as FeatureInput[]),
            ...((state.values.__kind === 'RaceInput' && state.values.ancestry?.options?.length ?
              (state.values.ancestry.options.flatMap((option) => option.features).filter(Boolean) ?? [])
            : []) as AncestryFeatureInput[]),
          ],
          maxSpellLevel: state.values.__kind === 'ClassInput' ? state.values.spellcasting?.maxSpellLevel : undefined,
          resourceLabel: state.values.__kind === 'ClassInput' ? state.values.resource?.label : undefined,
        })}
      >
        {({ __kind, category, duration, shape, range, formAttributes, features, maxSpellLevel, resourceLabel }) => (
          <Grid>
            <Grid.Col>
              <Grid>
                {__kind !== 'RaceInput' && __kind !== 'BackgroundInput' && __kind !== 'CharacterInput' && (
                  <>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField name='attributes'>
                        {({ DropdownField }) => (
                          <DropdownField
                            multiselect={true}
                            options={attributes
                              .filter((attribute) => {
                                if (__kind === 'EquipmentInput' && attribute?.equipment?.length) {
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
                                if (__kind === 'ClassInput' && attribute?.classes?.length) {
                                  return (
                                    attribute.classes.includes(Classes.BASE) ||
                                    (category === Categories.SUBCLASS &&
                                      attribute.classes.includes(Classes.SUBCLASS)) ||
                                    attribute.classes.includes(Classes.ALL)
                                  )
                                }
                                if (__kind === 'FeatInput' && attribute?.feats?.length) {
                                  return attribute.feats.includes(Feats.ALL)
                                }
                                if (__kind === 'SpellInput' && attribute?.spells?.length) {
                                  return attribute.spells.includes(Spells.ALL)
                                }
                                return false
                              })
                              .filter((attribute) =>
                                primaryAbility ? attribute : attribute.id !== AttributesEnum.OPTIONAL_ABILITY
                              )}
                            label={`${startCase(__kind.replace('Input', ''))} Attributes`}
                          />
                        )}
                      </AppField>
                    </Grid.Col>
                    {__kind === 'EquipmentInput' && stackable && (
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
                {(__kind === 'SpellInput' || __kind === 'FeatInput') && isAction && (
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
                            label={__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'}
                            required={true}
                            options={actions.filter((action) => action[typeMap[__kind]])}
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
                              .number(`${__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'} must be a number`)
                              .int(`${__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'} must be a whole number`)
                              .gte(
                                1,
                                `${__kind === 'SpellInput' ? 'Casting Time' : 'Action Type'} must be greater than 0`
                              ),
                          }}
                        >
                          {({ TextField }) => (
                            <TextField
                              required={true}
                              label={__kind === 'SpellInput' ? 'Casting Time' : 'Action Increment'}
                            />
                          )}
                        </AppField>
                      </Grid.Col>
                    )}
                  </>
                )}
                {__kind === 'SpellInput' && (
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
                                options={actions.filter((action) => action[typeMap[__kind]])}
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
                    {duration?.id &&
                      duration?.id !== Durations.INSTANTANEOUS &&
                      duration?.id !== Durations.UNTIL_DISPELLED &&
                      duration?.id !== Durations.SPECIAL && (
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
                    <Subscribe
                      selector={(state) => ({ range: state.values.__kind === __kind ? state.values.range : null })}
                    >
                      {({ range }) =>
                        range?.id &&
                        range?.id !== Ranges.TOUCH &&
                        range?.id !== Ranges.SIGHT &&
                        range?.id !== Ranges.UNLIMITED &&
                        range?.id !== Ranges.SELF && (
                          <>
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <AppField
                                name='range.minRange'
                                validators={{
                                  onSubmit: ({ value }) =>
                                    range?.id === Ranges.DISTANCE ? !value && 'Please enter a min range' : null,
                                  onChange: z
                                    .number('Min. range must be a number')
                                    .gte(1, 'Min. range must be greater than 0'),
                                }}
                              >
                                {({ TextField }) => (
                                  <TextField
                                    label='Min. Range'
                                    required={range?.id === Ranges.DISTANCE ? true : false}
                                  />
                                )}
                              </AppField>
                            </Grid.Col>
                            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                              <AppField
                                name='range.maxRange'
                                validators={{
                                  onSubmit: ({ value }) =>
                                    range?.id === Ranges.DISTANCE ? !value && 'Please enter a max range' : null,
                                  onChange: z
                                    .number('Max. range must be a number')
                                    .gte(1, 'Max. range must be greater than 0'),
                                }}
                              >
                                {({ TextField }) => (
                                  <TextField
                                    label='Max. Range'
                                    required={range?.id === Ranges.DISTANCE ? true : false}
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
                                  <DropdownField
                                    required={true}
                                    options={rules.measurements.imperial.length}
                                    label='UoM'
                                  />
                                )}
                              </AppField>
                            </Grid.Col>
                          </>
                        )
                      }
                    </Subscribe>
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <AppField name='shape.id' validators={{ onSubmit: ({ value }) => !value && 'Select a shape' }}>
                        {({ DropdownField }) => <DropdownField required={true} options={shapes} label='Shape' />}
                      </AppField>
                    </Grid.Col>
                    {shape?.id && shape?.id !== Shapes.NONE && shape?.id !== Shapes.WEAPON && (
                      <>
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <AppField
                            name='shape.size'
                            validators={{
                              onChange: z
                                .number('Shape size must be a number')
                                .gte(1, 'Shape size must be greater than 0'),
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
                                shape?.size != null ? !value && 'Select a shape size unit of measurement' : null,
                            }}
                          >
                            {({ DropdownField }) => (
                              <DropdownField required={shape?.size != null} options={shapes} label='UoM' />
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
                    {formAttributes?.some((attribute) => attribute === AttributesEnum.APPLIES_CONDITION) && (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <AppField
                          name='conditions'
                          validators={{ onSubmit: ({ value }) => !value && 'Select a condition' }}
                        >
                          {({ DropdownField }) => (
                            <DropdownField required={true} options={conditions} label='Condition' />
                          )}
                        </AppField>
                      </Grid.Col>
                    )}
                  </>
                )}
                {__kind !== 'RaceInput' &&
                  __kind !== 'BackgroundInput' &&
                  __kind !== 'CharacterInput' &&
                  __kind !== 'ClassInput' &&
                  requiresSave && (
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
                      {__kind !== 'SpellInput' && (
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
            {__kind === 'ClassInput' &&
              primaryAbility && (
                <Multiclass
                  fields='multiclass'
                  form={form}
                  primaryAbility={primaryAbility}
                  secondaryAbility={secondaryAbility ?? false}
                  optionalAbility={optionalAbility ?? false}
                />
              ) &&
              isSpellcaster && (
                <Spellcasting
                  fields='spellcasting'
                  form={form}
                  magicName={magicName ?? false}
                  preparesSpells={preparesSpells ?? false}
                />
              ) &&
              (isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
                <Grid.Col>
                  <Collapsible>
                    <Collapsible.Trigger title={'Level Attributes'} />
                    <Collapsible.Content>
                      <Grid>
                        <Grid.Col>
                          <Grid>
                            <Grid.Col>Level</Grid.Col>
                            {hasResourcePoints && <Grid.Col>{resourceLabel ?? 'Resource'} Points</Grid.Col>}
                            {isSpellcaster && (
                              <>
                                <Grid.Col>Cantrips Known</Grid.Col>
                                {limitKnownSpells && <Grid.Col>Spells Known</Grid.Col>}
                                {spellSlotLabels}
                              </>
                            )}
                          </Grid>
                        </Grid.Col>
                        <AppField name='levelAttributes' mode='array'>
                          {(field) =>
                            field.state.value?.map((_, i) => (
                              <LevelAttributes
                                key={`${i}-levelAttributes`}
                                form={form}
                                fields={`levelAttributes[${i}]`}
                                hasResourcePoints={hasResourcePoints ?? false}
                                isSpellcaster={isSpellcaster ?? false}
                                limitKnownSpells={limitKnownSpells ?? false}
                                maxSpellLevel={maxSpellLevel ?? 0}
                                index={i}
                              />
                            ))
                          }
                        </AppField>
                      </Grid>
                    </Collapsible.Content>
                  </Collapsible>
                </Grid.Col>
              ) &&
              hasResourcePoints && <Resource form={form} fields='resource' /> &&
              hasSubtypes && (
                <AppField name='subtypes' mode='array'>
                  {(field) =>
                    field.state.value?.length && (
                      <Collapsible>
                        <Collapsible.Trigger title={'Subtypes'} />
                        <Collapsible.Content>
                          <Grid>
                            <Grid.Col>Name</Grid.Col>
                            {field.state.value?.map((_, i) => (
                              <Fragment key={i}>
                                <Grid.Col span={6}>
                                  <AppField
                                    name={`subtypes[${i}].label`}
                                    validators={{
                                      onSubmit: ({ value }) => !value && 'Please enter a subtype name',
                                    }}
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
                            ))}
                          </Grid>
                        </Collapsible.Content>
                      </Collapsible>
                    )
                  }
                </AppField>
              )}
            {(((__kind === 'SpellInput' || __kind === 'FeatInput') && doesDamage) ||
              (__kind === 'EquipmentInput' && (isWeapon || isSpecial))) && (
              <Damage form={form} fields='damage' __kind={__kind} properties={properties} />
            )}
            {__kind === 'EquipmentInput' && (isArmor || isShield) && (
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
            {__kind === 'SpellInput' && canUpcast && (
              <Upcast
                form={form}
                fields='upcast'
                upcastOptions={getUpcastOptions({
                  systemAttributes: attributes,
                  formAttributes,
                  shape: shape?.id,
                  range: (range as RangeInput)?.id,
                  duration: duration?.id,
                })}
              />
            )}
            {__kind === 'FeatInput' && limitUse && <LimitUse form={form} fields='charges' __kind={__kind} />}
            {__kind === 'FeatInput' && hasPrerequisites && (
              <Prerequisites form={form} fields='prerequisites' __kind={__kind} features={features} />
            )}
          </Grid>
        )}
      </Subscribe>
    )
  },
})

export default AttributesStep
