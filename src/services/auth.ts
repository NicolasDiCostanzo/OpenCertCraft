import { Amplify } from 'aws-amplify'
import { resendSignUpCode as amplifyResendSignUpCode, signIn as amplifySignIn, confirmResetPassword, fetchUserAttributes, getCurrentUser, resetPassword } from 'aws-amplify/auth';
import type { AuthUser } from '../types';

export async function signUp(email: string, password: string): Promise<boolean> {
  const { signUp: amplifySignUp } = await import('aws-amplify/auth')
  const { isSignUpComplete } = await amplifySignUp({
    username: email,
    password,
    options: { userAttributes: { email } },
  })
  return !isSignUpComplete
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  const { confirmSignUp: amplifyConfirmSignUp } = await import('aws-amplify/auth')
  await amplifyConfirmSignUp({ username: email, confirmationCode: code })
}

export async function resendSignUpCode(email: string): Promise<void> {
  await amplifyResendSignUpCode({ username: email })
}

export async function requestPasswordReset(email: string): Promise<void> {
  await resetPassword({ username: email })
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { isSignedIn, nextStep } = await amplifySignIn({ username: email, password })
  if (!isSignedIn) {
    const error = new Error('sign-in did not complete')
    if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') error.name = 'UserNotConfirmedException'
    throw error
  }
  const { userId } = await getCurrentUser()
  return { userId, email: await readEmail() }
}

export async function configureAuth(userPoolId: string, userPoolClientId: string): Promise<boolean> {
  try {
    Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } })
    return true
  } catch {
    return false
  }
}

export async function restoreSession(): Promise<AuthUser | null> {
  let userId: string
  try {
    ;({ userId } = await getCurrentUser())
  } catch {
    return null
  }
  return { userId, email: await readEmail() }
}

async function readEmail(): Promise<string | null> {
  try {
    const attributes = await fetchUserAttributes()
    return attributes.email ?? null
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  const { signOut: amplifySignOut } = await import('aws-amplify/auth')
  await amplifySignOut()
}