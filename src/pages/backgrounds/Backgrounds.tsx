import List from '~/components/List'
import { useDeleteBackground, useListBackgrounds } from '~/apis'

const Backgrounds = () => {
  const {
    data: { backgrounds },
  } = useListBackgrounds()
  return <List data={backgrounds} useDeleteItem={useDeleteBackground} />
}

export default Backgrounds
