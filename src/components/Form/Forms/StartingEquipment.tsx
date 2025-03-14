import { useEffect } from 'react'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { Class } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Grid from '../../Grid/Grid'
import EquipmentGroup from '../Subforms/StartingEquipment/EquipmentGroup'

const StartingEquipment = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Class
    updateFormData: (state: UpdateState<Class>) => void
  }

  useEffect(() => {
    if (formData.equipment?.length > 0) {
      formData.equipment?.forEach((option, oIndex) => {
        if (!(option.length > 0)) {
          updateFormData({
            type: 'add',
            path: `equipment.${oIndex}`,
            value: [[]],
          })
        }
      })
    }
  }, [formData.equipment, updateFormData])

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
                updateFormData({
                  type: 'add',
                  path: 'equipment',
                  value: [[]],
                })
              }}
            >
              Add Equipment Group
            </Button>
          </Grid.Item>
        </Grid>
      </Grid.Item>
      {formData.equipment && (
        <Grid.Item>
          <Accordion dataArray={formData.equipment} name='equipment' onChange={updateFormData}>
            {formData.equipment?.map((equipmentItem, eIndex) => {
              return <EquipmentGroup key={eIndex} index={eIndex} equipment={equipmentItem} />
            })}
          </Accordion>
        </Grid.Item>
      )}
    </Grid>
  )
}

export default StartingEquipment
