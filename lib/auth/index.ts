import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/database";
import { isProd } from "@/lib/constants";
import { env } from "@/config/env-runtime";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),

	advanced: {
		cookiePrefix: "shipfree", // Change this to your cookie prefix
		crossSubDomainCookies: {
			enabled: !isProd,
			domain: ".shipfree.app", // Change this to your domain, if you are using a custom domain
		},
		useSecureCookies: !isProd,
	},

	session: {
		cookieCache: {
			enabled: true,
			maxAge: 24 * 60 * 60, // 24 hours in seconds
		},
		expiresIn: 30 * 24 * 60 * 60, // 30 days (how long a session can last overall)
		updateAge: 24 * 60 * 60, // 24 hours (how often to refresh the expiry)
		freshAge: 60 * 60, // 1 hour (or set to 0 to disable completely)
	},

	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			scopes: [
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			],
		},
	},
});
