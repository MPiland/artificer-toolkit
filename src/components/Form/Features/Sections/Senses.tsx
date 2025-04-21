import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Class, FeatureSense, SectionEnum } from '../../../../../amplify/gql/types'
import { Attributes, Categories } from '../../../../types/enums'
import Grid from '../../../Grid/Grid'
import useSystemData from '../../../../hooks/useSystemData'
import { SectionStore } from '../../../../store/sectionStore'
import type { OnChange } from '../../../../types/form'

const Senses = () => {
  const { formStore } = use(FormContext)
  const { sectionStore } = use(FeatureContext) as {
    sectionStore: SectionStore<FeatureSense>
  }

  const {
    data,
    updateField,
    removeField,
  }: {
    data: FeatureSense
    updateField: OnChange<FeatureSense>['updateField']
    removeField: OnChange<FeatureSense>['removeField']
  } = sectionStore

  const { senses, attributes } = useSystemData()

  const providesOptions = data?.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              attribute.sections &&
              (attribute.sections.includes(SectionEnum.all) ||
                ((formStore.data as Class).category === Categories.subclass &&
                  attribute.sections.includes(SectionEnum.subclasses)))
          )}
          label='Sense Attributes'
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='ids'
          multiSelect={true}
          label='Sense'
          value={data?.ids}
          options={senses}
          required={true}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {data?.attributes?.some((attribute) => attribute === Attributes.providesOptions) &&
        formStore.data.__typename === 'Class' &&
        formStore.data?.subtypes?.length && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={`subtype`}
              label='Subtype'
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
    </Grid>
  )
}

export default Senses
