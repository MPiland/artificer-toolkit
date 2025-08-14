import { ReactNode, Suspense, type MouseEvent } from 'react'
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
import Loading from '~/components/Loading'
import { useMatches } from '@tanstack/react-router'
import type { FormType, Character, SourceDataType } from '~/types'
import { useRouteNavigation, useSourceData } from '~/hooks'
import type { DetailConfig } from './Detail.types'
import { useFormStore } from '~/store'
import { Group, Grid, ScrollArea, Modal } from '@mantine/core'
import { CopyIcon, Pencil, ChevronLeft } from 'lucide-react'
import Link from '~/components/Link'
import { discriminatedDomainInputSchema } from '~/schemas'
import { sprinkles } from '~/css/sprinkles.css'

interface DetailProps<T extends SourceDataType> {
  detailConfigs?: DetailConfig<T>[]
  children: ReactNode
  footer?: ReactNode
  footerSpacing?: 'space-between' | 'center' | 'flex-end' | 'flex-start' | undefined
  item: T
}

const Detail = <T extends SourceDataType>({
  detailConfigs,
  children,
  footer,
  footerSpacing = 'space-between',
  item,
}: DetailProps<T>) => {
  const getSourceText = useSourceData()
  const formStore = useFormStore()

  const form = useMatches({ select: (m) => m[m.length - 1].context.form?.type }) as FormType

  const routeNav = useRouteNavigation(form)
  const itemNav = routeNav.forItem(item.id, item.label)

  return (
    <Suspense
      fallback={
        <Modal opened onClose={() => {}}>
          <Loading />
        </Modal>
      }
    >
      <Group justify='space-between'>
        <ChevronLeft onClick={() => <Link to={'..'} />} cursor={'pointer'} />
        <Group justify='space-between'>
          <Link
            {...itemNav.copy}
            className={detail_link}
            type='unstyled'
            onClick={(e: MouseEvent<HTMLElement>) => {
              const kind = `${item.__typename}Input`
              const itemCopy = discriminatedDomainInputSchema.parse({
                __kind: kind,
                ...item,
                id: '',
                label: '',
                value: '',
              })
              formStore.setCurrent(itemCopy)
              e.stopPropagation()
            }}
          >
            {<CopyIcon className={detail_link_icon} />} Copy
          </Link>
          {(item as Exclude<SourceDataType, Character>).masterId == null && (
            <Link
              type='unstyled'
              {...itemNav.edit}
              className={detail_link}
              onClick={(e: MouseEvent<HTMLElement>) => {
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
      <hr
        className={sprinkles({
          width: 'size-full',
        })}
      />
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
            <hr
              className={sprinkles({
                width: 'size-full',
              })}
            />
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
