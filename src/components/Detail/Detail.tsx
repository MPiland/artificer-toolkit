import { ReactNode, Suspense, use, useCallback } from 'react'
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
import { useGetSystemQuery } from '../../apis/systemsApi'
import { useListClassesQuery } from '../../apis/classesApi'
import { MdArrowBackIos, MdEdit } from 'react-icons/md'
import Button from '../Button/Button'
import CopyIcon from '../../assets/Icons/ICopy'
import { FormDataType } from '../../types/form'
import { Character } from '../../../amplify/gql/types'
import Loading from '../Loading/Loading'
import Grid from '../Grid/Grid'
import { Link, Navigate, useLocation } from '@tanstack/react-router'
import { navigatePath } from '../../utils/form'
import { FormType } from '../../types/form'

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
  item: FormDataType
}

const Detail = ({ cols, colsData, children, footer, footerSpacing = 'spaceBetween', item }: DetailProps) => {
  const location = useLocation()

  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const { updateFormData, fullReset } = use(FormContext)

  const form = location?.pathname.split('/')[2] as FormType

  const handleEdit = () => {
    const pathOptions = navigatePath({ form, type: 'form', action: 'edit', label: item.label })
    if (!pathOptions) return null // Handle the undefined case
    try {
      fullReset()
      updateFormData({ type: 'reset', value: item })
      updateFormData({ type: 'initialReset', value: item })
      return <Navigate to={pathOptions.path} params={pathOptions.params} />
    } catch (err) {
      console.error(err)
    }
  }

  const handleCopy = () => {
    try {
      fullReset()
      const itemCopy: FormDataType = { ...item, id: '', label: '', value: '' }
      if (itemCopy.__typename !== 'Character') {
        itemCopy.masterId = undefined
      }
      updateFormData({ type: 'reset', value: itemCopy })
      updateFormData({ type: 'initialReset', value: itemCopy })
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
        <MdArrowBackIos onClick={() => <Link to={'..'} />} cursor={'pointer'} style={{ scale: '1.5' }} />
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
