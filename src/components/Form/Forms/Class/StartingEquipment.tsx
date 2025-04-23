import { useEffect } from 'react'
import Button from '../../../Button/Button'
import Accordion from '../../../Accordion/Accordion'
import type { Class } from '../../../../../amplify/gql/types'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import Grid from '../../../Grid/Grid'
import EquipmentGroup from '../../Subforms/StartingEquipment/EquipmentGroup'
import { OnChange } from '../../../../types/types'

const StartingEquipment = () => {
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
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={2}>
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
          </Grid.Item>
        </Grid>
      </Grid.Item>
      {data.equipment?.length && (
        <Grid.Item>
          <Accordion dataArray={data.equipment} name='equipment' onChange={{ updateField }}>
            {data.equipment?.map((equipmentItem, eIndex) => {
              if (equipmentItem?.length) {
                return <EquipmentGroup key={eIndex} index={eIndex} equipment={equipmentItem} />
              }
            })}
          </Accordion>
        </Grid.Item>
      )}
    </Grid>
  )
}

export default StartingEquipment
