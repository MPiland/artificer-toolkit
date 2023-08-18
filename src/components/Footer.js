const Footer = () => {
  const date = new Date().getFullYear()

  return (
    <footer className='main-footer'>
      Copyright © {date}
    </footer>
  )
}
export default Footer
