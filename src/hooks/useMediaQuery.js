import { useState, useEffect } from 'react'

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    let listener
    const mediaMatch = async () => {
      const media = window.matchMedia(query)
      if (media.matches !== matches) {
        setMatches(media.matches)
      }
      listener = () => setMatches(media.matches)
      window.addEventListener('resize', listener)
    }
    mediaMatch()
    return () => window.removeEventListener('resize', listener)
  }, [matches, query])

  return matches
}

export default useMediaQuery
