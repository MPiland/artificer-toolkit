import { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Grid from '../Grid/Grid'
import { getValueFromState } from '../../utils/formatting'
import Button from '../Button/Button'
import { form_detail_body, form_detail_main, form_detail_title } from './Form.css'
import Modal from '../Modal/Modal'
import { sprinkles } from '../../css/sprinkles.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import { startCase } from 'lodash'

type colType = {
  header: string
  name: string | any[]
  truncate?: number
  filter?: undefined | string[]
}

interface FormDetailProps {
  cols?: colType[]
  colsData?: any
  children: ReactNode
  footer?: any
  footerSpacing?: 'spaceBetween' | 'center' | 'end' | 'start' | undefined
}

const FormDetail = ({ cols, colsData, children }: FormDetailProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const item = location.state.item
  const context = location.state.context

  const handleSelect = () => {
    navigate(`${location.state.background.pathname}`, {
      state: {
        selection: {
          context: context,
          item: item,
        },
        selected: true,
      },
    })
  }

  return (
    <>
      <Modal.Header title={item.value} />
      <Modal.Body>
        {colsData && cols && (
          <>
            <Grid cols={{ lg: 4, md: 3, base: 2 }} className={sprinkles({ mb: 'size-2' })}>
              {cols?.map((colItem, colIndex) => {
                return (
                  <div key={colIndex}>
                    <div className={form_detail_title}>{colItem.header}</div>
                    <div>{getValueFromState(colItem, colsData, colItem?.truncate)}</div>
                  </div>
                )
              })}
            </Grid>
            <hr />
          </>
        )}
        <div className={form_detail_main}>
          <ScrollArea scrollDirection='vertical' wrapperClassName={form_detail_body} id='detailBody'>
            {children}
          </ScrollArea>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' onClick={handleSelect}>{`Select ${startCase(context)}`}</Button>
      </Modal.Footer>
    </>
  )
}

export default FormDetail
