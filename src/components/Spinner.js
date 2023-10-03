import React from 'react'

const Spinner = () => {
  const content = (
    <div className='spinner-container'>
      <div className='spinner-border text-primary' role='status'>
        <span className='visually-hidden'>Loading...</span>
      </div>
    </div>
  )
  return content
}

export default Spinner
