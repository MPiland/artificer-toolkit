import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../../features/builders/buildersApi'
import Input from '../../Input/Input'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { useForm } from '../../../hooks/UseForm'

const Traits = () => {
  const { formState, setFormState } = useForm()

  const { data: builders } = useGetBuildersQuery()

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
    <>
      <Button
        onClick={() => {
          setFormState({ type: 'added', target: { name: 'trait.area' } })
        }}
        color='primary'
        style='outline'
        className={sprinkles({ mb: 'space-3' })}
      >
        Add Trait
      </Button>
      {formState?.trait?.area?.length > 0 && (
        <Accordion dataArray={formState?.trait?.area} setState={setFormState} name='trait.area'>
          {formState.trait.area.map((areaItem: any, areaIndex: number) => (
            <Accordion.Wrapper key={areaIndex} itemId={String(areaIndex)}>
              <Accordion.Header handleRemove={() => handleRemove(areaIndex)}>
                {areaItem.value ?? `Trait ${areaIndex}`}
              </Accordion.Header>
              <Accordion.Content>
                <Row>
                  <Input
                    name={`trait.area.${areaIndex}.value`}
                    label='Trait Name'
                    errorMsg='Must contain only numbers'
                    value={areaItem?.value}
                    onChange={setFormState}
                    className={sprinkles({ mb: 'space-3' })}
                  />
                </Row>
                <RichTextEditor
                  name={`trait.area.${areaIndex}.desc`}
                  value={areaItem?.desc}
                  label={'Traits Description'}
                  onChange={setFormState}
                  className={sprinkles({ mb: 'space-3' })}
                />
              </Accordion.Content>
            </Accordion.Wrapper>
          ))}
        </Accordion>
      )}
      {formState?.category?.name === 'base' && (
        <Row>
          <Dropdown
            name='trait.size'
            label='Size'
            value={formState.trait?.size}
            options={builders.races.size}
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
        </Row>
      )}
    </>
  )
}

export default Traits
