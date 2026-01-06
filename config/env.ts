import { z } from "zod";

const EnvSchema = z.object({
	// generic stuff
	NODE_ENV: z.string().default("development"),
	DATABASE_URL: z
		.url()
		.default("postgres://postgres@postgres:localhost:5432/shipfree"),

	// observability (optional)
	SENTRY_DSN: z.string().optional(),

	// cloudflare R2 Storage
	CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_BUCKET_URL: z.url().optional(),
	R2_STORAGE_BASE_URL: z.url().optional(),

	// email providers
	EMAIL_PROVIDER: z
		.enum(["resend", "postmark", "nodemailer", "plunk", "custom", "log"])
		.default("log"),

	// resend
	RESEND_API_KEY: z.string().optional(),
	RESEND_DOMAIN: z.string().optional(),

	// postmark
	POSTMARK_API_TOKEN: z.string().optional(),

	// plunk
	PLUNK_API_KEY: z.string().optional(),

	// nodemailer / SMTP
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.coerce.number().optional(),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	SMTP_SECURE: z.string().optional(), // "true" | "false"

	// email defaults
	DEFAULT_FROM_EMAIL: z.string().optional(),
	DEFAULT_FROM_NAME: z.string().optional(),

	// auth providers
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),

	// better-auth
	BETTER_AUTH_SECRET: z.string(),
	BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
});

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: unknown) {
	const { data: env, error, success } = EnvSchema.safeParse(data);

	if (!success) {
		console.error("Invalid environment variables:", error.format());
		process.exit(1);
	}

	return env;
}
