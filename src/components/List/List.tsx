import { useCallback, useRef, useState, use, useMemo } from 'react'
import clsx from 'clsx'
import { base, title_button_container } from './List.css'
import type { FilterConfig, FilterDataType, FooterConfig } from './List.types'
import { useMediaQuery } from 'usehooks-ts'
import { type UseMutationResult } from '@tanstack/react-query'
import { Outlet, useNavigate, useMatches } from '@tanstack/react-router'
import { startCase } from 'lodash-es'
import type { Maybe, FormDataType, FormType, ListItemType, MetaDataType, SourceDataType } from '~/types'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Categories } from '~/enums'
import Filter from './Filter'
import { sprinkles } from '~/css/sprinkles.css'
import { ModalContext } from '~/components/Modal'
import { useFormStore, type FilterState } from '~/store'
import { useRouteNavigation, useFilteredList } from '~/hooks'
import VirtualList from './VirtualList'
import { PlusIcon, Copy, LayoutGrid, List as ListIcon } from 'lucide-react'
import { Group, ScrollArea, Divider } from '@mantine/core'
import { Button } from '@mantine/core'
import { discriminatedDomainInputSchema } from '~/schemas'
import Link from '~/components/Link'
import { useMantineColorScheme } from '@mantine/core'
import { vars } from '~/css/theme'

interface ListProps<T extends ListItemType, K extends MetaDataType, U extends FilterDataType> {
  className?: string
  visibility?: 'hidden' | 'visible' | 'always'
  useDeleteItem: () => UseMutationResult<string, Error, string, unknown>
  data: Maybe<T[]>
  metaData?: K
  footerConfigs?: FooterConfig<K>[]
  filterConfigs?: FilterConfig<U, K>[]
}

const List = <T extends ListItemType, K extends MetaDataType, U extends FilterDataType>({
  className,
  data,
  metaData,
  useDeleteItem,
  footerConfigs,
  filterConfigs,
}: ListProps<T, K, U>) => {
  const navigate = useNavigate()
  const { colorScheme } = useMantineColorScheme()
  const sm = useMediaQuery('screen and (max-width: 567px)')
  const { showModal } = use(ModalContext)
  const formStore = useFormStore()

  const form = useMatches({ select: (m) => m[m.length - 1].context.form?.type }) as FormType

  const routeNav = useRouteNavigation(form)
  const filteredData = useFilteredList({ data, context: form as keyof FilterState, metaData, filterConfigs })

  const listRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const [view, setView] = useState<'list' | 'grid'>('list')
  const [errorMessage, setErrorMessage] = useState<string>()

  const handleCopyConfirmed = (item: SourceDataType) => {
    const kind = `${item.__typename}Input`
    const data = discriminatedDomainInputSchema.parse({
      ...item,
      __kind: kind,
      id: '',
      label: '',
      value: '',
    }) as FormDataType
    const itemNav = routeNav.forItem(item.id, item.label).copy
    formStore.setCurrent(data)
    navigate({ to: itemNav.to, params: itemNav.params })
  }

  const handleCopy = () => {
    showModal({
      type: 'copy',
      props: {
        form: form,
        data: data?.map((item) => ({
          label: item.label,
          id: item.id,
        })),
        onCopy: (item) => handleCopyConfirmed(item as SourceDataType),
      },
    })
  }

  const isSub = useCallback(
    (item: ListItemType, defaultCase: 'true' | 'false') => {
      if (item.__typename === 'ClassListItem' && metaData?.__typename === 'ClassMeta') {
        return metaData.categories?.some(
          (category) => category.id === Categories.SUBCLASS && category.classIds?.includes(item.id)
        )
      }
      if (item.__typename === 'RaceListItem' && metaData?.__typename === 'RaceMeta') {
        return metaData.categories?.some(
          (category) => category.id === Categories.SUBRACE && category.raceIds?.includes(item.id)
        )
      }
      return defaultCase === 'false' ? false : true
    },
    [metaData]
  )

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredData?.length / (view === 'grid' ? 3 : 1)),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 2,
  })

  const nonSubItems = useMemo(() => filteredData.filter((item) => !isSub(item, 'false')), [filteredData, isSub])
  const subItems = useMemo(() => filteredData.filter((item) => isSub(item, 'false')), [filteredData, isSub])

  return (
    <>
      <Group>
        <h2 className={sprinkles({ w: 'size-full' })}>{startCase(form)}</h2>
        <Group justify='space-between' w='100%'>
          {!sm && !subItems.length && (
            <Group justify='flex-end' align='flex-end'>
              <Button
                variant='subtle'
                color={colorScheme === 'dark' ? vars.colors.blue[3] : vars.colors.dark[4]}
                onClick={() => setView('grid')}
                size='compact-md'
              >
                <LayoutGrid />
              </Button>
              <Button
                variant='subtle'
                color={colorScheme === 'dark' ? vars.colors.blue[3] : vars.colors.dark[4]}
                onClick={() => setView('list')}
                size='compact-md'
              >
                <ListIcon />
              </Button>
            </Group>
          )}
          <Group className={title_button_container} mb='sm'>
            <Button
              variant='subtle'
              color={colorScheme === 'dark' ? vars.colors.blue[3] : vars.colors.dark[4]}
              onClick={handleCopy}
              size='compact-md'
            >
              <Copy /> {!sm && <span className={sprinkles({ ms: 'space-2' })}> Copy</span>}
            </Button>
            <Link
              {...routeNav.new}
              type='styled'
              variant='subtle'
              color={colorScheme === 'dark' ? vars.colors.blue[3] : vars.colors.dark[4]}
              size='compact-md'
            >
              <PlusIcon /> {!sm && <span className={sprinkles({ ms: 'space-2' })}> Create</span>}
            </Link>
          </Group>
        </Group>
      </Group>
      <Divider className={sprinkles({ mb: 'space-4' })} />
      {filterConfigs && (
        <Group grow align='flex-end' className={sprinkles({ mb: 'space-4' })}>
          <Filter context={form as keyof FilterState} metaData={metaData} filterConfigs={filterConfigs} />
        </Group>
      )}
      {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
      <ScrollArea viewportRef={parentRef} type='hover' offsetScrollbars='y'>
        <div
          ref={listRef}
          className={clsx({ [className || '']: className }, base, view)}
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const rowStartIndex = virtualItem.index * (view === 'grid' ? 3 : 1)
            const rowEndIndex = Math.min(rowStartIndex + (view === 'grid' ? 3 : 1), filteredData.length)
            const itemsInRow: ListItemType[] = nonSubItems.slice(rowStartIndex, rowEndIndex)

            return (
              <VirtualList<K>
                key={virtualItem.key}
                virtualIndex={virtualItem.index}
                view={view}
                ref={rowVirtualizer.measureElement}
                items={itemsInRow}
                startPos={virtualItem.start}
                subItems={subItems}
                routeNav={routeNav}
                footerConfigs={footerConfigs}
                metaData={metaData}
                useDeleteItem={useDeleteItem}
                setErrorMessage={setErrorMessage}
                sm={sm}
              />
            )
          })}
        </div>
      </ScrollArea>
      <Outlet />
    </>
  )
}

export default List
