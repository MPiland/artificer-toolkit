import Button from '@/components/Button'
import Grid from '@/components/Grid'
import Accordion from '@/components/Accordion'
import EquipmentOption from './EquipmentOption'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import type { OnChange, Background, Class, ClassEquipment, BackgroundEquipment } from '@/types'

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
