import { z } from 'zod';

export const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.regex(/\d/, 'Password must include at least one numeric character')
		.regex(/[A-Z]/, 'Password must include at least one uppercase letter')
		.regex(/[a-z]/, 'Password must include at least one lowercase letter')
		.regex(/[@$!%*?&]/, 'Password must include at least one special character')
});

export const registerSchema = z
	.object({
		firstName: z.string().min(2, 'First name must be at least 2 characters'),
		lastName: z.string().min(2, 'Last name must be at least 2 characters'),
		...loginSchema.shape,
		confirmPassword: z.string()
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ['confirmPassword']
	});

export const emailConfirmedSearchSchema = z.object({
	access_token: z.string().optional(),
	refresh_token: z.string().optional(),
	status: z.string().optional(),
	autoLogin: z.string().optional()
});

export const emailConfirmationSearchSchema = z.object({
	status: z.string().optional(),
	error: z.string().optional()
});

export type LoginCredentials = z.infer<typeof loginSchema>;
export type RegisterCredentials = z.infer<typeof registerSchema>;
