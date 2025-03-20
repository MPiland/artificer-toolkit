import { FC, ReactNode, Suspense, use, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import { FormDataType } from '../../types/form'
import { Character } from '../../../amplify/gql/types'
import Loading from '../Loading/Loading'
import Grid from '../Grid/Grid'

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

  const { updateFormData, fullReset } = use(FormContext)

  const item: FormDataType = location.state.item

  const handleEdit = () => {
    try {
      fullReset()
      updateFormData({ type: 'reset', value: item })
      updateFormData({ type: 'initialReset', value: item })
      navigate(`../edit/${item.value}`)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCopy = () => {
    try {
      fullReset()
      const itemCopy: FormDataType = { ...item, id: undefined, label: undefined, value: undefined }
      if (itemCopy.__typename !== 'Character') {
        itemCopy.masterId = undefined
      }
      updateFormData({ type: 'reset', value: itemCopy })
      updateFormData({ type: 'initialReset', value: itemCopy })
      navigate(`../new`)
    } catch (err) {
      console.error(err)
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
    <Suspense fallback={<Loading />}>
      <div className={detail_nav_section}>
        <MdArrowBackIos onClick={() => navigate(-1)} cursor={'pointer'} style={{ scale: '1.5' }} />
        <Button color='main' style='outline' onClick={handleCopy}>
          {<CopyIcon />} Copy
        </Button>
        {(item as Exclude<FormDataType, Character>).masterId == null && (
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
          <>
            <div className={detail_col_section}>
              <Grid>
                {cols?.map((colItem, colIndex) => {
                  return (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 3 }} className={detail_col_item} key={colIndex}>
                      <div className={detail_col_title}>{colItem.header}</div>
                      <div>
                        {getValueFromState({
                          input: colItem,
                          state: colsData,
                          getSourceData,
                          truncateNum: colItem?.truncate,
                        })}
                      </div>
                    </Grid.Item>
                  )
                })}
              </Grid>
            </div>
            <hr />
          </>
        )}
        <div className={detail_body}>{children}</div>
        <div className={detail_footer}>
          <Group justifyContentVariant={footerSpacing} directionVariant='row' alignItemsVariant='end'>
            {footer != null && <span>{footer}</span>}
          </Group>
        </div>
      </ScrollArea>
    </Suspense>
  )
}

export default Detail
