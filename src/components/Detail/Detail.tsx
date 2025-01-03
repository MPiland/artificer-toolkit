import { FC, ReactNode, use, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Row from '../Row/Row'
import { getValueFromState } from '../../utils/formatting'
import Group from '../Group/Group'
import {
  detail_body,
  detail_col_item,
  detail_col_section,
  detail_col_title,
  detail_footer,
  detail_nav_section,
  detail_title,
} from './Detail.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import { FormContext } from '../Form/FormContext'
import { useGetSystemQuery } from '../../features/systems/systemsApi'
import { useListClassesQuery } from '../../features/classes/classesApi'
import { MdArrowBackIos, MdEdit } from 'react-icons/md'
import Button from '../Button/Button'
import CopyIcon from '../../assets/Icons/ICopy'

type colType = {
  header: string
  name: any
  truncate?: number
  filter?: undefined | string[]
}

interface DetailProps {
  cols?: colType[]
  colsData?: any
  children: ReactNode
  footer?: any
  footerSpacing?: 'spaceBetween' | 'center' | 'end' | 'start' | undefined
}

const Detail: FC<DetailProps> = ({ cols, colsData, children, footer, footerSpacing = 'spaceBetween' }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const { updateFormData, setStepIndex, stateReset } = use(FormContext)

  const item = location.state.item

  const handleEdit = async () => {
    try {
      await stateReset()
      setStepIndex(0)
      updateFormData({ type: 'reset', value: item })
      updateFormData({ type: 'initialReset', value: item })
      navigate('edit')
    } catch {
      console.error('error resetting state')
    }
  }

  const getSourceData = useCallback(
    (sourceType: string) => {
      switch (sourceType) {
        case 'system':
          return system
        case 'classes':
          return classes
        default:
          return null
      }
    },
    [classes, system]
  )

  return (
    <>
      <div className={detail_nav_section}>
        <MdArrowBackIos onClick={() => navigate(-1)} cursor={'pointer'} style={{ scale: '1.5' }} />
        <Button color='main' style='outline'>
          {<CopyIcon />} Copy
        </Button>
        {item.masterId == null && (
          <Button color='main' style='outline' onClick={handleEdit}>
            {<MdEdit />} Edit
          </Button>
        )}
      </div>
      <div className={detail_title}>
        <h1>{item.label}</h1>
      </div>
      <hr />
      <ScrollArea scrollDirection='vertical'>
        {colsData && cols && (
          <div className={detail_col_section}>
            <Row cols={{ lg: 4, md: 3, base: 2 }}>
              {cols?.map((colItem, colIndex) => {
                return (
                  <div className={detail_col_item} key={colIndex}>
                    <div className={detail_col_title}>{colItem.header}</div>
                    <div>
                      {getValueFromState({
                        input: colItem,
                        state: colsData,
                        getSourceData,
                        truncateNum: colItem?.truncate,
                      })}
                    </div>
                  </div>
                )
              })}
            </Row>
          </div>
        )}
        <hr />
        <div className={detail_body}>{children}</div>
        <div className={detail_footer}>
          <Group justifyContentVariant={footerSpacing} directionVariant='row' alignItemsVariant='end'>
            {footer}
          </Group>
        </div>
      </ScrollArea>
    </>
  )
}

export default Detail
