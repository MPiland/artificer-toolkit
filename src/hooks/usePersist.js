import { useState, useEffect } from 'react'

const usePersist = () => {
  const [persist, setPersist] = useState(
    JSON.parse(localStorage.getItem('persist'))
  )

  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(async (persistent) => {
        if (persistent) {
          console.log(
            'Storage will not be cleared except by explicit user action'
          )
        } else {
          const isPersisted = await navigator.storage.persist()
          console.log(`Persisted storage granted: ${isPersisted}`)
        }
      })
    }

    localStorage.setItem('persist', JSON.stringify(persist))
  }, [persist])

  return [persist, setPersist]
}
export default usePersist
