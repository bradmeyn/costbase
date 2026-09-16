import { resolve } from '$app/paths';
import { form, getRequestEvent, query } from '$app/server';
import { registerSchema, loginSchema } from '#lib/schemas/auth.js';
import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.js';

export const registerUser = form(
	registerSchema,
	async ({ firstName, lastName, email, password }) => {
		const event = getRequestEvent();

		const result = await auth.api.signUpEmail({
			headers: event.request.headers,
			body: { email, password, firstName, lastName, name: `${firstName} ${lastName}` }
		});

		if (!result.user) {
			return {
				success: false,
				message: 'Registration failed'
			};
		}

		redirect(302, resolve('/(dashboard)/portfolios'));
	}
);

export const loginUser = form(loginSchema, async ({ email, password }) => {
	const event = getRequestEvent();

	const result = await auth.api.signInEmail({
		headers: event.request.headers,
		body: { email, password }
	});

	if (!result.user) {
		return {
			success: false,
			message: 'Login failed'
		};
	}

	redirect(302, resolve('/(dashboard)/portfolios'));
});

export const logoutUser = form(async () => {
	const event = getRequestEvent();

	await auth.api.signOut({
		headers: event.request.headers
	});

	redirect(302, resolve('/(calculators)'));
});

export const getCurrentUser = query(async () => {
	const { locals } = getRequestEvent();
	return locals.user;
});
