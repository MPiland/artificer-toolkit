import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import { loading_message, loading_wrapper } from './Loading.css'

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

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, 2000) // Change message every 2 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Modal.Dialogue size='sm'>
      <Modal.Content>
        <div className={loading_wrapper}>
          <Spinner />
          <div className={loading_message}>{loadingMessages[messageIndex]}</div>
        </div>
      </Modal.Content>
    </Modal.Dialogue>
  )
}

export default Loading
