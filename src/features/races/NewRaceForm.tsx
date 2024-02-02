import { useState, useEffect, useReducer } from 'react'
import { Button, SimpleGrid, Flex, Group } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import {
  selectAllRaces,
  useAddNewRaceMutation,
  useGetRacesQuery,
} from './racesApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../utils/form'
import DraggableTabs from '../../components/DraggableTabs'
import Spinner from '../../components/Spinner/Spinner'
import formReducer from '../../hooks/useReducer'
import TextEditor from '../../components/RichTextEditor/TextEditor'
import Table from '../../components/Table/Table'
import Dropdown from '../../components/Dropdown/Dropdown'
import Input from '../../components/Input/Input'
import FeatureContent from '../../components/Form/FeatureForm'

const NewRaceForm = () => {
  const navigate = useNavigate()

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { races } = useGetRacesQuery('racesList', {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
  })

  const [
    addNewRace,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewRaceMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!races) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [races])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Race added successfully!')
      setErrorMessage()
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
      setState({
        type: 'reset',
        payload: { target: {} },
      })
    }
  }, [addIsSuccess, setState])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.message)
    }
  }, [addIsError, addError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('keypress', () => {
        if (successMessage != null) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
        }
      })
  })

  useEffect(() => {
    document.addEventListener('mouseup', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('mouseup', () => {
        if (successMessage != null) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
        }
      })
  })

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: {} },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewRace(state)
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  const onSubrace = () => {
    if (state.category?.name === 'subrace' && state.lineage && !state.feature) {
      setState({
        payload: {
          target: {
            name: 'feature',
            value: races.find((race) => race._id === state.lineage?.id).feature,
          },
        },
      })
    }
  }

  let content

  if (isLoading) {
    return (content = <Spinner />)
  }

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <SimpleGrid>
            <Input
              name='value'
              autoComplete='off'
              label='Race Name'
              required={true}
              value={state.value}
              onChange={setState}
              autoFocus={true}
            />
            <Dropdown
              name='category'
              label='Race Category'
              value={state?.category}
              options={builders.race?.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name && state.category?.name !== 'base' && (
              <Dropdown
                multiSelect={state.category.name === 'variant' && true}
                name='lineage'
                label='Race Lineage'
                value={state?.lineage}
                options={races}
                required={true}
                onChange={setState}
              />
            )}
            {state.category?.name === 'subrace' &&
              state?.lineage &&
              onSubrace()}
          </SimpleGrid>
          <TextEditor
            name={'quote'}
            value={state?.quote}
            label={'Opening Quote'}
            onChange={setState}
          />
          <Button
            type='button'
            color='gray'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'details' } },
              })
            }
          >
            Add Detail
          </Button>
          <DraggableTabs
            name='details'
            tabState={state.details?.map((detailItem, detailIndex) => ({
              value:
                detailItem.name == null || detailItem.name === ''
                  ? startCase(`detail ${detailIndex + 1}`)
                  : detailItem.name,
              content: (
                <div key={detailIndex}>
                  <div className='col-auto pb-3'>
                    <Input
                      size='col-sm-3'
                      name={`details.${detailIndex}.value`}
                      autoComplete='off'
                      label='Detail Name'
                      value={detailItem.value}
                      onChange={setState}
                    />
                  </div>
                  <TextEditor
                    name={`details.${detailIndex}.desc`}
                    value={detailItem.desc}
                    label={'Section Description'}
                    onChange={setState}
                  />
                </div>
              ),
            }))}
            setState={setState}
            addRow={true}
          />
        </>
      ),
    },
    {
      name: 'traits',
      content: (
        <>
          <TextEditor
            name='traits.desc'
            value={state.traits?.desc}
            label={'Traits Description'}
            onChange={setState}
          />
          <SimpleGrid>
            <Dropdown
              multiSelect={true}
              name='attribute'
              label='Attributes'
              value={state.attribute}
              options={builders.race.attribute}
              required={true}
              onChange={setState}
            />
            <Dropdown
              name='traits.size'
              label='Size'
              value={state.traits?.size}
              options={builders.race.size}
              required={true}
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'walking'
            ) && (
              <Input
                validation='num'
                name='traits.speed.walking'
                label='Walking Speed'
                invalidText='Must contain only numbers'
                value={state.traits?.speed?.walking}
                required={true}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'climbing'
            ) && (
              <Input
                validation='num'
                name='traits.speed.climbing'
                label='Climbing Speed'
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.climbing}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'swimming'
            ) && (
              <Input
                validation='num'
                name='traits.speed.swimming'
                label='Swimming Speed'
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.swimming}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'flying'
            ) && (
              <Input
                validation='num'
                name='traits.speed.flying'
                label='Flying Speed'
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.flying}
                onChange={setState}
              />
            )}
          </SimpleGrid>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'ancestryOptions'
          ) &&
            (!state.ancestry ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'ancestry',
                  },
                },
              })
            ) : (
              <>
                <Table
                  rows={{
                    inputs: [
                      {
                        name: 'ancestry',
                        value: 'Ancestry',
                        size: 'col-lg-3 col-md-4 col-sm-12',
                      },
                      {
                        name: 'description',
                        value: 'Description',
                        size: 'col-sm',
                      },
                    ],
                    headers: [
                      {
                        value: 'Ancestry',
                        readOnly: true,
                        size: 'col-lg-3 col-md-4 col-sm-12',
                      },
                      { value: 'Description', readOnly: true, size: 'col-sm' },
                    ],
                  }}
                  name='ancestry'
                  value={state?.ancestry}
                  onChange={setState}
                  addRow={true}
                />
              </>
            ))}
        </>
      ),
    },
    {
      name: 'features',
      content: (
        <>
          {state.feature?.length > 0 && (
            <DraggableTabs
              name='feature'
              tabState={state.feature?.map((featureItem, featureIndex) => {
                const level = true
                const stateName = `feature.${featureIndex}`
                return {
                  value:
                    featureItem.value == null || featureItem.value === ''
                      ? `Feature ${featureIndex + 1}`
                      : featureItem.value,
                  content: (
                    <FeatureContent
                      stateName={stateName}
                      featureItem={featureItem}
                      level={level}
                      setState={setState}
                      state={state}
                      context={'race'}
                    />
                  ),
                }
              })}
              state={state.feature}
              addRow={true}
              reorder={true}
              addButtonOptions={[{ name: 'feature', label: 'feature' }]}
              setState={setState}
            />
          )}
        </>
      ),
    },
  ]

  content = (
    <>
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        justify={{ base: 'space-between' }}
      >
        <h3>Create a Class</h3>
        <Group justify='space-between' gap='xs'>
          <Button type='button' onClick={onSubmit}>
            Add
          </Button>
          <Button type='button' color='yellow' onClick={onReset}>
            Reset Form
          </Button>
          <Button type='button' color='gray' onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>
      </Flex>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
        <DraggableTabs
          name='main'
          addRow={false}
          tabState={mainTabContent.map((content) => ({
            value: startCase(content.name),
            content: content.content,
          }))}
        />
      </form>
    </>
  )
  return (
    <div className='main-container' id='main-container'>
      {content}
    </div>
  )
}
export default NewRaceForm
