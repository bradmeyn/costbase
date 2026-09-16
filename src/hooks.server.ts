import { resolve as resolveRoute } from '$app/paths';
import { auth } from '#lib/server/auth.js'; // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/env';
import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	// If there is a session, attach it to locals
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	// Define protected routes
	const protectedRoutes = ['/portfolios'];

	// Check if current path is protected
	const isProtectedRoute = protectedRoutes.some((route) => event.url.pathname.startsWith(route));

	// Redirect to login if accessing protected route without auth
	if (isProtectedRoute && !event.locals.user) {
		redirect(303, resolveRoute('/(auth)/login'));
	}
	return svelteKitHandler({ event, resolve, auth, building });
}
