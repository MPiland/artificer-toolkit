import List, { FooterConfig } from '@components/List'
import { useDeleteRace, useListRaces } from '@apis'
import ICategory from '@assets/icons/ICategory'
import type { RaceMeta } from '@types'

const Races = () => {
  const {
    data: { races, metaData },
  } = useListRaces()
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
  return <List data={races} metaData={metaData} useDeleteItem={useDeleteRace} footerConfigs={footerConfigs} />
}

export default Races
