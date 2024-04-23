import { memo, useState } from 'react'
import Grid from '../../Grid/Grid'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import Input from '../../Input/Input'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { FormContext, ReducerActionType } from '../../../utils/types'
import { form_content } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { sprinkles } from '../../../css/sprinkles.css'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'

interface TraitFormProps {
  formState: any
  setFormState: (arg: ReducerActionType) => void
  context: FormContext
}

const TraitForm = memo(({ formState, setFormState, context }: TraitFormProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(context.type !== 'new' ? null : 0)

  const { data: builders } = useGetBuildersQuery(undefined)

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  // Edit feature
  const handleRemove = (areaIndex: number) => {
    if (areaIndex === 0 && formState.trait?.area?.length === 1) {
      return setFormState({
        type: 'removed',
        target: { name: `trait` },
      })
    }
    if (areaIndex >= 0) {
      setFormState({
        type: 'removed',
        target: { name: `trait.area.${areaIndex}` },
      })
    }
  }

  return (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      <Button
        onClick={() => {
          if (formState?.trait?.area?.length > 0) {
            setActiveIndex(formState?.trait?.area?.length)
          } else {
            setActiveIndex(0)
          }
          setFormState({ type: 'added', target: { name: 'trait.area' } })
        }}
        variant='primary_outline'
        className={sprinkles({ mb: 'size-3' })}
      >
        Add Trait
      </Button>
      {formState?.trait?.area?.length > 0 && (
        <Accordion dataArray={formState?.trait?.area} setState={setFormState} name='trait.area'>
          {formState.trait.area.map((areaItem: any, areaIndex: number) => (
            <Accordion.Container key={areaIndex} itemId={String(areaIndex)}>
              <Accordion.Header
                handleClick={() => toggle(areaIndex)}
                handleRemove={() => handleRemove(areaIndex)}
                active={!areaItem.desc ? null : activeIndex === areaIndex}
              >
                {areaItem.value ?? `Trait ${areaIndex}`}
              </Accordion.Header>
              <Accordion.Content active={activeIndex === areaIndex}>
                <Grid>
                  <Input
                    name={`trait.area.${areaIndex}.value`}
                    label='Trait Name'
                    errorMsg='Must contain only numbers'
                    value={areaItem?.value}
                    onChange={setFormState}
                    className={sprinkles({ mb: 'size-3' })}
                  />
                </Grid>
                <RichTextEditor
                  name={`trait.area.${areaIndex}.desc`}
                  value={areaItem?.desc}
                  label={'Traits Description'}
                  onChange={setFormState}
                  className={sprinkles({ mb: 'size-3' })}
                />
              </Accordion.Content>
            </Accordion.Container>
          ))}
        </Accordion>
      )}
      {formState?.category?.name === 'base' && (
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
      )}
    </ScrollArea>
  )
})

TraitForm.displayName = 'TraitForm'

export default TraitForm
