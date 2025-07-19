import List, { FooterConfig } from '@/components/List'
import { useDeleteRaceMutation } from '@/apis/races.api'
import ICategory from '@/assets/Icons/ICategory'
import type { RaceMeta } from '@/types'
import { useRaceData } from '@/hooks'

const Races = () => {
  const { races, metaData } = useRaceData()
  const footerConfigs: FooterConfig<RaceMeta>[] = [
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
  return <List data={races} metaData={metaData} useDeleteItem={useDeleteRaceMutation} footerConfigs={footerConfigs} />
}

export default Races
