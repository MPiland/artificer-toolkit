import { memo } from 'react'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import Input from '../Input/Input'
import RichTextEditor from '../RichTextEditor/RichTextEditor'
import { ReducerActionType } from '../../utils/types'
import { form_content } from './Form.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import { sprinkles } from '../../css/sprinkles.css'

interface TraitFormProps {
  formState: any
  setFormState: (arg: ReducerActionType) => void
}

const TraitForm = memo(({ formState, setFormState }: TraitFormProps) => {
  const { data: builders } = useGetBuildersQuery(undefined)

  return (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      <RichTextEditor
        name='trait.desc'
        value={formState.trait?.desc}
        label={'Traits Description'}
        onChange={setFormState}
        className={sprinkles({ mb: 'size-3' })}
      />
      <Grid>
        <Dropdown
          name='trait.size'
          label='Size'
          value={formState.trait?.size}
          options={builders.race.size}
          required={true}
          onChange={setFormState}
        />
        <Input
          validation='num'
          name='trait.speed.walking'
          label='Walking Speed'
          errorMsg='Must contain only numbers'
          value={formState.trait?.speed?.walking}
          onChange={setFormState}
          placeholder='0'
        />
        <Input
          validation='num'
          name='trait.speed.climbing'
          label='Climbing Speed'
          errorMsg='Must contain only numbers'
          value={formState.trait?.speed?.climbing}
          onChange={setFormState}
          placeholder='0'
        />
        <Input
          validation='num'
          name='trait.speed.swimming'
          label='Swimming Speed'
          errorMsg='Must contain only numbers'
          value={formState.trait?.speed?.swimming}
          onChange={setFormState}
          placeholder='0'
        />
        <Input
          validation='num'
          name='trait.speed.flying'
          label='Flying Speed'
          errorMsg='Must contain only numbers'
          value={formState.trait?.speed?.flying}
          onChange={setFormState}
          placeholder='0'
        />
      </Grid>
    </ScrollArea>
  )
})

TraitForm.displayName = 'TraitForm'

export default TraitForm
