import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../Button/Button'
import Modal from '../Modal/Modal'
import ScrollArea from '../ScrollArea/ScrollArea'
import { startCase } from 'lodash'
import ClassShort from './Subforms/Character/Class/ClassShort'
import RaceShort from './Subforms/Character/Race/RaceShort'
import { use } from 'react'
import { FormContext } from './FormContext'
import { Race, Class, Character } from '../../../amplify/gql/types'
import { UpdateState } from '../../types/form'
import Grid from '../Grid/Grid'

const ShortDetail = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { formData, setChangeRace, setAddClass, updateFormData } = use(FormContext) as {
    formData: Character
    setChangeRace: (arg: boolean) => void
    setAddClass: (arg: boolean) => void
    updateFormData: (arg: UpdateState<Character>) => void
  }

  const item = location.state.item as Race | Class

  const handleSelect = () => {
    if (item.__typename === 'Race') {
      updateFormData({
        type: 'update',
        path: 'race',
        value: item.id,
      })
      setChangeRace(false)
    }
    if (item.__typename === 'Class') {
      const classIndex = formData?.classes?.length || 0

      updateFormData({
        type: 'update',
        path: `classes.${classIndex}`,
        value: {
          id: item?.id,
          level: 1,
        },
      })

      setAddClass(false)
    }
    navigate(-1)
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title={item.label} />
        <Modal.Content>
          <ScrollArea>
            <Grid>{item.__typename === 'Class' ? <ClassShort /> : <RaceShort />}</Grid>
          </ScrollArea>
        </Modal.Content>
        <Modal.Footer>
          <Button color='primary' onClick={handleSelect}>{`Select ${startCase(item.__typename)}`}</Button>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default ShortDetail
