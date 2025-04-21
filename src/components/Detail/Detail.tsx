import { ReactNode, Suspense, use } from 'react'
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
import { MdArrowBackIos, MdEdit } from 'react-icons/md'
import CopyIcon from '../../assets/Icons/ICopy'
import type { FormDataType } from '../../types/form'
import type { Character } from '../../../amplify/gql/types'
import Loading from '../Loading/Loading'
import Grid from '../Grid/Grid'
import { Link, useMatches } from '@tanstack/react-router'
import { FormType } from '../../types/form'
import useRouteNavigation from '../../hooks/useRouteNavigation'
import type { DetailConfig } from '../../types/components'
import useSourceData from '../../hooks/useSourceData'
import { FormContext } from '../Form/FormContext'

interface DetailProps<T extends FormDataType> {
  detailConfigs?: DetailConfig<T>[]
  children: ReactNode
  footer?: any
  footerSpacing?: 'spaceBetween' | 'center' | 'end' | 'start' | undefined
  item: FormDataType
}

const Detail = <T extends FormDataType>({
  detailConfigs,
  children,
  footer,
  footerSpacing = 'spaceBetween',
  item,
}: DetailProps<T>) => {
  const getSourceText = useSourceData()
  const { reinitializeForm } = use(FormContext)

  const form = useMatches({ select: (m) => m[m.length - 1].context.form?.type }) as FormType

  const routeNav = useRouteNavigation(form)
  const itemNav = routeNav.forItem(item.id, item.label)

  return (
    <Suspense fallback={<Loading />}>
      <div className={detail_nav_section}>
        <MdArrowBackIos onClick={() => <Link to={'..'} />} cursor={'pointer'} style={{ scale: '1.5' }} />
        <Link
          {...routeNav.new}
          onClick={(e) => {
            const itemCopy: Omit<FormDataType, 'id' | 'label' | 'value'> & {
              id: string | undefined
              label: string | undefined
              value: string | undefined
            } = { ...item, id: undefined, label: undefined, value: undefined }
            reinitializeForm(itemCopy as FormDataType)
            e.stopPropagation()
          }}
        >
          {<CopyIcon />} Copy
        </Link>
        {(item as Exclude<FormDataType, Character>).masterId == null && (
          <Link
            {...itemNav.edit}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {<MdEdit />} Edit
          </Link>
        )}
      </div>
      <div className={detail_title}>
        <h1>{item.label}</h1>
      </div>
      <hr />
      <ScrollArea scrollDirection='vertical'>
        {detailConfigs && (
          <>
            <div className={detail_col_section}>
              <Grid>
                {detailConfigs?.map((detail, dIndex) => {
                  return (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 3 }} className={detail_col_item} key={dIndex}>
                      <div className={detail_col_title}>{detail.header}</div>
                      <div>
                        {getSourceText({
                          input: detail,
                          state: item,
                          truncateNum: detail?.truncate,
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
