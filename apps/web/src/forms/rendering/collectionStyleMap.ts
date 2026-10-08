import * as collectionStyles from './CollectionField.css'

type CollectionRowLayout = 'default' | 'card' | 'flat' | 'compact'

type CollectionStyleClassSet = {
  container: string
  header: string
  list: string
  item: string
  itemHeader: string
  itemBody: string
  separator: string
}

const layoutMap: Record<
  CollectionRowLayout,
  {
    container: string
    header: string
    list: string
    item: string
    itemHeader: string
    itemBody: string
  }
> = {
  default: {
    container: collectionStyles.collectionContainerDefault,
    header: '',
    list: collectionStyles.collectionList,
    item: collectionStyles.collectionItem,
    itemHeader: collectionStyles.collectionItemHeader,
    itemBody: collectionStyles.collectionItemBody
  },
  card: {
    container: collectionStyles.collectionContainerCard,
    header: collectionStyles.collectionHeaderCard,
    list: collectionStyles.collectionList,
    item: `${collectionStyles.collectionItem} ${collectionStyles.collectionItemCard}`,
    itemHeader: `${collectionStyles.collectionItemHeader} ${collectionStyles.collectionItemHeaderCard}`,
    itemBody: `${collectionStyles.collectionItemBody} ${collectionStyles.collectionItemBodyCard}`
  },
  flat: {
    container: collectionStyles.collectionContainerFlat,
    header: collectionStyles.collectionHeaderFlat,
    list: `${collectionStyles.collectionList} ${collectionStyles.collectionListFlat}`,
    item: `${collectionStyles.collectionItem} ${collectionStyles.collectionItemFlat}`,
    itemHeader: `${collectionStyles.collectionItemHeader} ${collectionStyles.collectionItemHeaderInline}`,
    itemBody: `${collectionStyles.collectionItemBody} ${collectionStyles.collectionItemBodyInline}`
  },
  compact: {
    container: collectionStyles.collectionContainerCompact,
    header: '',
    list: `${collectionStyles.collectionList} ${collectionStyles.collectionListCompact}`,
    item: `${collectionStyles.collectionItem} ${collectionStyles.collectionItemCompact}`,
    itemHeader: `${collectionStyles.collectionItemHeader} ${collectionStyles.collectionItemHeaderInline}`,
    itemBody: `${collectionStyles.collectionItemBody} ${collectionStyles.collectionItemBodyInline}`
  }
}

export function getCollectionStyleSet(
  rowLayout: CollectionRowLayout,
  compactTable: boolean
): CollectionStyleClassSet {
  const base = layoutMap[rowLayout]

  return {
    container: base.container,
    header: base.header,
    list: compactTable ? `${base.list} ${collectionStyles.collectionListCompactTable}` : base.list,
    item: compactTable
      ? `${collectionStyles.collectionItem} ${collectionStyles.collectionItemCompactTable}`
      : base.item,
    itemHeader: base.itemHeader,
    itemBody: compactTable
      ? `${collectionStyles.collectionItemBody} ${collectionStyles.collectionItemBodyCompactTable}`
      : base.itemBody,
    separator: collectionStyles.collectionDivider
  }
}
