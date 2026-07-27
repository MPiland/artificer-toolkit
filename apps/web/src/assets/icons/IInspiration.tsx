const IInspiration = ({ className }: { className?: string }) => (
  <svg
    aria-hidden='true'
    className={className}
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M12 2.75 13.8 8.2 19.25 10 13.8 11.8 12 17.25 10.2 11.8 4.75 10 10.2 8.2 12 2.75Z'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinejoin='round'
    />
    <path d='m18.25 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z' fill='currentColor' />
  </svg>
)

export default IInspiration
