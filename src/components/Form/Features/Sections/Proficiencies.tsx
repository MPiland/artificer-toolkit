import { Categories, ProfCats, ProfLevels, Sections } from '@/enums'
import { getKeyFromId, useAppForm, Prerequisites } from '@/components/Form'
import { useEnumChecks, useFieldUpdates } from '@/hooks'
import { useSystemData, useEquipmentData } from '@/hooks'
import type { SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { FeatureProficiencyInputSchema } from '@/schemas'
import { useFormStore, useFeatureProficiencyStore } from '@/store'
import { useEffect } from 'react'

type ProficienciesProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Proficiencies = ({ category, subtypes }: ProficienciesProps) => {
  const current = useFeatureProficiencyStore((state) => state.current)
  const registerForm = useFeatureProficiencyStore((state) => state.registerForm)
  const formReset = useFeatureProficiencyStore((state) => state.formReset)
  const updateField = useFeatureProficiencyStore((state) => state.updateField)
  const removeField = useFeatureProficiencyStore((state) => state.removeField)
  const valid = useFeatureProficiencyStore((state) => state.valid)
  const upsertValid = useFeatureProficiencyStore((state) => state.upsertValid)
  const formAttributes = useFeatureProficiencyStore((state) => state.current?.attributes)
  const formCategory = useFeatureProficiencyStore((state) => state.current?.category)
  const level = useFeatureProficiencyStore((state) => state.current?.level)

  const __kind = useFormStore((state) => state.current?.__kind)

  const form = useAppForm({
    defaultValues: FeatureProficiencyInputSchema.parse(current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'proficiency' })

  const { AppField } = form

  const { abilities, proficiencies, attributes, skills, languages, equipment: systemEquipment, rules } = useSystemData()
  const { equipment } = useEquipmentData()
  const { getAttributes } = useEnumChecks()

  const systemOptions = {
    saveAbilities: abilities,
    skills: skills,
    languages: languages,
  } as const

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [form.reset, registerForm, formReset])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (current?.id && valid.get(current.id) !== isValid) {
        upsertValid(current.id, isValid)
      }
    })
  }, [valid, upsertValid, current?.id, form.store])

  const path = getKeyFromId(formCategory ?? '', ProfCats)
  const sectionCategory = proficiencies.categories.findCategory(formCategory)
  const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({
    attributes: formAttributes || [],
  })

  return (
    <Grid>
      <AppField name='attributes' listeners={fieldListeners}>
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField
              multiselect={true}
              options={attributes.filter(
                (attribute) =>
                  attribute?.sections?.length &&
                  (attribute.sections.includes(Sections.SPELL) ||
                    attribute.sections.includes(Sections.ALL) ||
                    (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
              )}
              label='Attributes'
            />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='category'
        validators={fieldValidators({
          onBlur: 'Select a proficiency category',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField options={proficiencies.categories} required={true} label='Proficiency Category' />
          </Grid.Col>
        )}
      </AppField>
      {sectionCategory != null &&
        path !== 'initiative' &&
        (path !== 'equipment' && path !== 'properties' ?
          <AppField
            name={path}
            validators={fieldValidators({
              onBlur: 'Select at lease one type',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField
                  multiselect={true}
                  options={systemOptions[path]}
                  required={true}
                  label={`${sectionCategory.label} Type`}
                />
              </Grid.Col>
            )}
          </AppField>
        : <>
            <AppField
              name={path}
              validators={fieldValidators({
                onBlur: 'Select an equipment category',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField options={systemEquipment.categories} required={true} label='Equipment Category' />
                </Grid.Col>
              )}
            </AppField>
            <AppField
              name={`${path as 'properties' | 'equipment'}.${
                sectionCategory.id === ProfCats.EQUIPMENT ? 'properties' : 'ids'
              }`}
              validators={fieldValidators({
                onBlur: 'Select at leaset one property',
                condition: sectionCategory.id === ProfCats.EQUIPMENT,
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField
                    multiselect={true}
                    options={systemEquipment.properties.filterByCategory(current?.[path]?.category)}
                    required={sectionCategory.id === ProfCats.EQUIPMENT ? false : true}
                    label='Equipment Properties'
                  />
                </Grid.Col>
              )}
            </AppField>
            {sectionCategory.id === ProfCats.EQUIPMENT && (
              <AppField
                name={`${path as 'equipment'}.ids`}
                validators={fieldValidators({
                  onBlur: 'Select at leaset one equipment',
                })}
                listeners={fieldListeners}
              >
                {({ DropdownField }) => (
                  <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                    <DropdownField
                      multiselect={true}
                      options={equipment
                        .filterByCategory(current?.[path]?.category)
                        .filterByEveryProperty(current?.[path]?.properties)}
                      required={true}
                      label='Equipment'
                    />
                  </Grid.Col>
                )}
              </AppField>
            )}
          </>)}
      <AppField
        name='level'
        validators={fieldValidators({
          onBlur: 'Select a proficiency level',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField options={proficiencies.levels} required={true} label='Proficiency Level' />
          </Grid.Col>
        )}
      </AppField>
      {level === ProfLevels.HALF_PROFICIENCY && (
        <AppField
          name='rounding'
          validators={fieldValidators({
            onBlur: 'Select a rounding type',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField options={rules.measurements.rounding} required={true} label='Rounding Type' />
            </Grid.Col>
          )}
        </AppField>
      )}
      {subtypeSpecific && __kind === 'ClassInput' && sectionCategory != null && subtypes?.length && (
        <AppField
          name='subtype'
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField options={subtypes} required={true} label='Subclass Subtype' />
            </Grid.Col>
          )}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name='selectionCount'
          validators={fieldValidators({
            onBlur: 'Enter a number of selections allowed',
            onChange: { type: 'integer', min: 1, name: 'Selection count' },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField required={true} label='# of Selections' />
            </Grid.Col>
          )}
        </AppField>
      )}
      {hasPrerequisites && (
        <Grid.Col>
          <Prerequisites
            form={form}
            fields='prerequisites'
            __kind='FeatureProficiencyInput'
            updateFn={updateField}
            removeFn={removeField}
          />
        </Grid.Col>
      )}
    </Grid>
  )
}

export default Proficiencies
