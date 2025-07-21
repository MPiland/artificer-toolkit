import { z } from 'zod/v4'
import { use, useEffect, useMemo } from 'react'
import { Categories, Ranges, Shapes, Features, Attributes } from '@/enums'
import { useEnumChecks, useFieldUpdates, useGetSections, useSystemData } from '@/hooks'
import { useFeatureStore, useFormStore, useFeatureOptionStore } from '@/store'
import OptionsByLevel from './OptionsByLevel'
import { Grid, Button } from '@mantine/core'
import { ModalContext } from '@/components/Modal'
import Collapsible from '@/components/Collapse'
import { SECTION_STEPS, SectionsList, Prerequisites, Damage, LimitUse, useAppForm } from '@/components/Form'
import { FeatureInputSchema, FeatureOptionInputSchema, OptionsByLevelInputSchema } from '@/schemas'

const Feature = () => {
  const featureCurrent = useFeatureStore((state) => state.current)
  const featureOptions = useFeatureStore((state) => state.current?.options)
  const featureAttributes = useFeatureStore((state) => state.current?.attributes)
  const category = useFeatureStore((state) => state.current?.category)
  const featureShape = useFeatureStore((state) => state.current?.shape)
  const featureRange = useFeatureStore((state) => state.current?.range)
  const featureOptionsByLevel = useFeatureStore((state) => state.current?.optionsByLevel)
  const featureUpdateField = useFeatureStore((state) => state.updateField)
  const featureRemoveField = useFeatureStore((state) => state.removeField)
  const featureStep = useFeatureStore((state) => state.step)
  const featureSetStep = useFeatureStore((state) => state.setStep)
  const featureFormReset = useFeatureStore((state) => state.formReset)
  const featureRegisterForm = useFeatureStore((state) => state.registerForm)
  const featureValid = useFeatureStore((state) => state.valid)
  const featureUpsertValid = useFeatureStore((state) => state.upsertValid)

  const optionCurrent = useFeatureOptionStore((state) => state.current)
  const optionAttributes = useFeatureOptionStore((state) => state.current?.attributes)
  const optionShape = useFeatureOptionStore((state) => state.current?.shape)
  const optionRange = useFeatureOptionStore((state) => state.current?.range)
  const optionSetCurrent = useFeatureOptionStore((state) => state.setCurrent)
  const optionUpdateField = useFeatureOptionStore((state) => state.updateField)
  const optionRemoveField = useFeatureOptionStore((state) => state.removeField)

  const formCurrent = useFormStore((state) => state.current)
  const formRemoveField = useFormStore((state) => state.removeField)
  const formUpdateField = useFormStore((state) => state.updateField)

  const { sectionTypeMap } = useGetSections()

  const formKind = formCurrent?.__kind as
    | 'ClassInput'
    | 'RaceInput'
    | 'EquipmentInput'
    | 'BackgroundInput'
    | 'FeatInput'

  const defaultValues =
    featureStep === 'options' ? FeatureOptionInputSchema.parse(optionCurrent) : FeatureInputSchema.parse(featureCurrent)

  const __kind = featureStep === 'options' ? 'FeatureOptionInput' : 'FeatureInput'
  const formAttributes = featureStep === 'options' ? optionAttributes : featureAttributes
  const shape = featureStep === 'options' ? optionShape : featureShape
  const range = featureStep === 'options' ? optionRange : featureRange
  const formOptionsByLevel = featureOptionsByLevel

  const form = useAppForm({
    defaultValues,
  })

  const { AppField } = form

  const { fieldListeners, fieldValidators } = useFieldUpdates({
    data: featureStep === 'options' ? 'option' : 'feature',
  })

  const { showModal } = use(ModalContext)

  const { getAttributes } = useEnumChecks()

  const { optionsByLevel } = getAttributes({
    attributes: formAttributes || [],
  })

  useEffect(() => {
    if (optionsByLevel && !formOptionsByLevel?.length && featureCurrent?.__kind === 'FeatureInput') {
      form.setFieldValue(`optionsByLevel[${0}]`, OptionsByLevelInputSchema.parse({}))
    }
    if (!optionsByLevel && formOptionsByLevel?.length) {
      form.setFieldValue('optionsByLevel', undefined)
    }
  })

  useEffect(() => {
    if (!featureFormReset) {
      featureRegisterForm(form.reset)
    }
  }, [form.reset, featureRegisterForm, featureFormReset])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (featureCurrent?.id && featureValid.get(featureCurrent.id) !== isValid) {
        featureUpsertValid(featureCurrent.id, isValid)
      }
    })
  }, [featureValid, featureUpsertValid, featureCurrent?.id, form.store])

  const { attributes, abilities, categories, spells, actions, rules } = useSystemData()

  const selectSection = (
    sectionStep: (typeof SECTION_STEPS)[number] | 'options',
    __kind: 'FeatureInput' | 'AncestryFeatureInput' | 'FeatureOptionInput'
  ) => {
    if (sectionStep === 'options' && __kind !== 'FeatureOptionInput') {
      optionSetCurrent(FeatureOptionInputSchema.parse({}))
      return featureSetStep('options')
    } else if (sectionStep !== 'options') {
      const sectionObject = sectionTypeMap(sectionStep).schema.parse({})
      sectionTypeMap(sectionStep, sectionObject).setCurrent()
      return featureSetStep(sectionStep)
    }
  }

  const label = formKind === 'FeatInput' ? 'Feat' : 'Feature'

  const updateFn = useMemo(
    () =>
      featureStep === 'features' ? featureUpdateField
      : featureStep === 'options' ? optionUpdateField
      : formUpdateField,
    [featureUpdateField, optionUpdateField, formUpdateField, featureStep]
  )

  const removeFn = useMemo(
    () =>
      featureStep === 'features' ? featureRemoveField
      : featureStep === 'options' ? optionRemoveField
      : formRemoveField,
    [featureRemoveField, optionRemoveField, formRemoveField, featureStep]
  )

  return (
    <Grid>
      <AppField
        name='label'
        validators={fieldValidators({
          onBlur: 'Enter a name for this feature',
        })}
      >
        {({ TextField }) => {
          return (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField label={`${label} Name`} required={true} />
            </Grid.Col>
          )
        }}
      </AppField>
      {__kind === 'FeatureInput' && (
        <AppField
          name='category'
          validators={fieldValidators({
            onBlur: 'Select a category',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField
                label='Feature Category'
                options={categories.filter((category) => category.features)}
                required={true}
              />
            </Grid.Col>
          )}
        </AppField>
      )}
      {category !== Categories.SUBCLASS ?
        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
          <Button
            onClick={() =>
              showModal({
                type: 'addSection',
                props: {
                  onAddSection: selectSection,
                  __kind,
                },
              })
            }
          >
            Add Section
          </Button>
        </Grid.Col>
      : <AppField name='detail' listeners={fieldListeners}>
          {({ RichTextField }) => (
            <Grid.Col>
              <RichTextField label='Feature Detail' />
            </Grid.Col>
          )}
        </AppField>
      }
      <AppField name='desc' listeners={fieldListeners}>
        {({ RichTextField }) => (
          <Grid.Col>
            <RichTextField label='Feature Description' />
          </Grid.Col>
        )}
      </AppField>
      <Grid.Col>
        <Grid>
          {formKind !== 'EquipmentInput' &&
            formKind !== 'BackgroundInput' &&
            !(__kind === 'FeatureOptionInput') &&
            !optionsByLevel && (
              <AppField
                name='levelAvailable'
                validators={fieldValidators({
                  onBlur: 'Enter a level',
                  condition: formKind !== 'RaceInput',
                })}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='Level(s) Available' required={formKind === 'RaceInput' ? false : true} />
                  </Grid.Col>
                )}
              </AppField>
            )}
          {category !== Categories.SUBCLASS && (
            <AppField name='attributes' listeners={fieldListeners}>
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    label='Feature Attribute'
                    multiselect={true}
                    options={attributes.filter(
                      (attribute) =>
                        (attribute?.features?.length &&
                          ((formKind === 'EquipmentInput' && attribute?.features?.includes(Features.EQUIPMENT)) ||
                            (__kind === 'FeatureOptionInput' && attribute?.features?.includes(Features.OPTION)))) ||
                        attribute?.features?.includes(Features.ALL)
                    )}
                  />
                </Grid.Col>
              )}
            </AppField>
          )}
          {formAttributes?.some((attribute) => attribute === Attributes.IS_ACTION) && (
            <AppField
              name='actions.primary.id'
              validators={fieldValidators({
                onBlur: 'Select an action type',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField label='Action' options={actions} required={true} />
                </Grid.Col>
              )}
            </AppField>
          )}
        </Grid>
      </Grid.Col>
      {formAttributes?.some((attribute) => attribute === Attributes.HAS_RANGE) && (
        <Grid.Col>
          <Grid>
            <AppField
              name='range.id'
              validators={fieldValidators({
                onBlur: 'Select a range type',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField label='Range' options={spells.ranges} required={true} />
                </Grid.Col>
              )}
            </AppField>
            {range?.id !== Ranges.TOUCH && range?.id !== Ranges.SIGHT && range?.id !== Ranges.UNLIMITED && (
              <>
                {range?.id !== Ranges.SELF && (
                  <AppField
                    name='range.minRange'
                    validators={fieldValidators({
                      onBlur: 'Enter a minimum range amount',
                      onChange: { type: 'number', min: 0, name: 'Min. Range' },
                      condition: range?.id === Ranges.DISTANCE,
                    })}
                    listeners={fieldListeners}
                  >
                    {({ TextField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <TextField label='Min. Range' required={range?.id === Ranges.DISTANCE || false} />
                      </Grid.Col>
                    )}
                  </AppField>
                )}
                <AppField
                  name='range.maxRange'
                  validators={fieldValidators({
                    onBlur: 'Enter a maximum range amount',
                    onChange: { type: 'number', min: 1, name: 'Max. Range' },
                    condition: range?.id === Ranges.DISTANCE,
                  })}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Max Range' required={range?.id === Ranges.DISTANCE || false} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='range.unit'
                  validators={{
                    onBlur: ({ value }) =>
                      range?.id === Ranges.DISTANCE && !value && 'Select a range unit of measurement',
                  }}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField
                        label='UoM'
                        options={rules.measurements.imperial.length}
                        required={range?.id === Ranges.DISTANCE || false}
                      />
                    </Grid.Col>
                  )}
                </AppField>
              </>
            )}
            {formAttributes?.some((attribute) => attribute === Attributes.LIMIT_TARGETS) && (
              <AppField
                name='targets'
                validators={{
                  onChange: z.int('Target count must be a whole number').gte(1, 'Target count must be greater than 0'),
                }}
                listeners={fieldListeners}
              >
                {({ TextField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <TextField label='No. of Targets' required={range?.id === Ranges.DISTANCE || false} />
                  </Grid.Col>
                )}
              </AppField>
            )}
          </Grid>
          <Grid>
            <AppField
              name='shape.id'
              validators={fieldValidators({
                onBlur: 'Select a shape type',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField label='Shape' options={spells.shapes} required={true} />
                </Grid.Col>
              )}
            </AppField>
            {shape?.id !== Shapes.NONE && shape?.id !== Shapes.WEAPON && shape?.id !== Shapes.CONE && (
              <>
                <AppField
                  name='shape.size'
                  validators={{
                    onChange: z.int('Shape size must be a whole number').gte(1, 'Shape size must be greater than 0'),
                  }}
                  listeners={fieldListeners}
                >
                  {({ TextField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <TextField label='Shape Size' required={true} />
                    </Grid.Col>
                  )}
                </AppField>
                <AppField
                  name='shape.unit'
                  validators={fieldValidators({
                    onBlur: 'Select a shape size unit of measurement',
                  })}
                  listeners={fieldListeners}
                >
                  {({ DropdownField }) => (
                    <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                      <DropdownField label='UoM' options={rules.measurements.imperial.length} required={true} />
                    </Grid.Col>
                  )}
                </AppField>
              </>
            )}
          </Grid>
        </Grid.Col>
      )}
      {formAttributes?.some((attribute) => attribute === Attributes.REQUIRES_SAVE) && (
        <Grid.Col>
          <Grid>
            <AppField name='saveAbility.attributes' listeners={fieldListeners}>
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    label='Save Attribute'
                    multiselect={true}
                    options={attributes.filter(
                      (attribute) => attribute?.features?.length && attribute?.features?.includes(Features.SAVE_ABILITY)
                    )}
                  />
                </Grid.Col>
              )}
            </AppField>
            <AppField
              name='saveAbility.id'
              validators={fieldValidators({
                onBlur: 'Select a save ability',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField label='DC Ability' options={abilities} required={true} />
                </Grid.Col>
              )}
            </AppField>
            {formAttributes?.some((attribute) => attribute === Attributes.ADD_ABILITY_MODIFIER) && (
              <AppField
                name='saveAbility.abilityModifier'
                validators={fieldValidators({
                  onBlur: 'Select a modifier ability',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField label='Modifier Ability' options={abilities} required={true} />
                  </Grid.Col>
                )}
              </AppField>
            )}
            <AppField
              name='saveAbility.minAmount'
              validators={{
                onBlur: ({ value }) => formKind !== 'ClassInput' && !value && 'Enter a min amount',
                onChange: z.int('Min amount must be a whole number').gte(1, 'Min amount must be greater than 0'),
              }}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <TextField label='Min amount' required={formKind !== 'ClassInput'} />
                </Grid.Col>
              )}
            </AppField>
          </Grid>
        </Grid.Col>
      )}
      {formAttributes?.some((attribute) => attribute === Attributes.PREREQUISITES) && (
        <Prerequisites form={form} fields='prerequisites' __kind={__kind} updateFn={updateFn} removeFn={removeFn} />
      )}
      {formAttributes?.some((attribute) => attribute === Attributes.LIMIT_USE) && (
        <LimitUse form={form} fields='charges' __kind={__kind} updateFn={updateFn} removeFn={removeFn} />
      )}
      {formAttributes?.some((attribute) => attribute === Attributes.DOES_DAMAGE) && (
        <Damage form={form} fields='damage' __kind={__kind} updateFn={updateFn} removeFn={removeFn} />
      )}
      {formAttributes?.some((attribute) => attribute === Attributes.OPTIONS_BY_LEVEL) && (
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: 'Select Options By Level',
              },
            }}
          >
            <Grid>
              <Grid.Col>
                <Grid>
                  <Grid.Col>Level</Grid.Col>
                  <Grid.Col>Count</Grid.Col>
                  {formAttributes.some((attribute) => attribute === Attributes.REPLACE_AT_LEVEL) && (
                    <Grid.Col>Replace Count</Grid.Col>
                  )}
                </Grid>
              </Grid.Col>
              <AppField name='optionsByLevel' mode='array'>
                {({ state }) =>
                  state.value?.map((_, i) => (
                    <OptionsByLevel
                      form={form}
                      fields={`optionsByLevel[${i}]`}
                      index={i}
                      replaceAtLevel={formAttributes.some((attribute) => attribute === Attributes.REPLACE_AT_LEVEL)}
                    />
                  ))
                }
              </AppField>
            </Grid>
          </Collapsible>
        </Grid.Col>
      )}
      <>
        {SECTION_STEPS.some((step) => {
          return featureStep === 'options' ? optionCurrent?.[step]?.length : featureCurrent?.[step]?.length
        }) ||
          (__kind !== 'FeatureOptionInput' && featureOptions?.length && (
            <SectionsList
              form={form}
              fields={{
                modifiers: 'modifiers',
                spells: 'spells',
                senses: 'senses',
                expertise: 'expertise',
                proficiencies: 'proficiencies',
                feats: 'feats',
                options: 'options',
              }}
            />
          ))}
      </>
    </Grid>
  )
}

export default Feature
