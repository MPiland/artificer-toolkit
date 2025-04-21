import { use } from 'react'
import Input from '../../Input/Input'
import { FeatureContext } from '../Features/FeatureContext'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import Collapse from '../../Collapse/Collapse'
import Button from '../../Button/Button'
import { AncestryFeature } from '../../../../amplify/gql/types'
import Accordion from '../../Accordion/Accordion'
import { feature_description } from '../Form.css'
import parse from 'html-react-parser'
import Grid from '../../Grid/Grid'

const AncestryOptions = () => {
  const { ancestryStore, featureStore } = use(FeatureContext)

  const featureArray = ancestryStore.data?.features

  // Add feature
  const handleAddFeature = () => {
    const newFeature = { __typename: 'AncestryFeature' } as AncestryFeature
    featureStore.setIndex({ value: featureArray?.length || 0 })
    featureStore.reinitState(newFeature)
    setFeatureStep('ancestry')
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
        <Input
          name='label'
          autoComplete='off'
          label='Ancestry Option Name'
          required={true}
          value={ancestryStore.data?.label}
          errorMsg='Name must not be blank'
          onChange={ancestryStore}
        />
      </Grid.Item>
      <Grid.Item>
        <Collapse>
          <Collapse.Header title='Ancestry Option Description' startOpened={ancestryStore.data?.id == null} />
          <Collapse.Body>
            <RichTextEditor name='desc' onChange={ancestryStore} value={ancestryStore.data?.desc} />
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
          <Accordion dataArray={featureArray} onChange={ancestryStore} name='features'>
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
