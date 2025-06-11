import { Suspense } from 'react'
import List, { FooterConfig } from '@/components/List'
import { useDeleteRaceMutation } from '@/apis/races.api'
import Loading from '@/components/Loading'
import ICategory from '@/assets/Icons/ICategory'
import type { RaceMeta } from '@/types'
import { useRaceData } from '@/hooks'

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
