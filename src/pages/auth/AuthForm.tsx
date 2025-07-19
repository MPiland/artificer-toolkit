import {
	Alert,
	Button,
	Container,
	Divider,
	Group,
	Paper,
	Stack,
	Text,
	Title,
	Checkbox,
	TextInput,
	PasswordInput,
} from '@mantine/core'
import { useNavigate, useMatches, type ToOptions } from '@tanstack/react-router'
import Link from '@/components/Link'
import { auth_container, auth_link, auth_subtitle, auth_title, auth_wrapper, social_icon } from './Auth.css'
import { signUp, signIn } from '@/apis/auth.api'
import IGoogle from '@/assets/Icons/IGoogle'
import ITwitter from '@/assets/Icons/ITwitter'
import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { useForm } from '@tanstack/react-form'

const AUTH_SUCCESSES = {
	USER_NOT_CONFIRMED: 2,
} as const

const AuthForm = () => {
	const matches = useMatches()
	const routeMatch = matches[matches.length - 1]
	const registerPath = routeMatch.pathname === '/register/'
	const navigate = useNavigate()
	const [formMessage, setFormMessage] = useState<{ success: number; link: ToOptions['to'] } | null>(null)

	const isSignUpResponse = (
		response: { success: number; link: ToOptions['to'] } | { error: number; message: string }
	): response is { success: number; link: ToOptions['to'] } => {
		return !('error' in response)
	}

	const isSignInResponse = (
		response: { success: number; link: ToOptions['to'] } | { error: number; message: string }
	): response is { success: number; link: ToOptions['to'] } => {
		return !('error' in response)
	}

	const AuthSuccessHint = ({
		successCode,
		linkTo,
		email,
	}: {
		successCode?: number
		linkTo?: ToOptions['to']
		email: string
	}) => {
		switch (successCode) {
			case AUTH_SUCCESSES.USER_NOT_CONFIRMED: {
				let message: string = ''
				if (registerPath) {
					message = 'If an account with this email exists, a confirmation or login link will be sent.'
				} else {
					message = 'You must confirm your account before logging in.'
				}
				return (
					<Alert variant='light' color='blue' icon={<Info />}>
						<Text size='sm'>
							{`${message} `}
							<Link type='anchor' size='sm' to={linkTo} search={{ email }}>
								Confirm now
							</Link>
						</Text>
					</Alert>
				)
			}
		}
	}

	const form = useForm({
		defaultValues: {
			email: '',
			password: '',
			persist: false,
		},
		validators: {
			onSubmitAsync: async ({ value: { email, password, persist } }) => {
				if (registerPath) {
					const result = await signUp({ email, password, persist })
					if (isSignUpResponse(result)) {
						return setFormMessage(result)
					} else if (result.error === 2) {
						return setFormMessage({ success: 2, link: '/register/confirm' })
					} else {
						console.log('error', result)
						return {
							form: {
								error: result.error,
								message: result.message,
							},
						}
					}
				} else {
					const result = await signIn({ email, password, persist })
					if (isSignInResponse(result)) {
						if (result.success === 0) {
							return navigate({ to: '/home' })
						} else {
							return setFormMessage(result)
						}
					} else {
						return {
							form: {
								error: result.error,
								message: result.message,
							},
						}
					}
				}
			},
		},
	})

	const { handleSubmit, state, reset } = form

	useEffect(() => {
		reset()
	}, [registerPath, reset])

	return (
		<Container
			component='form'
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				handleSubmit()
			}}
			className={auth_container}
		>
			<Stack className={auth_wrapper}>
				<Title ta='center' className={auth_title}>
					Welcome {!registerPath ? 'back!' : 'to Artificer Toolkit!'}
				</Title>
				<Text className={auth_subtitle}>
					{!registerPath ?
						<>
							{"Don't have an account yet? "}
							<Link type='anchor' to={'/register'} className={auth_link}>
								Create account
							</Link>
						</>
					:	<>
							Already have an account?{' '}
							<Link type='anchor' to={'/login'} className={auth_link}>
								Login here
							</Link>
						</>
					}
				</Text>
				<Paper withBorder shadow='md' p={30} radius='md'>
					<Group grow mb='md' mt='md'>
						<Button classNames={{ section: social_icon }} variant='default' leftSection={<IGoogle />} radius='xl'>
							Google
						</Button>

						<Button classNames={{ section: social_icon }} variant='default' leftSection={<ITwitter />} radius='xl'>
							Twitter
						</Button>
					</Group>

					<Divider label='Or continue with email' labelPosition='center' my='lg' />
					<Stack>
						<form.Subscribe selector={(state) => [state.errorMap]}>
							{([errorMap]) => {
								let errorMessage = ''
								if (errorMap?.onSubmit?.form?.message) {
									errorMessage = errorMap.onSubmit.form.message
								} else if (errorMap.onSubmit && 'message' in errorMap.onSubmit) {
									errorMessage = errorMap.onSubmit.message as string
								}
								return (
									errorMessage && (
										<Alert variant='light' color='red' icon={<Info />}>
											{errorMessage}
										</Alert>
									)
								)
							}}
						</form.Subscribe>
						{formMessage && (
							<AuthSuccessHint successCode={formMessage.success} linkTo={formMessage.link} email={state.values.email} />
						)}
						<form.Field
							name='email'
							validators={{
								onBlur: ({ value }) =>
									value && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) ?
										null
									:	'Enter a valid email address.',
								onSubmit: ({ value }) => (!value || value === '') && 'Email is required',
							}}
						>
							{(field) => (
								<TextInput
									label='Email'
									placeholder='user@email.com'
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
									autoComplete='username'
								/>
							)}
						</form.Field>
						<form.Field
							name='password'
							validators={{
								onBlur: ({ value }) =>
									value &&
									(value.length <= 8 ? 'Password should include at least 8-20 characters'
									: /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/.test(value) ? null
									: 'Password should include at least one uppercase letter, one number and one special character'),
								onSubmit: ({ value }) => (!value || value === '') && 'Password is required',
							}}
						>
							{(field) => (
								<PasswordInput
									label='Password'
									placeholder='Password...'
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
								/>
							)}
						</form.Field>
						<Group justify='space-between'>
							<form.Field name='persist'>
								{(field) => (
									<Checkbox
										label='Remember me'
										checked={field.state.value}
										onChange={(e) => field.handleChange(e.target.checked)}
										onBlur={field.handleBlur}
									/>
								)}
							</form.Field>
							{!registerPath && (
								<Link type='anchor' size='sm' to='/reset-password'>
									Forgot password?
								</Link>
							)}
						</Group>
					</Stack>
					<Group justify='flex-end' mt='xl'>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button loading={isSubmitting} disabled={!canSubmit} radius='xl' type='submit'>
									{registerPath ? 'Register' : 'Login'}
								</Button>
							)}
						</form.Subscribe>
					</Group>
				</Paper>
			</Stack>
		</Container>
	)
}

export default AuthForm
