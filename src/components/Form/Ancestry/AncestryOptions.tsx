import { use } from 'react'
import Input from '@/components/Input'
import { FeatureContext } from '../Features/FeatureContext'
import RichTextEditor from '@/components/RichTextEditor'
import Collapsible from '@/components/Collapsible'
import Button from '@/components/Button'
import Accordion from '@/components/Accordion'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import type { AncestryFeature, AncestryOption } from '@/types'
import { Grid } from '@mantine/core'

const AncestryOptions = () => {
  const { ancestryStore, featureStore } = use(FeatureContext)

  const featureArray = ancestryStore.data?.features

  // Add feature
  const handleAddFeature = () => {
    const newFeature = { __typename: 'AncestryFeature' } as AncestryFeature
    featureStore.setIndex({ value: featureArray?.length || 0 })
    featureStore.reinitState(newFeature)
    featureStore.setStep('ancestry')
  }

  // Delete feature
  const handleRemoveFeature = (featureIndex: number) => {
    ancestryStore.removeField({ path: `features.${featureIndex}` })
  }

  // Edit feature
  const handleEditFeature = (featureIndex: number) => {
    featureStore.setIndex({ value: featureIndex })
    featureStore.reinitState(featureArray?.[featureIndex])
    featureStore.setStep('ancestry')
  }

  return (
    <>
      <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
        <Input<AncestryOption>
          name='label'
          autoComplete='off'
          label='Ancestry Option Name'
          required={true}
          value={ancestryStore.data?.label}
          errorMsg='Name must not be blank'
          onChange={{ updateField: ancestryStore.updateField }}
        />
      </Grid.Col>
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title='Ancestry Option Description' defaultOpened={ancestryStore.data?.id == null} />
          <Collapsible.Content>
            <RichTextEditor<AncestryOption>
              name='desc'
              onChange={{ updateField: ancestryStore.updateField }}
              value={ancestryStore.data?.desc}
            />
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
      <Grid.Col>
        <Button color='primary' style='outline' onClick={handleAddFeature}>
          Add Feature
        </Button>
      </Grid.Col>
      {featureArray && featureArray.length > 0 && (
        <Grid.Col>
          <Accordion<AncestryOption>
            dataArray={featureArray}
            updateFn={{ updateField: ancestryStore.updateField }}
            name='features'
            type='single'
          >
            {featureArray?.map((feature, fIndex) => (
              <Accordion.Item key={fIndex} itemId={String(fIndex)} value={feature.id}>
                <Accordion.Trigger
                  removeFn={() => handleRemoveFeature(fIndex)}
                  editFn={() => handleEditFeature(fIndex)}
                >
                  {feature.label != null && feature.label !== '' ? feature.label : `Feautre ${fIndex + 1}`}
                </Accordion.Trigger>
                {feature.desc && (
                  <Accordion.Content>
                    <div className={feature_description}>
                      <div>{feature?.desc && parse(feature.desc)}</div>
                    </div>
                  </Accordion.Content>
                )}
              </Accordion.Item>
            ))}
          </Accordion>
        </Grid.Col>
      )}
    </>
  )
}
export default AncestryOptions
