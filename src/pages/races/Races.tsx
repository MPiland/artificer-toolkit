import { Suspense } from 'react'
import List from '../../components/List/List'
import { useDeleteRaceMutation } from '../../apis/racesApi'
import Loading from '../../components/Loading/Loading'
import ICategory from '../../assets/Icons/ICategory'
import type { FooterConfig } from '../../types/components'
import type { RaceMeta } from '../../../amplify/gql/types'
import useRaceData from '../../hooks/useRaceData'

const Races = () => {
  const { races, metaData } = useRaceData()
  const footerConfigs: FooterConfig<RaceMeta>[] = [
    {
      icon: <ICategory />,
      text: [{ metaPath: 'categories', source: { type: 'system', sourcePath: 'categories' } }],
      value: 'Category',
    },
  ]
  return (
    <Suspense fallback={<Loading />}>
      <List data={races} metaData={metaData} useDeleteItem={useDeleteRaceMutation} footerConfigs={footerConfigs} />
    </Suspense>
  )
}

export default Races
