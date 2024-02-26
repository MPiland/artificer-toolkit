import { memo } from 'react'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import Input from '../Input/Input'
import Table from '../Table/Table'
import RichTextEditor from '../RichTextEditor/RichTextEditor'
import { FormContext, ReducerActionType } from '../../utils/types'
import { form_content } from './Form.css'
import ScrollArea from '../ScrollArea/ScrollArea'

interface TraitFormProps {
  context: {
    type: FormContext
    title: string
  }
  formState: any
  setFormState: (arg: ReducerActionType) => void
}

const TraitForm = memo(
  ({ context, formState, setFormState }: TraitFormProps) => {
    const { data: builders } = useGetBuildersQuery(undefined)

    return (
      <ScrollArea scrollDirection='vertical' className={form_content}>
        <RichTextEditor
          name='trait.desc'
          value={formState.trait?.desc}
          label={'Traits Description'}
          onChange={setFormState}
        />
        <Grid cols={{ lg: 6, md: 4, base: 2 }}>
          <Dropdown
            multiSelect={true}
            name='attribute'
            label='Attributes'
            value={formState.attribute}
            options={builders[context.title].attribute}
            required={true}
            onChange={setFormState}
          />
          <Dropdown
            name='trait.size'
            label='Size'
            value={formState.trait?.size}
            options={builders.race.size}
            required={true}
            onChange={setFormState}
          />
          {formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'walking'
          ) && (
            <Input
              validation='num'
              name='trait.speed.walking'
              label='Walking Speed'
              errorMsg='Must contain only numbers'
              value={formState.trait?.speed?.walking}
              required={true}
              onChange={setFormState}
            />
          )}
          {formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'climbing'
          ) && (
            <Input
              validation='num'
              name='trait.speed.climbing'
              label='Climbing Speed'
              errorMsg='Must contain only numbers'
              required={true}
              value={formState.trait?.speed?.climbing}
              onChange={setFormState}
            />
          )}
          {formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'swimming'
          ) && (
            <Input
              validation='num'
              name='trait.speed.swimming'
              label='Swimming Speed'
              errorMsg='Must contain only numbers'
              required={true}
              value={formState.trait?.speed?.swimming}
              onChange={setFormState}
            />
          )}
          {formState.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'flying'
          ) && (
            <Input
              validation='num'
              name='trait.speed.flying'
              label='Flying Speed'
              errorMsg='Must contain only numbers'
              required={true}
              value={formState.trait?.speed?.flying}
              onChange={setFormState}
            />
          )}
        </Grid>
        {formState.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'ancestryOptions'
        ) &&
          (!formState.ancestry ? (
            setFormState({
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
                value={formState?.ancestry}
                onChange={setFormState}
                addRow={true}
              />
            </>
          ))}
      </ScrollArea>
    )
  }
)

TraitForm.displayName = 'TraitForm'

export default TraitForm
