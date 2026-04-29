import List from '@components/List'
import { useDeleteBackground, useGetBackgroundList } from '@data/backgrounds'

const Backgrounds = () => {
  const { data } = useGetBackgroundList()

  if (data) {
    const { items: backgrounds } = data
    return <List data={backgrounds} useDeleteItem={useDeleteBackground} />
  }
}

export default Backgrounds
