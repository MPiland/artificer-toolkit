const Footer = () => {
  const date = new Date().getFullYear()

  return (
    <footer className='main-footer container-fluid flex-grow-0'>
      Copyright © {date}
    </footer>
  )
}
export default Footer
