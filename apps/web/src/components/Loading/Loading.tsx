import { useState, useEffect, use } from 'react'
import Modal from '@components/Modal'
import Spinner from '@components/Spinner'
import { loading_message, loading_wrapper } from './Loading.css'
import { ModalContext } from '@components/Modal'

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
  const { setWithCloseButton } = use(ModalContext)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, 2000) // Change message every 2 seconds

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setWithCloseButton(false)
  }, [setWithCloseButton])

  return (
    <Modal>
      <div className={loading_wrapper}>
        <Spinner />
        <div className={loading_message}>{loadingMessages[messageIndex]}</div>
      </div>
    </Modal>
  )
}

export default Loading
