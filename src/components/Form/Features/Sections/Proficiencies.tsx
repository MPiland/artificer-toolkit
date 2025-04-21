import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Class, FeatureProficiency, SectionEnum } from '../../../../../amplify/gql/types'
import { Categories, ProficiencyCategories, ProficiencyLevels } from '../../../../types/enums'
import { getKeyFromId } from '../../../../utils/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Prerequisites'
import Grid from '../../../Grid/Grid'
import useSystemData from '../../../../hooks/useSystemData'
import useEquipmentData from '../../../../hooks/useEquipmentData'
import type { SectionStore } from '../../../../store/sectionStore'
import type { OnChange } from '../../../../types/form'

const Proficiencies = () => {
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
    abilities,
    proficiencies,
    attributes,
    modifiers,
    skills,
    languages,
    equipment: systemEquipment,
    rules,
  } = useSystemData()
  const { equipment } = useEquipmentData()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = useEnumChecks({
    data: data,
  })

  const sectionCategory = modifiers.categories.findCategory(data?.category)

  const path = getKeyFromId(data?.category, ProficiencyCategories)

  const systemOptions = {
    saveAbilities: abilities,
    skills: skills,
    languages: languages,
  } as const

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              (attribute?.sections?.length && attribute?.sections?.includes(SectionEnum.all)) ||
              ((formStore.data as Class).category === Categories.subclass &&
                attribute?.sections?.includes(SectionEnum.subclasses))
          )}
          label={`${startCase('proficiency')} Attributes`}
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='category'
          label='Proficiency Category'
          value={data?.category}
          options={proficiencies.categories}
          required={true}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {sectionCategory != null &&
        (path !== 'equipment' && path !== 'properties' && path !== 'initiative' ?
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={path}
              multiSelect={true}
              label={`${sectionCategory.label} Type`}
              value={data[path]}
              options={systemOptions[path]}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        : <>
            {(sectionCategory.id === ProficiencyCategories.properties ||
              sectionCategory.id === ProficiencyCategories.equipment) &&
              path !== 'initiative' && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name={path}
                      label='Equipment Category'
                      value={data[path]?.category}
                      options={systemEquipment.categories}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name={`${path as 'properties' | 'equipment'}.${
                        sectionCategory.id === ProficiencyCategories.equipment ? 'properties' : 'ids'
                      }`}
                      multiSelect={true}
                      label='Equipment Property'
                      value={
                        data[path]?.[sectionCategory.id === ProficiencyCategories.equipment ? 'properties' : 'ids']
                      }
                      options={systemEquipment.properties.filterByCategory(data[path]?.category)}
                      onChange={{ updateField, removeField }}
                      required={sectionCategory.id === ProficiencyCategories.equipment ? false : true}
                    />
                  </Grid.Item>
                  {sectionCategory.id === ProficiencyCategories.equipment && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`${path as 'equipment'}.ids`}
                        multiSelect={true}
                        label='Equipment'
                        value={data?.equipment?.ids}
                        options={equipment
                          .filterByCategory(data[path]?.category)
                          .filterByEveryProperty(data[path]?.properties)}
                        onChange={{ updateField, removeField }}
                        required={true}
                      />
                    </Grid.Item>
                  )}
                </>
              )}
          </>)}
      <Dropdown
        name='level'
        label='Proficiency Level'
        value={data?.level}
        options={proficiencies.levels}
        required={true}
        onChange={{ updateField, removeField }}
      />
      {data?.level === ProficiencyLevels.halfProficiency && (
        <Dropdown
          name='rounding'
          label='Rounding Type'
          value={data?.rounding}
          options={rules.measurements.rounding}
          required={true}
          onChange={{ updateField, removeField }}
        />
      )}
      {subtypeSpecific &&
        formStore.data.__typename === 'Class' &&
        sectionCategory != null &&
        formStore.data?.subtypes?.length && (
          <Dropdown
            name='subtype'
            label='Subclass Subtype'
            value={data?.subtype}
            options={formStore.data?.subtypes}
            required={true}
            onChange={{ updateField, removeField }}
          />
        )}
      {providesOptions && (
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
      )}
      {hasPrerequisites && (
        <Grid.Item>
          <Prerequisites formStore={sectionStore} />
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Proficiencies
