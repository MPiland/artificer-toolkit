import { z } from 'zod/v4'
import { useEffect } from 'react'
import { startCase } from 'lodash'
import Prerequisites from '../../Substeps/Prerequisites'
import Damage from '../../Substeps/Damage'
import LimitUse from '../../Substeps/LimitUse'
import {
  Attributes as AttributesEnum,
  Feats,
  Features,
} from '@/enums'
import { useEnumChecks, useSystemData } from '@/hooks'
import { Grid } from '@mantine/core'
import { withForm } from '../../utils/factory'
import { FeatInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'

const defaultValues: z.input<typeof FeatInputSchema> = FeatInputSchema.parse({})

const AttributesStep = withForm({
  defaultValues,
  render: function Render({ form }) {
    const {
      formActions,
      formAttributes,
      prerequisites,
    } = useStore(form.store, (state) => ({
      formActions:state.values.actions,
      formAttributes: state.values.attributes,
      damage:state.values.damage,
      prerequisites: state.values.prerequisites,
    }))
    const { AppField, Subscribe, setFieldValue } = form

    const {
      attributes,
      actions,
      abilities,
    } = useSystemData()

    const { getAttributes, getActions, getPrerequisites } =
      useEnumChecks()

    const { specialPrimaryAction } = getActions({ actions: formActions })

    const {
      doesDamage,
      hasPrerequisites,
      isAction,
      requiresSave,
      primaryAbility,
      limitUse,
    } = getAttributes({ attributes: formAttributes })

    const { equipped, notEquipped, equipmentProficiency } = getPrerequisites({ options: prerequisites?.options })

    // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
    useEffect(() => {
      const cleanup = () => {
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

      const cleanupRules = cleanup()
      if (cleanupRules) {
        cleanupRules.forEach(({ condition, cleanup }) => {
          if (condition) cleanup()
        })
      }
    }, [
      prerequisites,
      setFieldValue,
      hasPrerequisites,
      equipmentProficiency,
      equipped,
      notEquipped,
    ])

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
          formAttributes: state.values.saveAbility?.attributes ?? [],
          features: state.values.features ?? [],
        })}
      >
        {({ __kind, formAttributes, features }) => (
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
                              if (__kind === 'FeatInput' && attribute?.feats?.length) {
                                return attribute.feats.includes(Feats.ALL)
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
                </>
                {isAction && (
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
                            label='Action Type'
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
                              .number('Action Type must be a number')
                              .int('Casting Time must be a whole number')
                              .gte(1, 'Casting Time must be greater than 0'),
                          }}
                        >
                          {({ TextField }) => <TextField required={true} label='Action Increment' />}
                        </AppField>
                      </Grid.Col>
                    )}
                  </>
                )}
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

            {__kind === 'FeatInput' && doesDamage && (
              <Damage form={form} fields='damage' __kind={__kind} properties={undefined} />
            )}
            {limitUse && <LimitUse form={form} fields='charges' __kind={__kind} /> && hasPrerequisites && (
              <Prerequisites form={form} fields='prerequisites' __kind={__kind} features={features} />
            )}
          </Grid>
        )}
      </Subscribe>
    )
  },
})

export default AttributesStep
