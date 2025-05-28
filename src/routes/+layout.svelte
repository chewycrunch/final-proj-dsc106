<script lang="ts">
	import '../app.css';
	import '../scroll.css';

	import Container from '$lib/Container.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Vitals Unveiled: Building Patient Profiles to Forecast Surgical Risk</title>
	<meta name="description" content="View your favorite basketball content." />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main>
	<Container class="space-y-16 py-8">
		{@render children()}
	</Container>
</main>
