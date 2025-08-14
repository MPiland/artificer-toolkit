import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'

const usePersist = (): [boolean, Dispatch<SetStateAction<boolean>>] => {
  const jsonPersist = localStorage.getItem('cognito-persist')
  const [persist, setPersist] = useState<boolean>(jsonPersist ? JSON.parse(jsonPersist) : false)

  useEffect(() => {
    localStorage.setItem('cognito-persist', JSON.stringify(persist))
  }, [persist])

  return [persist, setPersist]
}

export default usePersist
