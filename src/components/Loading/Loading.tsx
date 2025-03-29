import { useState, useEffect, use } from 'react'
import Modal from '../Modal/Modal'
import Spinner from '../Spinner/Spinner'
import { loading_message, loading_wrapper } from './Loading.css'
import { LoadingContext } from './LoadingContext'

const loadingMessages = [
  'Preparing your adventure...',
  'Rolling for initiative...',
  'Gathering your party...',
  'Consulting the ancient tomes...',
  'Sharpening weapons...',
  'Checking alignment...',
  'Casting divination...',
]

const Loading = () => {
  const [messageIndex, setMessageIndex] = useState(0)
  const { setIsLoading } = use(LoadingContext)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, 2000) // Change message every 2 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Modal onClose={() => setIsLoading(false)}>
      <Modal.Dialogue size='sm'>
        <Modal.Content>
          <div className={loading_wrapper}>
            <Spinner />
            <div className={loading_message}>{loadingMessages[messageIndex]}</div>
          </div>
        </Modal.Content>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Loading
