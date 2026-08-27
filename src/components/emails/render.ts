import { render } from '@react-email/components'
import { OTPVerificationEmail, ResetPasswordEmail, WelcomeEmail } from '@/components/emails/auth'
import {
  SolicitudDecisionEmail,
  SolicitudDmEmail,
  VenueInvitationEmail,
} from '@/components/emails/venues'

export type { EmailSubjectType } from './subjects'
export { getEmailSubject } from './subjects'

export async function renderOTPEmail(
  otp: string,
  email: string,
  type: 'sign-in' | 'email-verification' | 'forget-password' = 'email-verification'
): Promise<string> {
  return await render(OTPVerificationEmail({ otp, email, type }))
}

export async function renderPasswordResetEmail(
  username: string,
  resetLink: string
): Promise<string> {
  return await render(ResetPasswordEmail({ username, resetLink }))
}

export async function renderWelcomeEmail(userName?: string): Promise<string> {
  return await render(WelcomeEmail({ userName }))
}

export async function renderVenueInvitationEmail(params: {
  venueName: string
  role: 'owner' | 'staff'
  token: string
}): Promise<string> {
  return await render(VenueInvitationEmail(params))
}

export async function renderSolicitudDmEmail(params: {
  venueName: string
  instagram: string
  contactEmail: string
}): Promise<string> {
  return await render(SolicitudDmEmail(params))
}

export async function renderSolicitudDecisionEmail(params: {
  venueName: string
  aprobada: boolean
  nota?: string
}): Promise<string> {
  return await render(SolicitudDecisionEmail(params))
}
