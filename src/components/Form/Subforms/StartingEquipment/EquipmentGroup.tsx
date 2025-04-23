import Button from '../../../Button/Button'
import Grid from '../../../Grid/Grid'
import Accordion from '../../../Accordion/Accordion'
import EquipmentOption from './EquipmentOption'
import type { Background, Class, ClassEquipment, BackgroundEquipment } from '../../../../../amplify/gql/types'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { OnChange } from '../../../../types/types'

type EquipmentGroupProps = {
  equipment: ((ClassEquipment | BackgroundEquipment)[] | null)[]
  index: number
}

const EquipmentGroup = ({ equipment, index }: EquipmentGroupProps) => {
  
  const {
    formStore: { removeField, addField },
  } = use(FormContext) as {
    formStore: {
      removeField: OnChange<Class | Background>['removeField']
      addField: OnChange<Class | Background>['addField']
    }
  }
  const optionIndex = equipment?.length

  return (
    <Accordion.Wrapper itemId={String(index)}>
      <Accordion.Header handleRemove={() => removeField({ path: `equipment.${index}` })}>
        {`Equipment Group ${index + 1}`}
      </Accordion.Header>
      <Accordion.Content>
        <Grid>
          <Grid.Item colSpan={2}>
            <Button
              color='primary'
              style='outline'
              onClick={() => {
                addField({ path: `equipment.${index}.${optionIndex}` })
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
