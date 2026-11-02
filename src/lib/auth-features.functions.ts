import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { getAuth } from './auth.server'

// Public capability DTO only. Never serialize auth options, bindings or credentials.
export const getAuthFeatures = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store')
  const auth = getAuth()
  return {
    google: Boolean(auth?.options.socialProviders?.google),
    passwordReset: Boolean(auth?.options.emailAndPassword?.sendResetPassword),
  }
})
