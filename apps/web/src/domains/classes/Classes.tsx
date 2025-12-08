import List, { type FooterConfig } from '~components/List'
import ICategory from '~assets/Icons/ICategory'
import { useDeleteClass, useListClasses } from '~apis'
import type { ClassMeta } from '~types'

const Classes = () => {
  const {
    data: { classes, metaData },
  } = useListClasses()

  const footerConfigs: FooterConfig<ClassMeta>[] = [
    {
      icon: <ICategory />,
      text: {
        metaObject: 'categories',
        paths: [
          {
            path: 'id',
            source: { type: 'system', sourcePath: 'categories' },
          },
        ],
      },
      value: 'Category',
    },
  ]

  return (
    <List data={classes} metaData={metaData} useDeleteItem={useDeleteClass} footerConfigs={footerConfigs} />
  )
}
export default Classes
