import { useState, useEffect } from 'react'

const useSystemPref = (): [string, React.Dispatch<React.SetStateAction<string>>] => {
  const storedSystem = localStorage.getItem('selectedSystem')
  const [systemPref, setSystemPref] = useState<string>(storedSystem || '')

  useEffect(() => {
    localStorage.setItem('selectedSystem', systemPref)
  }, [systemPref])

  return [systemPref, setSystemPref]
}

export default useSystemPref
