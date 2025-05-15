import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import RichTextEditor from '@/components/RichTextEditor'
import { sprinkles } from '@/css/sprinkles.css'
import Button from '@/components/Button'
import Accordion from '@/components/Accordion'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { Categories } from '@/enums'
import { useSystemData } from '@/hooks'
import type { OnChange, Race } from '@/types'
import { Grid } from '@mantine/core'

const TraitsStep = () => {
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
        <Grid.Col>
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
        </Grid.Col>
        {data?.traits?.details?.length && (
          <Grid.Col>
            <Accordion<Race> dataArray={data?.traits?.details} updateFn={{ updateField }} name='traits.details'>
              {data.traits.details.map((detail, index) => (
                <Accordion.Item key={index} itemId={String(index)} value={String(index)}>
                  <Accordion.Trigger removeFn={() => handleRemove(index)}>
                    {detail.label ?? `Trait ${index}`}
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <Grid>
                      <Grid.Col>
                        <Input
                          name={`traits.details.${index}.label`}
                          label='Trait Name'
                          errorMsg='Must contain only numbers'
                          value={detail?.label}
                          onChange={{ updateField }}
                          className={sprinkles({ mb: 'space-3' })}
                        />
                      </Grid.Col>
                      <Grid.Col>
                        <RichTextEditor
                          name={`traits.details.${index}.desc`}
                          value={detail?.desc}
                          label={'Traits Description'}
                          onChange={{ updateField }}
                          className={sprinkles({ mb: 'space-3' })}
                        />
                      </Grid.Col>
                    </Grid>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion>
          </Grid.Col>
        )}
      </Grid>
      <Grid>
        {data?.category === Categories.BASE && (
          <>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='traits.size'
                label='Size'
                value={data.traits?.size}
                options={sizes}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.walking'
                label='Walking Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.walking}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.climbing'
                label='Climbing Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.climbing}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.swimming'
                label='Swimming Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.swimming}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Col>
            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='traits.speeds.flying'
                label='Flying Speed'
                errorMsg='Must contain only numbers'
                value={data.traits?.speeds?.flying}
                onChange={{ updateField }}
                placeholder='0'
              />
            </Grid.Col>
          </>
        )}
      </Grid>
    </>
  )
}

export default TraitsStep
