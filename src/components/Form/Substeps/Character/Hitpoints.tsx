import { use } from 'react'
import { Grid } from '@mantine/core'
import Modal from '@/components/Modal'
import { FormContext } from '../../FormContext'
import { HPCalcMethods } from '@/enums'
import { startCase } from 'lodash'
import Input from '@/components/Input'
import type { OnChange, Character } from '@/types'

const Hitpoints = ({ onClose }: { onClose: () => void }) => {
  const {
    formStore: { data, updateField },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
    }
  }

  const method: 'fixed' | 'rolled' = data?.hitpoint?.method === HPCalcMethods.FIXED ? 'fixed' : 'rolled'

  const hitpointObject = data?.hitpoint?.[method]

  return (
    <Modal onClose={onClose}>
      <Modal.Dialogue size='md'>
        <Modal.Header title='Manage Hitpoints' onClose={onClose} />
        <Modal.Content>
          <Grid>
            <Grid.Col>
              <p>Maximum Hitpoints</p>
              <h1>{data?.hitpoint?.maxHitpoints}</h1>
            </Grid.Col>
            <Grid.Col span={4}>
              <span>{startCase(method)} HP</span>
              <span>{hitpointObject?.total}</span>
            </Grid.Col>
            <Grid.Col span={4}>
              <span>Bonus HP</span>
              <Input name='hitpoint.bonus' validation='num' value={data?.hitpoint?.bonus} onChange={{ updateField }} />
            </Grid.Col>
            <Grid.Col span={4}>
              <span>Max Override</span>
              <Input
                name='hitpoint.maxOverride'
                validation='num'
                value={data?.hitpoint?.maxOverride}
                onChange={{ updateField }}
              />
            </Grid.Col>
          </Grid>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}
export default Hitpoints
