import { FC, useState, useReducer, useEffect } from 'react'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import Input from '../Input/Input'
import Table from '../Table/Table'
import RichTextEditor from '../RichTextEditor/RichTextEditor'
import { ReducerActionType } from '../../utils/types'
import { form_content } from './Form.css'
import FormFooter from './FormFooter'
import { useNavigate } from 'react-router-dom'
import ScrollArea from '../ScrollArea/ScrollArea'
import formReducer from '../../hooks/useReducer'
import { isEqual } from 'lodash'

interface TraitFormProps {
  state: any
  setState: (arg: ReducerActionType) => void
  context: {
    type: 'edit' | 'create'
    title: string
  }
  isLastStep?: boolean
  isFirstStep?: boolean
  setStepIndex: (arg: (i: number) => number) => void
  handleSubmit: () => Promise<void>
  handleUpdate: () => Promise<void>
}

const TraitForm: FC<TraitFormProps> = ({
  state,
  setState,
  context,
  isLastStep,
  isFirstStep,
  setStepIndex,
  handleSubmit,
  handleUpdate,
}) => {
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState] = useState<any>(state)
  const [matches, setMatches] = useState<boolean>(false)

  const navigate = useNavigate()

  const { data: builders } = useGetBuildersQuery(undefined)

  //Determine if changes made for warning in handleBack
  useEffect(() => {
    if (isEqual(formState, oldFormState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [formState, oldFormState])

  const handleReset = () => {
    setFormState({
      type: 'reset',
      target: { value: state },
    })
  }

  const handleForward = () => {
    setState({
      target: {
        value: formState,
      },
    })
    if (!isLastStep) {
      return setStepIndex((i: number) => {
        return i + 1
      })
    }
    handleSubmit()
  }

  const handleBack = () => {
    if (!matches) {
      console.log('changes made, alert!')
    }
    if (isFirstStep) {
      return navigate(-1)
    }
    if (!isFirstStep) {
      setStepIndex((i: number) => {
        if (i <= 0) {
          return i
        } else {
          return i - 1
        }
      })
    }
  }

  return (
    <>
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <RichTextEditor
          name='trait.desc'
          value={state.trait?.desc}
          label={'Traits Description'}
          onChange={setState}
        />
        <Grid cols={{ lg: 6, md: 4, base: 2 }}>
          <Dropdown
            multiSelect={true}
            name='attribute'
            label='Attributes'
            value={state.attribute}
            options={builders[context.title].attribute}
            required={true}
            onChange={setState}
          />
          <Dropdown
            name='trait.size'
            label='Size'
            value={state.trait?.size}
            options={builders.race.size}
            required={true}
            onChange={setState}
          />
          {state.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'walking'
          ) && (
            <Input
              validation='num'
              name='trait.speed.walking'
              label='Walking Speed'
              errorMsg='Must contain only numbers'
              value={state.trait?.speed?.walking}
              required={true}
              onChange={setState}
            />
          )}
          {state.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'climbing'
          ) && (
            <Input
              validation='num'
              name='trait.speed.climbing'
              label='Climbing Speed'
              errorMsg='Must contain only numbers'
              required={true}
              value={state.trait?.speed?.climbing}
              onChange={setState}
            />
          )}
          {state.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'swimming'
          ) && (
            <Input
              validation='num'
              name='trait.speed.swimming'
              label='Swimming Speed'
              errorMsg='Must contain only numbers'
              required={true}
              value={state.trait?.speed?.swimming}
              onChange={setState}
            />
          )}
          {state.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'flying'
          ) && (
            <Input
              validation='num'
              name='trait.speed.flying'
              label='Flying Speed'
              errorMsg='Must contain only numbers'
              required={true}
              value={state.trait?.speed?.flying}
              onChange={setState}
            />
          )}
        </Grid>
        {state.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'ancestryOptions'
        ) &&
          (!state.ancestry ? (
            setState({
              type: 'added',
              target: { name: 'ancestry' },
            })
          ) : (
            <>
              <Table
                rows={{
                  inputs: [
                    { name: 'ancestry', value: 'Ancestry' },
                    { name: 'description', value: 'Description' },
                  ],
                  headers: [{ value: 'Ancestry' }, { value: 'Description' }],
                }}
                name='ancestry'
                value={state?.ancestry}
                onChange={setState}
                addRow={true}
              />
            </>
          ))}
      </ScrollArea>
      <FormFooter
        handleBack={handleBack}
        forwardLabel={
          isLastStep ? (context.type === 'edit' ? 'Add New' : 'Submit') : 'Next'
        }
        handleReset={handleReset}
        handleForward={handleForward}
        backLabel={'Back'}
        handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
      />
    </>
  )
}

export default TraitForm
