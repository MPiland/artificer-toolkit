import { use, memo } from 'react'
import Collapsible from '@/components/Collapsible'
import type { ListItemType, FormDataType, MetaDataType, Character } from '@/types'
import { Link } from '@tanstack/react-router'
import { Pencil, ExternalLink } from 'lucide-react'
import { useFormStore, type FormStore } from '@/store'
import { ListNavigationResult, useMetaData } from '@/hooks'
import { FooterConfig } from './List.types'
import { list_footer_group, list_footer_item, list_sub, list_item_link_icon } from './List.css'
import { ModalContext } from '@/components/Modal'
import type { UseMutationResult } from '@tanstack/react-query'

type VirtualItemProps<K extends MetaDataType> = {
  view: 'grid' | 'list'
  item: ListItemType
  routeNav: ListNavigationResult
  footerConfigs?: FooterConfig<K>[]
  metaData?: K
  useDeleteItem: () => UseMutationResult<string, Error, string, unknown>
  setErrorMessage: (arg: string) => void
  sm: boolean
  sub?: boolean
}

const VirtualItem = <T extends MetaDataType>({
  view,
  item,
  routeNav,
  footerConfigs,
  sub = false,
  metaData,
  useDeleteItem,
  sm,
  setErrorMessage,
}: VirtualItemProps<T>) => {
  const { reinitState }: FormStore<FormDataType> = useFormStore((state) => state)
  const { getSourceText } = useMetaData({ metaData })
  const { showModal } = use(ModalContext)
  const { mutateAsync: deleteItem } = useDeleteItem()

  const handleDeleteConfirmed = async (id: ListItemType['id']) => {
    try {
      await deleteItem(id)
    } catch (err: any) {
      if ('data' in err) {
        if ('messasge' in err.data) {
          return setErrorMessage(err.data.message)
        }
      }
      return setErrorMessage('An unknown error occurred')
    }
  }

  const handleDelete = (label: ListItemType['label'], id: ListItemType['id']) => {
    showModal({
      type: 'delete',
      props: {
        label: label,
        onDelete: () => handleDeleteConfirmed(id),
      },
    })
  }

  const itemNav = routeNav.forItem(item.id, item.label)

  return (
    <Collapsible disabled={view === 'grid' && true} defaultOpen={false} className={sub ? list_sub : ''}>
      <Collapsible.Trigger
        title={`${item.label} ${(item as Exclude<ListItemType, Character>).masterId !== null ? '(M)' : ''}`}
        titleRight={
          <>
            <Link {...itemNav.view} onClick={(e) => e.stopPropagation()}>
              <ExternalLink className={list_item_link_icon} />
            </Link>
            {(item as Exclude<ListItemType, Character>).masterId === null && (
              <Link
                {...itemNav.edit}
                onClick={(e) => {
                  reinitState()
                  e.stopPropagation()
                }}
              >
                <Pencil className={list_item_link_icon} />
              </Link>
            )}
          </>
        }
        removeFn={
          (item as Exclude<ListItemType, Character>).masterId === null ?
            () => handleDelete(item.label, item.id)
          : undefined
        }
        titleLeft={'level' in item && (item.level || item.level === 0) && `(${item.level})`}
      />
      <Collapsible.Content>{item.desc}</Collapsible.Content>
      {footerConfigs && (
        <Collapsible.Footer>
          <div className={list_footer_group}>
            {footerConfigs.map((footer, fIndex) => {
              const text = getSourceText({ footer, state: item })
              if (((footer.display === view && !sm) || !footer.display) && text !== '---') {
                return (
                  <div className={list_footer_item} key={fIndex}>
                    {footer.icon ?? footer.value}
                    {text}
                  </div>
                )
              }
            })}
          </div>
        </Collapsible.Footer>
      )}
    </Collapsible>
  )
}

const MemoizedVirtualItem = memo(VirtualItem) as typeof VirtualItem

export default MemoizedVirtualItem
