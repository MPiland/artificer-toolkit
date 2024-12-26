import { createContext, useEffect, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'

export const LoadingOptions = () => {
  const isFetching = useIsFetching()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading((prev) => prev && isFetching > 0)
  }, [isFetching])

  return { isLoading, setIsLoading }
}

export type LoadingOptionsType = ReturnType<typeof LoadingOptions> | null

const LoadingContext = createContext<LoadingOptionsType>(undefined)

export default LoadingContext
