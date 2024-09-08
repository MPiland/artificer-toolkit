import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Row from '../Row/Row'
import { getValueFromState } from '../../utils/formatting'
import Button from '../Button/Button'
import { form_detail_body, form_detail_main, form_detail_title } from './Form.css'
import Modal from '../Modal/Modal'
import { sprinkles } from '../../css/sprinkles.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import { set, startCase } from 'lodash'
import ClassShort from '../../features/classes/ClassShort'
import RaceShort from '../../features/races/RaceShort'
import { useForm } from '../../hooks/UseForm'

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
  const { context } = useParams()
  const { formState, setChangeRace, setAddClass, setFormState } = useForm()
  const navigate = useNavigate()
  const location = useLocation()

  const item = location.state.item

  const handleSelect = () => {
    if (context === 'race') {
      const raceOject = {
        name: item?.name,
        value: item?.value,
        _id: item?._id,
        ancestry: {
          name: item?.ancestry?.name,
          value: item?.ancestry?.value,
          _id: item?.ancestry?._id,
          desc: item?.ancestry?.desc,
        },
      }
      setFormState({
        target: {
          name: 'race',
          value: raceOject,
        },
      })
      setChangeRace(false)
    }
    if (context === 'class') {
      const classes: any[] = formState?.classes ?? []
      const classOject = {
        name: item?.name,
        value: item?.value,
        _id: item?._id,
        level: 1,
        levelAttribute: item.levelAttribute,
        hitpoint: {
          total: 1,
          diceCount: item?.hitpoint.diceCount,
          diceValue: item?.hitpoint.diceValue,
          diceShort: item?.hitpoint.diceShort,
          ability: item?.hitpoint.ability,
        },
      }
      if (item.spellcasting != null) {
        set(classOject, 'spellcasting', item.spellcasting)
      }
      if (item.resource != null) {
        set(classOject, 'spellcasting', item.resource)
      }

      classes.push(classOject)
      setFormState({
        target: {
          name: 'class',
          value: classes,
        },
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
                      <div>{getValueFromState(colItem, colsData, colItem?.truncate)}</div>
                    </div>
                  )
                })}
              </Row>
              <hr />
            </>
          )}
          <div className={form_detail_main}>
            <ScrollArea scrollDirection='vertical' wrapperClassName={form_detail_body} id='detailBody'>
              {context === 'class' ? <ClassShort /> : <RaceShort />}
            </ScrollArea>
          </div>
        </Modal.Content>
        <Modal.Footer>
          <Button color='primary' onClick={handleSelect}>{`Select ${startCase(context)}`}</Button>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default ShortDetail
