import List, { type FooterConfig } from '@/components/List'
import ICategory from '@/assets/Icons/ICategory'
import { useDeleteClassMutation } from '@/apis/classes.api'
import type { ClassMeta } from '@/types'
import { useClassData } from '@/hooks'

const Classes = () => {
  const { classes, metaData } = useClassData()
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
    <List data={classes} metaData={metaData} useDeleteItem={useDeleteClassMutation} footerConfigs={footerConfigs} />
  )
}
export default Classes
