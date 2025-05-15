import { useEffect } from 'react'
import Button from '@/components/Button'
import Accordion from '@/components/Accordion'
import { use } from 'react'
import { FormContext } from '../FormContext'
import EquipmentGroup from '../Substeps/StartingEquipment/EquipmentGroup'
import type { OnChange, Class } from '@/types'
import { Grid } from '@mantine/core'

const StartingEquipmentStep = () => {
  const {
    formStore: { data, updateField, addField },
  } = use(FormContext) as {
    formStore: {
      data: Class
      updateField: OnChange<Class>['updateField']
      addField: OnChange<Class>['addField']
    }
  }

  useEffect(() => {
    if (data.equipment?.length) {
      data.equipment?.forEach((option, oIndex) => {
        if (!option?.length) {
          addField({ path: `equipment.${oIndex}`, value: [[]] })
        }
      })
    }
  }, [data.equipment, addField])

  return (
    <Grid>
      <Grid.Col>
        <Grid>
          <Grid.Col span={2}>
            <Button
              color='primary'
              style='outline'
              width='size-full'
              onClick={() => {
                addField({ path: 'equipment', value: [[]] })
              }}
            >
              Add Equipment Group
            </Button>
          </Grid.Col>
        </Grid>
      </Grid.Col>
      {data.equipment?.length && (
        <Grid.Col>
          <Accordion dataArray={data.equipment} name='equipment' updateFn={{ updateField }}>
            {data.equipment?.map((equipmentItem, eIndex) => {
              if (equipmentItem?.length) {
                return <EquipmentGroup key={eIndex} index={eIndex} equipment={equipmentItem} />
              }
            })}
          </Accordion>
        </Grid.Col>
      )}
    </Grid>
  )
}

export default StartingEquipmentStep
