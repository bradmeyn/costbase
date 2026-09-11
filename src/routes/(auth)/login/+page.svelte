<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { loginUser } from '$lib/remotes/auth.remote';
</script>

<svelte:head>
	<title>Log in — MoneyKit</title>
</svelte:head>

<div class="w-full max-w-sm">
	<div>
		<div class="mb-6 text-center">
			<h1 class="heading-primary">Welcome back</h1>
		</div>

		{#if loginUser.result?.success === false}
			<div class="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
				Invalid email or password.
			</div>
		{/if}

		<form {...loginUser} class="space-y-4">
			<Field.Field>
				<Field.Label for="email">Email</Field.Label>
				<Input
					{...loginUser.fields.email.as('email')}
					id="email"
					autocomplete="email"
					placeholder="you@example.com"
				/>
				<Field.Error />
			</Field.Field>

			<Field.Field>
				<Field.Label for="password">Password</Field.Label>
				<Input
					{...loginUser.fields.password.as('password')}
					id="password"
					type="password"
					autocomplete="current-password"
					placeholder="••••••••"
				/>
				<Field.Error />
			</Field.Field>

			<Button type="submit" class="w-full" disabled={!!loginUser.pending}>
				{loginUser.pending ? 'Logging in…' : 'Log in'}
			</Button>
		</form>
	</div>

	<p class="mt-4 text-center text-sm text-muted-foreground">
		No account?
		<a href="/register" class="font-medium text-primary hover:underline">Sign up</a>
	</p>
</div>
