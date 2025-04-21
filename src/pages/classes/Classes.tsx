import List from '../../components/List/List'
import ICategory from '../../assets/Icons/ICategory'
import { Suspense } from 'react'
import { useDeleteClass } from '../../apis/classesApi'
import Loading from '../../components/Loading/Loading'
import type { FooterConfig } from '../../types/components'
import type { ClassMeta } from '../../../amplify/gql/types'
import useClassData from '../../hooks/useClassData'

const Classes = () => {
  const { all: classes, metaData } = useClassData()
  const footerConfigs: FooterConfig<ClassMeta>[] = [
    {
      icon: <ICategory />,
      text: [{ metaPath: 'categories', source: { type: 'system', sourcePath: 'categories' } }],
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
