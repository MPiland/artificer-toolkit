import { useLocation, useNavigate } from 'react-router-dom'
import Row from '../Row/Row'
import { getValueFromState } from '../../utils/formatting'
import Button from '../Button/Button'
import { form_detail_body, form_detail_main, form_detail_title } from './Form.css'
import Modal from '../Modal/Modal'
import { sprinkles } from '../../css/sprinkles.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import { startCase } from 'lodash'
import ClassShort from '../../features/classes/ClassShort'
import RaceShort from '../../features/races/RaceShort'
import { use } from 'react'
import FormContext from './FormContext'
import { Race, Class, Character } from '../../../amplify/API'
import { UpdateState } from '../../types/form'

type colType = {
  header: string
  name: string | any[]
  truncate?: number
  filter?: undefined | string[]
}

interface FormDetailProps {
  cols?: colType[]
  colsData?: any
  footer?: any
  footerSpacing?: 'spaceBetween' | 'center' | 'end' | 'start' | undefined
}

const ShortDetail = ({ cols, colsData }: FormDetailProps) => {
  const { formData, setChangeRace, setAddClass, updateFormData } = use(FormContext) as {
    formData: Character
    setChangeRace: (arg: boolean) => void
    setAddClass: (arg: boolean) => void
    updateFormData: (arg: UpdateState<Character>) => void
  }
  const navigate = useNavigate()
  const location = useLocation()

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
        }
      })
      setAddClass(false)
    }
    navigate(-1)
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title={item.value} />
        <Modal.Content>
          {colsData && cols && (
            <>
              <Row cols={{ lg: 4, md: 3, base: 2 }} className={sprinkles({ mb: 'space-2' })}>
                {cols?.map((colItem, colIndex) => {
                  return (
                    <div key={colIndex}>
                      <div className={form_detail_title}>{colItem.header}</div>
                      <div>
                        {getValueFromState({ input: colItem, state: colsData, truncateNum: colItem?.truncate })}
                      </div>
                    </div>
                  )
                })}
              </Row>
              <hr />
            </>
          )}
          <div className={form_detail_main}>
            <ScrollArea scrollDirection='vertical' wrapperClassName={form_detail_body} id='detailBody'>
              {item.__typename === 'Class' ? <ClassShort /> : <RaceShort />}
            </ScrollArea>
          </div>
        </Modal.Content>
        <Modal.Footer>
          <Button color='primary' onClick={handleSelect}>{`Select ${startCase(item.__typename)}`}</Button>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default ShortDetail
