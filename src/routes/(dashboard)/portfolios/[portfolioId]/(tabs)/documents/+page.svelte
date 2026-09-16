<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import { FileArchive, Paperclip } from '@lucide/svelte';
	import ReportPeriodSelect from '#lib/components/report-period-select.svelte';
	import ReportFilterMenu from '#lib/components/report-filter-menu.svelte';
	import { getPortfolioDocuments } from '#lib/remotes/documents.remote.js';
	import { getPortfolioFinancialYears } from '#lib/remotes/portfolio.remote.js';
	import { DOCUMENT_KINDS, kindLabel, type DocumentKind } from '#lib/documents-filter.js';
	import { describeWindow, readWindow } from '#lib/report-period.js';
	import { readList } from '#lib/report-query.js';

	const portfolioId = $derived(page.params.portfolioId!);
	const period = $derived(readWindow(page.url));
	const years = $derived(await getPortfolioFinancialYears(portfolioId));
	const all = $derived(await getPortfolioDocuments(portfolioId));

	const kinds = $derived(readList(page.url, 'kind'));
	const holdings = $derived(readList(page.url, 'holding'));

	/*
	  Filtered here as well as on the server: the list and the zip have to agree, and
	  the only way to be sure of that is for both to read the same query string.
	*/
	const documents = $derived(
		all.filter((d) => {
			if (period.from && d.asAt < period.from) return false;
			if (period.to && d.asAt > period.to) return false;
			if (kinds.length && !kinds.includes(d.kind)) return false;
			if (holdings.length && !holdings.includes(d.code)) return false;
			return true;
		})
	);

	const holdingOptions = $derived(
		[...new Set(all.map((d) => d.code))].sort().map((code) => ({ value: code, label: code }))
	);
	const kindOptions = DOCUMENT_KINDS.map((k) => ({ value: k.value, label: k.label }));

	const totalBytes = $derived(documents.reduce((sum, d) => sum + d.sizeBytes, 0));
	const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

	/* The zip is the same selection, so it carries the same query the page is showing. */
	const zipHref = $derived(`${page.url.pathname.replace(/\/$/, '')}/export${page.url.search}`);

	const formatDate = (iso: string) => {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	};
</script>

<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
	<div class="min-w-0">
		<h1 class="text-2xl font-semibold tracking-tight">Documents</h1>
		<p class="mt-1 text-[13px] text-muted-foreground">
			{describeWindow(period)} · every contract note and statement filed against this portfolio
		</p>
	</div>
	<div class="flex items-center gap-2">
		<ReportPeriodSelect {years} />
		{#if holdingOptions.length > 1}
			<ReportFilterMenu
				param="holding"
				options={holdingOptions}
				allLabel="All holdings"
				noun="holdings"
			/>
		{/if}
		<ReportFilterMenu param="kind" options={kindOptions} allLabel="All types" noun="types" />
		<Button href={zipHref} disabled={documents.length === 0} download>
			<FileArchive class="size-4" />
			Download zip
		</Button>
	</div>
</div>

{#if documents.length === 0}
	<div class="card py-8 text-center">
		<p class="text-[13px] text-muted-foreground">
			{all.length > 0 ? 'No documents match these filters.' : 'No documents filed yet.'}
		</p>
		<p class="mt-1 text-[11px] text-muted-foreground">
			Documents are attached when you import a contract note or statement.
		</p>
	</div>
{:else}
	<p class="mb-3 text-[13px] text-muted-foreground">
		{documents.length}
		{documents.length === 1 ? 'document' : 'documents'} · {megabytes(totalBytes)} · zipped into folders
		by holding and type
	</p>

	<div class="card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Holding</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head>File</Table.Head>
					<Table.Head class="text-right">Size</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each documents as document (document.id)}
					<Table.Row>
						<Table.Cell class="whitespace-nowrap">
							{formatDate(document.dated)}
						</Table.Cell>
						<Table.Cell class="font-medium">{document.code}</Table.Cell>
						<Table.Cell class="text-muted-foreground">
							{kindLabel(document.kind as DocumentKind)}
						</Table.Cell>
						<Table.Cell>
							<a
								href="/documents/{document.id}"
								target="_blank"
								rel="noopener"
								class="inline-flex items-center gap-1.5 text-primary hover:text-primary/80"
							>
								<Paperclip class="size-3.5 shrink-0" />
								<span class="font-mono text-[12px]">{document.name}</span>
							</a>
						</Table.Cell>
						<Table.Cell class="text-right text-muted-foreground tabular-nums">
							{Math.round(document.sizeBytes / 1024)} KB
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{/if}
