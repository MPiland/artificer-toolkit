import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Attributes, Categories, Sections } from '@/enums'
import Grid from '@/components/Grid'
import { useSystemData } from '@/hooks'
import type { SectionStore } from '@/store'
import type { OnChange, Class, FeatureSense } from '@/types'

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

  const providesOptions = data?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              attribute.sections &&
              (attribute.sections.includes(Sections.ALL) ||
                ((formStore.data as Class).category === Categories.SUBCLASS &&
                  attribute.sections.includes(Sections.SUBCLASS)))
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
      {data?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) &&
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
