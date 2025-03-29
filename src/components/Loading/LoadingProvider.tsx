import { useEffect, useState, ReactNode } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { LoadingContext } from './LoadingContext'

const useLoadingOptions = () => {
  const isFetching = useIsFetching()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading((prev) => prev && isFetching > 0)
  }, [isFetching])

  return { isLoading, setIsLoading }
}

const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const loadingOptions = useLoadingOptions()
  return <LoadingContext value={loadingOptions}>{children}</LoadingContext>
}

export default LoadingProvider

export type LoadingOptionsType = ReturnType<typeof useLoadingOptions>
