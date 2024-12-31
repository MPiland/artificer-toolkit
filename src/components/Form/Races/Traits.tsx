import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Race } from '../../../../amplify/API'
import { Categories } from '../../../types/enums'
import { UpdateState } from '../../../types/form'

const Traits = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Race
    updateFormData: (state: UpdateState<Race>) => void
  }

  const { data: system } = useGetSystemQuery()

  // Edit feature
  const handleRemove = (index: number) => {
    if (index === 0 && formData.traits?.details?.length === 1) {
      return updateFormData({
        type: 'remove',
        path: `traits`,
      })
    }
    if (index >= 0) {
      updateFormData({
        type: 'remove',
        path: `traits.details.${index}`,
      })
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          updateFormData({ type: 'add', path: 'traits.details' })
        }}
        color='primary'
        style='outline'
        className={sprinkles({ mb: 'space-3' })}
      >
        Add Trait
      </Button>
      {formData?.traits?.details?.length > 0 && (
        <Accordion dataArray={formData?.traits?.details} onChange={updateFormData} name='traits.details'>
          {formData.traits.details.map((detail, index) => (
            <Accordion.Wrapper key={index} itemId={String(index)}>
              <Accordion.Header handleRemove={() => handleRemove(index)}>
                {detail.value ?? `Trait ${index}`}
              </Accordion.Header>
              <Accordion.Content>
                <Row>
                  <Input
                    name={`traits.details.${index}.value`}
                    label='Trait Name'
                    errorMsg='Must contain only numbers'
                    value={detail?.value}
                    onChange={updateFormData}
                    className={sprinkles({ mb: 'space-3' })}
                  />
                </Row>
                <RichTextEditor
                  name={`traits.details.${index}.desc`}
                  value={detail?.desc}
                  label={'Traits Description'}
                  onChange={updateFormData}
                  className={sprinkles({ mb: 'space-3' })}
                />
              </Accordion.Content>
            </Accordion.Wrapper>
          ))}
        </Accordion>
      )}
      {formData?.category === Categories.base && (
        <Row>
          <Dropdown
            name='traits.size'
            label='Size'
            value={formData.traits?.size}
            options={system.sizes}
            required={true}
            onChange={updateFormData}
          />
          <Input
            validation='num'
            name='traits.speeds.walking'
            label='Walking Speed'
            errorMsg='Must contain only numbers'
            value={formData.traits?.speeds?.walking}
            onChange={updateFormData}
            placeholder='0'
          />
          <Input
            validation='num'
            name='traits.speeds.climbing'
            label='Climbing Speed'
            errorMsg='Must contain only numbers'
            value={formData.traits?.speeds?.climbing}
            onChange={updateFormData}
            placeholder='0'
          />
          <Input
            validation='num'
            name='traits.speeds.swimming'
            label='Swimming Speed'
            errorMsg='Must contain only numbers'
            value={formData.traits?.speeds?.swimming}
            onChange={updateFormData}
            placeholder='0'
          />
          <Input
            validation='num'
            name='traits.speeds.flying'
            label='Flying Speed'
            errorMsg='Must contain only numbers'
            value={formData.traits?.speeds?.flying}
            onChange={updateFormData}
            placeholder='0'
          />
        </Row>
      )}
    </>
  )
}

export default Traits
