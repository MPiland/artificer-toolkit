const Footer = () => {
  const date = new Date().getFullYear()

  return <footer className="main-footer fixed-bottom">Copyright © {date}</footer>
}
export default Footer
