<script lang="ts">
	import Button from '#lib/components/ui/button/button.svelte';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { registerUser } from '#lib/remotes/auth.remote.js';
	import { Circle, CircleCheck } from '@lucide/svelte';

	const password = $derived(registerUser.fields.password.value() ?? '');
	const confirmPassword = $derived(registerUser.fields.confirmPassword.value() ?? '');

	const requirements = $derived([
		{ label: 'At least 8 characters', met: password.length >= 8 },
		{ label: 'One uppercase letter', met: /[A-Z]/.test(password) },
		{ label: 'One lowercase letter', met: /[a-z]/.test(password) },
		{ label: 'One number', met: /\d/.test(password) },
		{ label: 'One special character', met: /[^A-Za-z0-9]/.test(password) }
	]);

	const metCount = $derived(requirements.filter((r) => r.met).length);
	const passwordsMatch = $derived(password.length > 0 && password === confirmPassword);
	const allValid = $derived(metCount === requirements.length && passwordsMatch);
</script>

{#snippet requirement(label: string, met: boolean)}
	<li
		class="flex items-center gap-2 text-xs transition-colors duration-200
		{met ? 'text-primary dark:text-primary' : 'text-muted-foreground'}"
	>
		{#if met}
			<CircleCheck class="size-3.5 shrink-0" />
		{:else}
			<Circle class="size-3.5 shrink-0 opacity-40" />
		{/if}
		<span>{label}</span>
	</li>
{/snippet}

<svelte:head>
	<title>Create account — Costbase</title>
</svelte:head>

<div class="w-full max-w-lg">
	<div>
		<div class="mb-6 text-center">
			<h1 class="heading-primary">Sign Up</h1>
		</div>

		{#if registerUser.result?.success === false}
			<div class="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
				Registration failed. Please try again.
			</div>
		{/if}

		<form {...registerUser} class="space-y-4">
			{#each registerUser.fields.issues() as issue, i (i)}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}

			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label for="firstName">First name</Field.Label>
					<Input
						{...registerUser.fields.firstName.as('text')}
						id="firstName"
						autocomplete="given-name"
						placeholder="Jane"
					/>
					<Field.Error errors={registerUser.fields.firstName.issues()} />
				</Field.Field>
				<Field.Field>
					<Field.Label for="lastName">Last name</Field.Label>
					<Input
						{...registerUser.fields.lastName.as('text')}
						id="lastName"
						autocomplete="family-name"
						placeholder="Smith"
					/>
					<Field.Error />
				</Field.Field>
			</div>

			<Field.Field>
				<Field.Label for="email">Email</Field.Label>
				<Input
					{...registerUser.fields.email.as('email')}
					id="email"
					type="email"
					autocomplete="email"
					placeholder="you@example.com"
				/>
				<Field.Error />
			</Field.Field>

			<Field.Field>
				<Field.Label for="password">Password</Field.Label>
				<Input
					{...registerUser.fields.password.as('password')}
					id="password"
					type="password"
					autocomplete="new-password"
					placeholder="••••••••"
				/>
				<Field.Error />
			</Field.Field>

			<Field.Field>
				<Field.Label for="confirmPassword">Confirm password</Field.Label>
				<Input
					{...registerUser.fields.confirmPassword.as('password')}
					id="confirmPassword"
					type="password"
					autocomplete="new-password"
					placeholder="••••••••"
				/>
				<Field.Error />
			</Field.Field>

			{#if password.length > 0}
				<div class="space-y-3 p-3">
					<!-- strength bar -->
					<div class="flex items-center gap-2">
						<span class="text-[11px] font-medium text-muted-foreground">
							Strength: {metCount <= 2 ? 'Weak' : metCount <= 4 ? 'Okay' : 'Strong'}
						</span>
					</div>

					<ul class="grid grid-cols-2 gap-x-3 gap-y-1.5">
						{#each requirements as req (req.label)}
							{@render requirement(req.label, req.met)}
						{/each}
						{@render requirement('Passwords match', passwordsMatch)}
					</ul>
				</div>
			{/if}

			<Button type="submit" class="w-full" disabled={!!registerUser.pending || !allValid}>
				{registerUser.pending ? 'Creating account…' : 'Create account'}
			</Button>
		</form>
	</div>

	<p class="mt-4 text-center text-sm text-muted-foreground">
		Already have an account?
		<a href="/login" class="font-medium text-primary hover:underline">Log in</a>
	</p>
</div>
