import { use } from 'react'
import Grid from '../../../../Grid/Grid'
import Modal from '../../../../Modal/Modal'
import { FormContext } from '../../../FormContext'
import { Character } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import { HitPointCalcMethod } from '../../../../../types/enums'
import { startCase } from 'lodash'
import Input from '../../../../Input/Input'

const Hitpoints = ({ onClose }: { onClose: () => void }) => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const method: 'fixed' | 'rolled' = formData?.hitpoint?.method === HitPointCalcMethod.fixed ? 'fixed' : 'rolled'

  const hitpointObject = formData?.hitpoint?.[method]

  return (
    <Modal onClose={onClose}>
      <Modal.Dialogue size='md'>
        <Modal.Header title='Manage Hitpoints' onClose={onClose} />
        <Modal.Content>
          <Grid>
            <Grid.Item flexDirection='column' align='center' colSpan={12}>
              <p>Maximum Hitpoints</p>
              <h1>{formData?.hitpoint?.maxHitpoints}</h1>
            </Grid.Item>
            <Grid.Item flexDirection='column' align='center' colSpan={4}>
              <span>{startCase(method)} HP</span>
              <span>{hitpointObject?.total}</span>
            </Grid.Item>
            <Grid.Item flexDirection='column' align='center' colSpan={4}>
              <span>Bonus HP</span>
              <Input
                name='hitpoint.bonus'
                validation='num'
                value={formData?.hitpoint?.bonus}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item flexDirection='column' align='center' colSpan={4}>
              <span>Max Override</span>
              <Input
                name='hitpoint.maxOverride'
                validation='num'
                value={formData?.hitpoint?.maxOverride}
                onChange={updateFormData}
              />
            </Grid.Item>
          </Grid>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}
export default Hitpoints
