import { useState, useEffect } from 'react'

const usePersist = (): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>
] => {
  const jsonPersist = localStorage.getItem('persist')
  const [persist, setPersist] = useState<boolean>(
    jsonPersist ? JSON.parse(jsonPersist) : false
  )

  useEffect(() => {
    localStorage.setItem('persist', JSON.stringify(persist))
  }, [persist])

  return [persist, setPersist]
}

export default usePersist
