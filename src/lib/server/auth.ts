import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$db';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { BETTER_AUTH_SECRET } from '$app/env/private';

export const auth = betterAuth({
	plugins: [sveltekitCookies(getRequestEvent)],
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'pg'
	}),
	emailAndPassword: {
		enabled: true
	},
	user: {
		additionalFields: {
			firstName: {
				type: 'string',
				required: true
			},
			lastName: {
				type: 'string',
				required: true
			}
		}
	}
});
