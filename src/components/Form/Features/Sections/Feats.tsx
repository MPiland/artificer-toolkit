import { use } from 'react'
import { FormContext } from '../../FormContext'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { startCase } from 'lodash'
import { FeatureContext } from '../FeatureContext'
import { Categories, Sections } from '@/enums'
import Prerequisites from '../../Substeps/Prerequisites'
import { useSystemData, useFeatData, useEnumChecks } from '@/hooks'
import { type OnChange, FeatureFeat, Class } from '@/types'
import type { SectionStore } from '@/store'
import { Grid } from '@mantine/core'

const Feats = () => {
  const { formStore } = use(FormContext)
  const { sectionStore } = use(FeatureContext) as {
    sectionStore: SectionStore<FeatureFeat>
  }

  const {
    data,
    updateField,
    removeField,
  }: {
    data: FeatureFeat
    updateField: OnChange<FeatureFeat>['updateField']
    removeField: OnChange<FeatureFeat>['removeField']
  } = sectionStore

  const { attributes } = useSystemData()
  const { feats } = useFeatData()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = useEnumChecks({
    data: data,
  })

  return (
    <Grid>
      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              attribute.sections?.length &&
              (attribute.sections.includes(Sections.ALL) ||
                ((formStore.data as Class).category === Categories.SUBCLASS &&
                  attribute.sections.includes(Sections.SUBCLASS)))
          )}
          label={`${startCase('feat')} Attributes`}
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Col>
      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='feats'
          multiSelect={true}
          label='Feat'
          value={data?.feats}
          options={feats}
          required={true}
          onChange={{ updateField, removeField }}
        />
      </Grid.Col>
      {subtypeSpecific &&
        formStore.data.__typename === 'Class' &&
        formStore.data.category === Categories.SUBCLASS &&
        formStore.data?.subtypes?.length && (
          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='subtype'
              label='Subtype'
              value={data?.subtype}
              options={formStore.data?.subtypes}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Col>
        )}
      {providesOptions && (
        <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
          <Input
            validation='num'
            name='selectionCount'
            label='# of Selections'
            autoComplete='off'
            value={data?.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={{ updateField }}
          />
        </Grid.Col>
      )}
      {hasPrerequisites && (
        <Grid.Col>
          <Prerequisites formStore={sectionStore} />
        </Grid.Col>
      )}
    </Grid>
  )
}

export default Feats
