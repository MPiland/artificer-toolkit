import { use } from 'react'
import { FormContext } from '../../FormContext'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { FeatureContext } from '../FeatureContext'
import { Categories } from '../../../../types/enums'
import { Class, FeatureFeat, SectionEnum } from '../../../../../amplify/gql/types'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Prerequisites'
import Grid from '../../../Grid/Grid'
import useSystemData from '../../../../hooks/useSystemData'
import useFeatData from '../../../../hooks/useFeatData'
import type { OnChange } from '../../../../types/types'
import type { SectionStore } from '../../../../store/sectionStore'

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
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={attributes.filter(
            (attribute) =>
              attribute.sections?.length &&
              (attribute.sections.includes(SectionEnum.all) ||
                ((formStore.data as Class).category === Categories.subclass &&
                  attribute.sections.includes(SectionEnum.subclasses)))
          )}
          label={`${startCase('feat')} Attributes`}
          value={data?.attributes}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='feats'
          multiSelect={true}
          label='Feat'
          value={data?.feats}
          options={feats}
          required={true}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {subtypeSpecific &&
        formStore.data.__typename === 'Class' &&
        formStore.data.category === Categories.subclass &&
        formStore.data?.subtypes?.length && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='subtype'
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
            name='selectionCount'
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

export default Feats
