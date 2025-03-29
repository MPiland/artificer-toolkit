import Button from '../../../Button/Button'
import Grid from '../../../Grid/Grid'
import Accordion from '../../../Accordion/Accordion'
import EquipmentOption from './EquipmentOption'
import { Background, Class, ClassEquipment, BackgroundEquipment } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { use } from 'react'
import { FormContext } from '../../FormContext'

type EquipmentGroupProps = {
  equipment: ((ClassEquipment | BackgroundEquipment)[] | null)[]
  index: number
}

const EquipmentGroup = ({ equipment, index }: EquipmentGroupProps) => {
  const { updateFormData } = use(FormContext) as {
    updateFormData: (state: UpdateState<Class | Background>) => void
  }
  const optionIndex = equipment?.length

  return (
    <Accordion.Wrapper itemId={String(index)}>
      <Accordion.Header
        handleRemove={() =>
          updateFormData({
            type: 'remove',
            path: `equipment.${index}`,
          })
        }
      >
        {`Equipment Group ${index + 1}`}
      </Accordion.Header>
      <Accordion.Content>
        <Grid>
          <Grid.Item colSpan={2}>
            <Button
              color='primary'
              style='outline'
              onClick={() => {
                updateFormData({
                  type: 'add',
                  path: `equipment.${index}.${optionIndex}`,
                })
              }}
            >
              Add Option
            </Button>
          </Grid.Item>
          <Grid.Item>
            {equipment?.length > 0 &&
              equipment?.map((option, optIdx) => {
                if (option?.length) {
                  return (
                    <EquipmentOption
                      key={optIdx}
                      option={option}
                      equipmentIndex={index}
                      optionIndex={optIdx}
                      equipmentLength={equipment.length}
                    />
                  )
                }
              })}
          </Grid.Item>
        </Grid>
      </Accordion.Content>
    </Accordion.Wrapper>
  )
}

export default EquipmentGroup
