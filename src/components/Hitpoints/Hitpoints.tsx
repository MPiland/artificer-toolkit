import { use } from 'react'
import { ModalContext } from '~/components/Modal'
import { Grid, TextInput } from '@mantine/core'
import Modal from '~/components/Modal'
import { HPCalcMethods } from '~/enums'
import { startCase } from 'lodash-es'
import { useFormStore } from '~/store'
import type { CharacterInput } from 'gql/types'
import type { HitpointModalProps } from '../Modal/ModalProvider'

const Hitpoints = () => {
  const { modalProps, hideModal } = use(ModalContext)

  const { setFieldValue } = modalProps as HitpointModalProps

  const formStore = useFormStore()

  const { current: data } = formStore as { current: CharacterInput }

  const method: 'fixed' | 'rolled' = data?.hitpoint?.method === HPCalcMethods.FIXED ? 'fixed' : 'rolled'

  const hitpointObject = data?.hitpoint?.[method]

  return (
    <Modal onClose={hideModal}>
      <Modal.Dialogue size='md'>
        <Modal.Header title='Manage Hitpoints' onClose={hideModal} />
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
              <TextInput
                name='hitpoint.bonus'
                value={data?.hitpoint?.bonus || ''}
                onChange={(e) => {
                  setFieldValue('hitpoint.bonus', e.target.value)
                  formStore.updateField({ path: 'hitpoint.bonus', value: e.target.value })
                }}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <span>Max Override</span>
              <TextInput
                name='hitpoint.maxOverride'
                value={data?.hitpoint?.maxOverride || ''}
                onChange={(e) => {
                  setFieldValue('hitpoint.maxOverride', e.target.value)
                  formStore.updateField({ path: 'hitpoint.maxOverride', value: e.target.value })
                }}
              />
            </Grid.Col>
          </Grid>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}
export default Hitpoints
