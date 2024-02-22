import { useSelector } from 'react-redux'
import { RootState } from '../app/store'
import { QueryStatus } from '@reduxjs/toolkit/query'

const useIsLoading = () => {
  const isLoading = useSelector((state: RootState) => {
    return Object.values(state.api.queries).some((query) => {
      return query && query.status === QueryStatus.pending
    })
  })

  return isLoading
}

export default useIsLoading
