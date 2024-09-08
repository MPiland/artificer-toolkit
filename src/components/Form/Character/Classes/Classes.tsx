import { useIsFetching } from '@tanstack/react-query'
import { useForm } from '../../../../hooks/UseForm'
import Spinner from '../../../Spinner/Spinner'
import ClassContainer from './ClassContainer'
import ClassSelection from './ClassSelection'

const Classes = () => {
  const isLoading = useIsFetching() > 0
  const { addClass, formState } = useForm()

  return isLoading ? (
    <Spinner />
  ) : formState.class?.length > 0 && !addClass ? (
    <>
      {formState.class?.map((uClass: any, cIndex: number) => (
        <ClassContainer uClass={uClass} key={cIndex} />
      ))}
    </>
  ) : (
    <ClassSelection />
  )
}

export default Classes
