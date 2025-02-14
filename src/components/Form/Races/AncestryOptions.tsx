import { use } from 'react'
import Input from '../../Input/Input'
import Row from '../../Row/Row'
import { FeatureContext } from '../Features/FeatureContext'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import Collapse from '../../Collapse/Collapse'
import Button from '../../Button/Button'
import { AncestryFeature } from '../../../../amplify/gql/types'
import Accordion from '../../Accordion/Accordion'
import { feature_description, feature_list } from '../Form.css'
import parse from 'html-react-parser'

const AncestryOptions = () => {
  const { ancestryData, updateAncestryData, updateFeatureData, setFeatureStep } = use(FeatureContext)

  const featureArray = ancestryData?.features

  // Add feature
  const handleAddFeature = () => {
    const newFeature: AncestryFeature = {
      __typename: 'AncestryFeature',
      id: '',
    }
    updateFeatureData({ type: 'index', value: featureArray?.length || 0 })
    updateFeatureData({ type: 'reset', value: newFeature })
    updateFeatureData({ type: 'initialReset', value: newFeature })
    setFeatureStep('ancestry')
  }

  // Delete feature
  const handleRemoveFeature = (featureIndex: number) => {
    updateAncestryData({
      type: 'remove',
      path: `features.${featureIndex}`,
    })
  }

  // Edit feature
  const handleEditFeature = (featureIndex: number) => {
    updateFeatureData({ type: 'index', value: featureIndex })
    updateFeatureData({
      type: 'reset',
      value: featureArray[featureIndex],
    })
    updateFeatureData({ type: 'initialReset', value: featureArray[featureIndex] })
    setFeatureStep('ancestry')
  }

  return (
    <>
      <Row>
        <Input
          name='label'
          autoComplete='off'
          label='Ancestry Option Name'
          required={true}
          value={ancestryData?.label}
          errorMsg='Name must not be blank'
          onChange={updateAncestryData}
        />
      </Row>
      <Collapse className={sprinkles({ width: 'size-full' })}>
        <Collapse.Header title='Ancestry Option Description' startOpened={ancestryData?.id == null} />
        <Collapse.Body>
          <RichTextEditor name='desc' onChange={updateAncestryData} value={ancestryData?.desc} />
        </Collapse.Body>
      </Collapse>
      <Button color='primary' style='outline' onClick={handleAddFeature} className={sprinkles({ mb: 'space-3' })}>
        Add Feature
      </Button>

      {featureArray && featureArray.length > 0 && (
        <div className={feature_list}>
          <Accordion dataArray={featureArray} onChange={updateAncestryData} name='features'>
            {featureArray?.map((feature, featureIndex) => (
              <Accordion.Wrapper key={featureIndex} itemId={String(featureIndex)}>
                <Accordion.Header
                  handleRemove={() => handleRemoveFeature(featureIndex)}
                  handleEdit={() => handleEditFeature(featureIndex)}
                >
                  {feature.label != null && feature.label !== '' ? feature.label : `Feautre ${featureIndex + 1}`}
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
        </div>
      )}
    </>
  )
}
export default AncestryOptions
