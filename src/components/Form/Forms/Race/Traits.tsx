import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import RichTextEditor from '../../../RichTextEditor/RichTextEditor'
import { sprinkles } from '../../../../css/sprinkles.css'
import Button from '../../../Button/Button'
import Accordion from '../../../Accordion/Accordion'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { Race } from '../../../../../amplify/gql/types'
import { Categories } from '../../../../types/enums'
import Grid from '../../../Grid/Grid'
import useSystemData from '../../../../hooks/useSystemData'
import { OnChange } from '../../../../types/form'

const Traits = () => {
  const {
    formStore: { data, updateField, addField, removeField },
  } = use(FormContext) as {
    formStore: {
      data: Race
      updateField: OnChange<Race>['updateField']
      removeField: OnChange<Race>['removeField']
      addField: OnChange<Race>['addField']
    }
  }

  const { sizes } = useSystemData()

  // Edit feature
  const handleRemove = (index: number) => {
    if (index === 0 && data.traits?.details?.length === 1) {
      return removeField({ path: `traits` })
    }
    if (index >= 0) {
      removeField({ path: `traits.details.${index}` })
    }
  }

  return (
    <>
      <Grid>
        <Grid.Item>
          <Button
            onClick={() => {
              addField({ path: 'traits.details' })
            }}
            color='primary'
            style='outline'
            className={sprinkles({ mb: 'space-3' })}
          >
            Add Trait
          </Button>
        </Grid.Item>
        {data?.traits?.details?.length && (
          <Grid.Item>
            <Accordion<Race> dataArray={data?.traits?.details} onChange={{ updateField }} name='traits.details'>
              {data.traits.details.map((detail, index) => (
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
                          onChange={{ updateField }}
                          className={sprinkles({ mb: 'space-3' })}
                        />
                      </Grid.Item>
                      <Grid.Item>
                        <RichTextEditor
                          name={`traits.details.${index}.desc`}
                          value={detail?.desc}
                          label={'Traits Description'}
                          onChange={{ updateField }}
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
        {data?.category === Categories.base && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='traits.size'
                label='Size'
                value={data.traits?.size}
                options={sizes}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.walking'
                label='Walking Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.walking}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.climbing'
                label='Climbing Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.climbing}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.swimming'
                label='Swimming Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.swimming}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.flying'
                label='Flying Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.flying}
                onChange={{ updateField }}
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
