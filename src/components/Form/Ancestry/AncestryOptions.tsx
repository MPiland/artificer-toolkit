import { use } from 'react'
import Input from '@/components/Input'
import { FeatureContext } from '../Features/FeatureContext'
import RichTextEditor from '@/components/RichTextEditor'
import Collapse from '@/components/Collapse'
import Button from '@/components/Button'
import Accordion from '@/components/Accordion'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import Grid from '@/components/Grid'
import type { AncestryFeature, AncestryOption } from '@/types'

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
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Input<AncestryOption>
          name='label'
          autoComplete='off'
          label='Ancestry Option Name'
          required={true}
          value={ancestryStore.data?.label}
          errorMsg='Name must not be blank'
          onChange={{ updateField: ancestryStore.updateField }}
        />
      </Grid.Item>
      <Grid.Item>
        <Collapse>
          <Collapse.Header title='Ancestry Option Description' startOpened={ancestryStore.data?.id == null} />
          <Collapse.Body>
            <RichTextEditor<AncestryOption>
              name='desc'
              onChange={{ updateField: ancestryStore.updateField }}
              value={ancestryStore.data?.desc}
            />
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
      <Grid.Item>
        <Button color='primary' style='outline' onClick={handleAddFeature}>
          Add Feature
        </Button>
      </Grid.Item>
      {featureArray && featureArray.length > 0 && (
        <Grid.Item>
          <Accordion<AncestryOption>
            dataArray={featureArray}
            onChange={{ updateField: ancestryStore.updateField }}
            name='features'
          >
            {featureArray?.map((feature, fIndex) => (
              <Accordion.Wrapper key={fIndex} itemId={String(fIndex)}>
                <Accordion.Header
                  handleRemove={() => handleRemoveFeature(fIndex)}
                  handleEdit={() => handleEditFeature(fIndex)}
                >
                  {feature.label != null && feature.label !== '' ? feature.label : `Feautre ${fIndex + 1}`}
                </Accordion.Header>
                {feature.desc && (
                  <Accordion.Content>
                    <div className={feature_description}>
                      <div>{feature?.desc && parse(feature.desc)}</div>
                    </div>
                  </Accordion.Content>
                )}
              </Accordion.Wrapper>
            ))}
          </Accordion>
        </Grid.Item>
      )}
    </>
  )
}
export default AncestryOptions
