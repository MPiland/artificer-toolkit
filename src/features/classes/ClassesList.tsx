import List from '../../components/List/List'
import ICategory from '../../assets/Icons/ICategory'
import { ReactElement } from 'react'
import { useListClassesQuery, useDeleteClassMutation } from './classesApi'

const ClassList = () => {
  const footerText: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <ICategory />,
      name: 'category.value',
      value: 'Category',
    },
  ]

  return <List useListItems={useListClassesQuery} useDeleteItem={useDeleteClassMutation} footerText={footerText} />
}
export default ClassList
