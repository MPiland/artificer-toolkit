const IClass = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M19 3L22 2L21 5L9.5 16.5C8.5 16 8 15.5 7.5 14.5L19 3Z' fill='currentColor' />
      <path
        d='M4.5 14.5L6 13C7 16 9 17 11 18L9.5 19.5L6.5 18.5C6.5 18.5 4 20.5 4 22L2.5 21.5L2 20C3.5 20 5.5 17.5 5.5 17.5L4.5 14.5Z'
        fill='currentColor'
      />
      <path d='M5.5 5.5H7L11 9.5L9.5 11L5.5 7V5.5Z' fill='currentColor' />
      <path
        d='M14.5 18C14.0634 17.5634 15 16.5 15 16.5L13 14.5L14.5 13L16.5 15C16.5 15 17.5634 14.0634 18 14.5C18.4366 14.9366 17.5 16 17.5 16C17.5 16 21 18.5 21.5 20C21.6852 20.5557 21.8355 21.1645 21.5 21.5C21.1645 21.8355 20.5557 21.6852 20 21.5C18.5 21 16 17.5 16 17.5C16 17.5 14.9366 18.4366 14.5 18Z'
        fill='currentColor'
      />
      <path d='M3 4.5H4.5V3L2 2L3 4.5Z' fill='currentColor' />
      <path d='M5.5 3V4.5H7L8 2L5.5 3Z' fill='currentColor' />
      <path d='M3 5.5H4.5V7L2 8L3 5.5Z' fill='currentColor' />
    </svg>
  )
}

export default IClass
