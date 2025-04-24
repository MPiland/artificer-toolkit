import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { startCase } from 'lodash'
import { use, useEffect } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Categories, ProfCats, Classes, Sections } from '@/enums'
import Prerequisites from '../../Substeps/Prerequisites'
import Grid from '@/components/Grid'
import { useSystemData, useEquipmentData, useEnumChecks } from '@/hooks'
import type { OnChange, FeatureProficiency } from '@/types'
import type { SectionStore } from '@/store'

type CategoryType = 'skills' | 'equipment' | 'abilities' | 'saveAbilities' | 'properties' | 'languages'

const Expertise = () => {
  const { formStore } = use(FormContext)
  const { sectionStore } = use(FeatureContext) as {
    sectionStore: SectionStore<FeatureProficiency>
  }

  const {
    data,
    updateField,
    removeField,
  }: {
    data: FeatureProficiency
    updateField: OnChange<FeatureProficiency>['updateField']
    removeField: OnChange<FeatureProficiency>['removeField']
  } = sectionStore

  const {
    proficiencies,
    attributes,
    abilities,
    skills,
    equipment: { properties: equipmentProperties, categories: equipmentCategories },
    languages,
  } = useSystemData()

  const { equipment } = useEquipmentData()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = useEnumChecks({
    data,
  })

  const sectionCategory = proficiencies.categories.find((category) => category.id === data?.category)

  const categoryName = sectionCategory?.value as CategoryType

  useEffect(() => {
    if (data.__typename == null) {
      updateField({
        path: '__typename',
        value: 'FeatureExpertise',
      })
    }
  }, [updateField, data.__typename])

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              (attribute.sections?.length && attribute.sections.includes(Sections.ALL)) ||
              (formStore.data.__typename === 'Class' &&
                formStore.data.category === Categories.SUBCLASS &&
                attribute.classes?.length &&
                attribute.classes.includes(Classes.SUBCLASS))
          )}
          label={`${startCase('proficiency')} Attributes`}
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name={`category`}
          label='Proficiency Category'
          value={data?.category}
          options={proficiencies.categories}
          required={true}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {sectionCategory?.id &&
        ((
          sectionCategory.id !== ProfCats.PROPERTIES &&
          sectionCategory.id !== ProfCats.EQUIPMENT &&
          sectionCategory.id !== ProfCats.INITIATIVE
        ) ?
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={`${categoryName as 'skills' | 'saveAbilities' | 'languages'}`}
              multiSelect={true}
              label={`${startCase(categoryName)} Type`}
              value={data[categoryName as 'skills' | 'saveAbilities' | 'languages']}
              options={
                categoryName === 'saveAbilities' ? abilities
                : categoryName === 'skills' ?
                  skills
                : languages
              }
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        : <>
            {(data?.category === ProfCats.PROPERTIES || data?.category !== ProfCats.EQUIPMENT) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name={`${categoryName as 'properties' | 'equipment'}.category`}
                    label='Equipment Category'
                    value={data[categoryName as 'properties' | 'equipment']?.category}
                    options={equipmentCategories}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name={`${categoryName as 'properties' | 'equipment'}.${
                      categoryName === 'equipment' ? 'properties' : 'ids'
                    }`}
                    multiSelect={true}
                    label='Equipment Property'
                    value={data[categoryName as 'properties' | 'equipment']?.properties}
                    options={equipmentProperties.filterByCategory(
                      data[categoryName as 'properties' | 'equipment']?.category
                    )}
                    onChange={{ updateField, removeField }}
                    required={categoryName === 'equipment' ? false : true}
                  />
                </Grid.Item>
                {categoryName === 'equipment' && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`${categoryName}`}
                        multiSelect={true}
                        label='Equipment'
                        value={data?.[categoryName]?.ids}
                        options={equipment
                          .filterByCategory(data[categoryName as 'properties' | 'equipment']?.category)
                          .filterByProperties(data[categoryName as 'properties' | 'equipment']?.properties)}
                        onChange={{ updateField, removeField }}
                        required={true}
                      />
                    </Grid.Item>
                  </>
                )}
              </>
            )}
          </>)}
      {subtypeSpecific &&
        formStore.data.__typename === 'Class' &&
        formStore.data.category === Categories.SUBCLASS &&
        formStore.data?.subtypes?.length && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='subtype'
              label='Subclass Subtypes'
              value={data?.subtype}
              options={formStore.data?.subtypes}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        )}
      {providesOptions && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Input
            validation='num'
            name={`selectionCount`}
            label='# of Selections'
            autoComplete='off'
            value={data?.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={{ updateField }}
          />
        </Grid.Item>
      )}
      {hasPrerequisites && (
        <Grid.Item>
          <Prerequisites formStore={sectionStore} />
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Expertise
