import { z } from 'zod'

/**
 * Schemas for the account forms, in one place.
 *
 * EACH FORM USED TO CARRY ITS OWN COPY, and they had already diverged: the
 * login defined a `PASSWORD_VALIDATIONS` with "required" and "notEmpty", and
 * the register form defined a different `PASSWORD_VALIDATIONS` with
 * "minLength". Two objects, same name, two files, checking different things
 * about the same field. That is how you end up demanding more to recover a
 * password than to create one.
 *
 * Validated with zod and consumed by react-hook-form through its resolver,
 * instead of the tangle of per-field `useState`, error arrays and
 * "show validation error" flags that was here before. It is not only less
 * code: it removes the gap where the value being validated and the value being
 * submitted could differ.
 *
 * THIS DOES NOT REPLACE SERVER VALIDATION. It is the browser-side pass, so
 * people know what to fix before sending. Better-Auth checks everything again
 * on the other side, which is where it actually matters.
 *
 * Messages are Spanish because a user reads them. Everything else is English.
 */

/** Better-Auth's minimum. It was written down only in the register form. */
export const MIN_PASSWORD_LENGTH = 8

const email = z
  .string()
  .trim()
  .min(1, 'Escribe tu correo.')
  .email('Ese correo no se ve bien.')
  // Email is stored and compared lowercased. Normalising here — rather than in
  // every `onSubmit` — is what stops "Mesero@..." and "mesero@..." from being
  // treated as two different accounts.
  .transform((value) => value.toLowerCase())

export const loginSchema = z.object({
  email,
  // Signing IN does not enforce a minimum length: the password already exists,
  // and imposing new rules on someone who created theirs under the old ones
  // only locks them out. The single rule is that it is not empty.
  password: z.string().min(1, 'Escribe tu contraseña.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Escribe tu nombre.').max(80),
  email,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const emailOnlySchema = z.object({ email })
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      ),
    confirmPassword: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las dos contraseñas no coinciden.',
    path: ['confirmPassword'],
  })
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
