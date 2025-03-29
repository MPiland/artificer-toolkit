import { Link } from '@tanstack/react-router'

const ErrorPage = () => {
  return (
    <div id='error-page'>
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <div>
        <Link to='/'>Go back to Home</Link>
      </div>
    </div>
  )
}
export default ErrorPage
