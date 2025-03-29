import { Fragment } from 'react'
import Divider from '../../../Divider/Divider'
import Grid from '../../../Grid/Grid'
import EquipmentGroupItem from './EquipmentGroupItem'
import { ClassEquipment, BackgroundEquipment } from '../../../../../amplify/gql/types'

type EquipmentOptionProps = {
  option: (ClassEquipment | BackgroundEquipment)[]
  equipmentIndex: number
  optionIndex: number
  equipmentLength: number
}

const EquipmentOption = ({ option, equipmentIndex, optionIndex, equipmentLength }: EquipmentOptionProps) => {
  return (
    <Fragment>
      <Grid>
        {option?.length > 0 &&
          option?.map((group, groupIndex) => {
            if (group) {
              return (
                <EquipmentGroupItem
                  key={groupIndex}
                  group={group}
                  equipmentIndex={equipmentIndex}
                  optionIndex={optionIndex}
                  groupIndex={groupIndex}
                  optionLength={option.length}
                  equipmentLength={equipmentLength}
                />
              )
            }
          })}
      </Grid>
      {optionIndex !== equipmentLength - 1 && <Divider label={'OR'} />}
    </Fragment>
  )
}

export default EquipmentOption
