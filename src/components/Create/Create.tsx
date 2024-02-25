import { useState } from 'react'
import Modal from '../Modal/Modal'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

const Create = ({}) => {
  const { context } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      <Modal.Header title={`Create ${location.state.context}`}></Modal.Header>
    </>
  )
}

export default Create
