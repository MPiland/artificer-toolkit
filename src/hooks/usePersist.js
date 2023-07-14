import { useState, useEffect } from 'react'

const usePersist = async () => {
  const [persist, setPersist] = useState(
    JSON.parse(localStorage.getItem('persist'))
  )

  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist()
    console.log(`Persisted storage granted: ${isPersisted}`)
  }

  useEffect(() => {
    localStorage.setItem('persist', JSON.stringify(persist))
  }, [persist])

  return [persist, setPersist]
}
export default usePersist
