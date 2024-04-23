import { useEffect, useState } from 'react'
import parse from 'html-react-parser'
import Button from '../../Button/Button'
import { ReducerActionType, FeatureStepName, FormContext, Step } from '../../../utils/types'
import { feature_list, form_content, feature_description } from '../Form.css'
import Accordion from '../../Accordion/Accordion'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { getSectionNames } from '../../../utils/formUtils'
import Group from '../../Group/Group'
import { get, startCase } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import Input from '../../Input/Input'
import Grid from '../../Grid/Grid'
import Collapse from '../../Collapse/Collapse'
import { selectAllRaces, useGetRacesQuery } from '../../../features/race/raceApiSlice'
import { useLocation, useNavigate } from 'react-router-dom'

interface FeatureListProps {
  context: FormContext
  formState: any
  setFormState: (arg: ReducerActionType) => void
  featureStepName: FeatureStepName
  setFeatureStepName: (arg: FeatureStepName) => void
  setFeatureState: (arg: ReducerActionType) => void
  setOldFeatureState: (arg: any) => void
  setFeatureIndex: (arg: number) => void
  optionState: any
  stepName: Step
}

const FeatureList = ({
  context,
  formState,
  setFormState,
  featureStepName,
  setFeatureStepName,
  setFeatureState,
  setOldFeatureState,
  setFeatureIndex,
  stepName,
}: FeatureListProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const copy = location.state.copy

  const [activeIndex, setActiveIndex] = useState<number | null>(context.type !== 'new' ? null : 0)
  const [arrayName, setArrayName] = useState<any | any[]>(null)
  const [featureArray, setFeatureArray] = useState<any[]>()

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
  })

  // Set features from parent races
  useEffect(() => {
    if (
      formState.category?.name === 'subrace' &&
      formState.lineage?.length > 0 &&
      (formState.feature == null || !(formState.feature?.length > 0))
    ) {
      let features: any[] = []
      formState.lineage?.map((lineageItem: any) => {
        const parentRace = races?.find((raceItem: any) => raceItem._id === lineageItem._id) as any
        if (parentRace && parentRace.feature?.length > 0) {
          features = [...features, ...parentRace.feature]
        }
      })

      setFormState({
        target: {
          name: 'feature',
          value: features,
        },
      })
    }
  }, [formState.category?.name, formState.lineage, formState.feature, races, setFormState])

  useEffect(() => {
    if (context.title === 'feat') {
      setArrayName('')
    } else if (stepName === 'Ancestry') {
      setArrayName(['ancestry', 'option'])
    } else {
      setArrayName('feature')
    }
  }, [context.title, formState?.ancestry?.option, formState?.feature, formState, stepName])

  // Set feature array if exists
  useEffect(() => {
    setFeatureArray(get(formState, arrayName))
  }, [arrayName, formState])

  // Copy feature
  useEffect(() => {
    if (copy === true) {
      const feature = location.state.feature
      if (featureArray && featureArray.length > 0) {
        setFeatureIndex(featureArray.length)
      } else {
        setFeatureIndex(0)
      }
      setFeatureState({ type: 'reset', target: { value: feature } })
      setOldFeatureState(feature)
      setFeatureStepName('FeatureContent')
    }
  }, [
    copy,
    featureArray,
    location.state.feature,
    setFeatureIndex,
    setFeatureState,
    setOldFeatureState,
    setFeatureStepName,
  ])

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  // Add feature
  const handleAdd = () => {
    if (featureArray && featureArray.length > 0) {
      setFeatureIndex(featureArray?.length)
    } else {
      setFeatureIndex(0)
    }
    setFeatureState({ type: 'reset', target: { value: {} } })
    setOldFeatureState({})
    setFeatureStepName('FeatureContent')
  }

  // Delete feature
  const handleRemove = (featureIndexProp: number) => {
    setFormState({
      type: 'removed',
      target: { name: `${arrayName}.${featureIndexProp}` },
    })
  }

  // Edit feature
  const handleEdit = (featureIndexProp: number) => {
    if (featureArray) {
      const featureStateProp = featureArray[featureIndexProp]
      setFeatureIndex(featureIndexProp)
      setFeatureState({
        type: 'reset',
        target: { value: featureStateProp },
      })
      setOldFeatureState(featureStateProp)
      setFeatureStepName('FeatureContent')
    }
  }

  // Copy feature
  const handleCopy = () => {
    navigate(`/copy/feature`, {
      state: {
        background: location,
      },
    })
  }

  const sectionNames = getSectionNames()

  return (
    <>
      <Group directionVariant='column' alignItemsVariant='start' className={sprinkles({ px: 'size-4' })}>
        {stepName === 'Ancestry' && featureStepName === '' && featureArray && featureArray.length > 0 && (
          <>
            <Grid className={sprinkles({ mb: 'size-3' })}>
              <Input
                name='ancestry.value'
                autoComplete='off'
                label='Ancestry Name'
                required={formState?.ancestry?.desc !== '' && formState?.ancestry?.desc != null}
                value={formState?.ancestry?.value}
                errorMsg='Name must not be blank'
                onChange={setFormState}
              />
            </Grid>
            <Collapse
              title='Ancestry Description'
              className={sprinkles({ width: 'full' })}
              startOpened={context.type === 'new'}
            >
              <RichTextEditor name='ancestry.desc' onChange={setFormState} value={formState?.ancestry?.desc} />
            </Collapse>
          </>
        )}
        <Group className={sprinkles({ mt: 'size-3' })}>
          <Grid>
            <Button variant='primary_outline' onClick={handleAdd}>
              {`Add ${stepName === 'Ancestry' ? 'Ancestry' : 'Feature'}`}
            </Button>
            {stepName === 'Features' && (
              <Button variant='primary_outline' onClick={handleCopy}>
                Copy Feature
              </Button>
            )}
          </Grid>
        </Group>
      </Group>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {featureArray && featureArray.length > 0 && (
          <div className={feature_list}>
            <Accordion dataArray={featureArray} setState={setFormState} name='feature'>
              {featureArray?.map((featureItem: any, featureIndex: number) => (
                <Accordion.Container key={featureIndex} itemId={String(featureIndex)}>
                  <Accordion.Header
                    handleClick={() => toggle(featureIndex)}
                    handleRemove={() => handleRemove(featureIndex)}
                    handleEdit={() => handleEdit(featureIndex)}
                    active={!featureItem.desc ? null : activeIndex === featureIndex}
                  >
                    {featureItem.value != null && featureItem.value !== ''
                      ? featureItem.value
                      : `Feature ${featureIndex + 1}`}
                  </Accordion.Header>
                  {featureItem.desc && (
                    <Accordion.Content active={activeIndex === featureIndex}>
                      <div className={feature_description}>
                        <div>
                          {featureItem?.desc && parse(featureItem.desc)}
                          {featureItem.option &&
                            featureItem.option?.length > 0 &&
                            featureItem.option?.map((optionItem: any, optionIndex: number) => (
                              <div key={optionIndex}>
                                {optionItem?.value && <strong>{optionItem.value}</strong>}
                                {optionItem?.desc && parse(optionItem.desc)}
                              </div>
                            ))}
                        </div>
                      </div>
                    </Accordion.Content>
                  )}
                  <hr />
                  <Accordion.Footer>
                    <Group justifyContentVariant='start'>
                      {sectionNames.map((sectionName: string, sectionIndex: number) => {
                        return (
                          <span key={sectionIndex} className={sprinkles({ me: 'size-2' })}>
                            {featureItem[sectionName]?.length > 0 ? (
                              <strong>
                                {startCase(sectionName.charAt(0))}: {featureItem[sectionName]?.length}
                              </strong>
                            ) : (
                              `${startCase(sectionName.charAt(0))}: 0`
                            )}
                          </span>
                        )
                      })}
                    </Group>
                  </Accordion.Footer>
                </Accordion.Container>
              ))}
            </Accordion>
          </div>
        )}
      </ScrollArea>
    </>
  )
}

export default FeatureList
