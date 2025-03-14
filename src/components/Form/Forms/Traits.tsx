import Dropdown from '../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../css/sprinkles.css'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Race } from '../../../../amplify/gql/types'
import { Categories } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import Grid from '../../Grid/Grid'

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
      <Grid>
        <Grid.Item>
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
        </Grid.Item>
        {formData?.traits?.details?.length > 0 && (
          <Grid.Item>
            <Accordion dataArray={formData?.traits?.details} onChange={updateFormData} name='traits.details'>
              {formData.traits.details.map((detail, index) => (
                <Accordion.Wrapper key={index} itemId={String(index)}>
                  <Accordion.Header handleRemove={() => handleRemove(index)}>
                    {detail.label ?? `Trait ${index}`}
                  </Accordion.Header>
                  <Accordion.Content>
                    <Grid>
                      <Grid.Item>
                        <Input
                          name={`traits.details.${index}.label`}
                          label='Trait Name'
                          errorMsg='Must contain only numbers'
                          value={detail?.label}
                          onChange={updateFormData}
                          className={sprinkles({ mb: 'space-3' })}
                        />
                      </Grid.Item>
                      <Grid.Item>
                        <RichTextEditor
                          name={`traits.details.${index}.desc`}
                          value={detail?.desc}
                          label={'Traits Description'}
                          onChange={updateFormData}
                          className={sprinkles({ mb: 'space-3' })}
                        />
                      </Grid.Item>
                    </Grid>
                  </Accordion.Content>
                </Accordion.Wrapper>
              ))}
            </Accordion>
          </Grid.Item>
        )}
      </Grid>
      <Grid>
        {formData?.category === Categories.base && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='traits.size'
                label='Size'
                value={formData.traits?.size}
                options={system.sizes}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.walking'
                label='Walking Speed'
                errorMsg='Must contain only numbers'
                value={formData.traits?.speeds?.walking}
                onChange={updateFormData}
                placeholder='0'
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.climbing'
                label='Climbing Speed'
                errorMsg='Must contain only numbers'
                value={formData.traits?.speeds?.climbing}
                onChange={updateFormData}
                placeholder='0'
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.swimming'
                label='Swimming Speed'
                errorMsg='Must contain only numbers'
                value={formData.traits?.speeds?.swimming}
                onChange={updateFormData}
                placeholder='0'
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.flying'
                label='Flying Speed'
                errorMsg='Must contain only numbers'
                value={formData.traits?.speeds?.flying}
                onChange={updateFormData}
                placeholder='0'
              />
            </Grid.Item>
          </>
        )}
      </Grid>
    </>
  )
}

export default Traits
