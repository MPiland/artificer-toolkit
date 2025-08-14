import type { FooterConfig } from './List.types'
import { Fragment, memo } from 'react'
import type { ListItemType, MetaDataType } from '~/types'
import { type ListNavigationResult } from '~/hooks'
import type { UseMutationResult } from '@tanstack/react-query'
import VirtualItem from './VirtualItem'

type VirtualListProps<K extends MetaDataType> = {
  virtualIndex: number
  startPos: number
  view: 'grid' | 'list'
  ref: (node: Element | null | undefined) => void
  items: ListItemType[]
  subItems: ListItemType[]
  routeNav: ListNavigationResult
  footerConfigs?: FooterConfig<K>[]
  metaData?: K
  useDeleteItem: () => UseMutationResult<string, Error, string, unknown>
  setErrorMessage: (arg: string) => void
  sm: boolean
}

const VirtualList = <T extends MetaDataType>({
  virtualIndex,
  ref,
  startPos,
  view,
  items,
  routeNav,
  subItems,
  footerConfigs,
  metaData,
  useDeleteItem,
  setErrorMessage,
  sm,
}: VirtualListProps<T>) => {
  return (
    <div
      data-index={virtualIndex}
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${startPos}px)`,
        display: view === 'grid' ? 'grid' : 'block',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '1rem',
      }}
    >
      {items.map((item) => {
        return (
          <Fragment key={item.id}>
            <VirtualItem
              view={view}
              setErrorMessage={setErrorMessage}
              footerConfigs={footerConfigs}
              item={item}
              routeNav={routeNav}
              metaData={metaData}
              useDeleteItem={useDeleteItem}
              sm={sm}
            />
            {subItems.length > 0 &&
              subItems.map((sItem) => {
                if (
                  (metaData?.__typename === 'ClassMeta' &&
                    metaData.parentClasses?.some(
                      (parentClass) => parentClass.id === item.id && parentClass.classIds?.includes(sItem.id)
                    )) ||
                  (metaData?.__typename === 'RaceMeta' &&
                    metaData.lineages?.some((lineage) => lineage.id === item.id && lineage.raceIds?.includes(sItem.id)))
                ) {
                  return (
                    <VirtualItem
                      key={sItem.id}
                      view={view}
                      setErrorMessage={setErrorMessage}
                      footerConfigs={footerConfigs}
                      item={sItem}
                      routeNav={routeNav}
                      metaData={metaData}
                      useDeleteItem={useDeleteItem}
                      sm={sm}
                      sub={true}
                    />
                  )
                }
              })}
          </Fragment>
        )
      })}
    </div>
  )
}

const MemoizedVirtualList = memo(VirtualList) as typeof VirtualList

export default MemoizedVirtualList
