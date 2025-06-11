import List, { type FooterConfig } from '@/components/List'
import ICategory from '@/assets/Icons/ICategory'
import { Suspense } from 'react'
import { useDeleteClass } from '@/apis/classes.api'
import Loading from '@/components/Loading'
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
    <Suspense fallback={<Loading />}>
      <List data={classes} metaData={metaData} useDeleteItem={useDeleteClass} footerConfigs={footerConfigs} />
    </Suspense>
  )
}
export default Classes
