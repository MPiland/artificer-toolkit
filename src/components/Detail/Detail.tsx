import { ReactNode, Suspense } from 'react'
import {
  detail_body,
  detail_col_item,
  detail_col_section,
  detail_col_title,
  detail_footer,
  detail_link,
  detail_link_icon,
  detail_title,
} from './Detail.css'
import Loading from '@/components/Loading'
import { useMatches } from '@tanstack/react-router'
import type { FormType, FormDataType, Character } from '@/types'
import { useRouteNavigation, useSourceData } from '@/hooks'
import type { DetailConfig } from './Detail.types'
import { useFormStore } from '@/store'
import { Group, Grid, ScrollArea } from '@mantine/core'
import { CopyIcon, Pencil, ChevronLeft } from 'lucide-react'
import Link from '@/components/Link'

interface DetailProps<T extends FormDataType> {
  detailConfigs?: DetailConfig<T>[]
  children: ReactNode
  footer?: any
  footerSpacing?: 'space-between' | 'center' | 'flex-end' | 'flex-start' | undefined
  item: T
}

const Detail = <T extends FormDataType>({
  detailConfigs,
  children,
  footer,
  footerSpacing = 'space-between',
  item,
}: DetailProps<T>) => {
  const getSourceText = useSourceData()
  const { reinitState } = useFormStore((state) => state)

  const form = useMatches({ select: (m) => m[m.length - 1].context.form?.type }) as FormType

  const routeNav = useRouteNavigation(form)
  const itemNav = routeNav.forItem(item.id, item.label)

  return (
    <Suspense fallback={<Loading />}>
      <Group justify='space-between'>
        <ChevronLeft onClick={() => <Link to={'..'} />} cursor={'pointer'} />
        <Group justify='space-between'>
          <Link
            {...routeNav.new}
            className={detail_link}
            onClick={(e) => {
              const itemCopy: Omit<FormDataType, 'id' | 'label' | 'value'> & {
                id: string | undefined
                label: string | undefined
                value: string | undefined
              } = { ...item, id: undefined, label: undefined, value: undefined }
              reinitState(itemCopy as FormDataType)
              e.stopPropagation()
            }}
          >
            {<CopyIcon className={detail_link_icon} />} Copy
          </Link>
          {(item as Exclude<FormDataType, Character>).masterId == null && (
            <Link
              {...itemNav.edit}
              className={detail_link}
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              {<Pencil className={detail_link_icon} />} Edit
            </Link>
          )}
        </Group>
      </Group>
      <div className={detail_title}>
        <h1>{item.label}</h1>
      </div>
      <hr />
      <ScrollArea scrollbars='y' offsetScrollbars='present'>
        {detailConfigs && (
          <>
            <div className={detail_col_section}>
              <Grid>
                {detailConfigs?.map((detail, dIndex) => {
                  return (
                    <Grid.Col span={{ sm: 6, md: 4, lg: 3 }} className={detail_col_item} key={dIndex}>
                      <div className={detail_col_title}>{detail.header}</div>
                      <div>
                        {getSourceText({
                          input: detail,
                          state: item,
                          truncateNum: detail?.truncate,
                        })}
                      </div>
                    </Grid.Col>
                  )
                })}
              </Grid>
            </div>
            <hr />
          </>
        )}
        <div className={detail_body}>{children}</div>
        <div className={detail_footer}>
          <Group justify={footerSpacing} align='end' grow>
            {footer != null && <span>{footer}</span>}
          </Group>
        </div>
      </ScrollArea>
    </Suspense>
  )
}

export default Detail
