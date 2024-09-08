import { useState, useEffect, useRef, ReactNode } from 'react'

const InfiniteScroll = ({
  children,
  loadMore,
  hasMore,
  threshold = 0.8,
}: {
  children: ReactNode
  loadMore: () => Promise<void>
  hasMore: boolean
  threshold?: number
}) => {
  const [isFetching, setIsFetching] = useState(false)
  const observerTargetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observerTarget = observerTargetRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isFetching) {
          setIsFetching(true)
          loadMore().finally(() => setIsFetching(false))
        }
      },
      { threshold }
    )

    if (observerTarget) {
      observer.observe(observerTarget)
    }

    return () => {
      if (observerTarget) {
        observer.unobserve(observerTarget)
      }
    }
  }, [isFetching, hasMore, loadMore, threshold])

  return (
    <div>
      {children}
      <div ref={observerTargetRef} />
      {isFetching && <div>Loading...</div>}
    </div>
  )
}

export default InfiniteScroll
