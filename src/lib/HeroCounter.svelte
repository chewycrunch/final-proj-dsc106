<!-- src/lib/HeroCounter.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	/* ------------------------------------------------------------ props */
	interface Stat {
		label: string;
		value: number;
	}
	interface Props {
		stats: Stat[];
		duration?: number;
	}

	let { stats, duration = 1200 }: Props = $props();

	/* ------------------------------------------------------- tween stores */
	/* one tweened store per item so they animate independently           */
	const tweens = $derived(stats.map(() => tweened(0, { duration, easing: cubicOut })));

	/* -------------------------------------------------- kick off counts  */
	onMount(() => {
		let delay = 0;
		stats.forEach(({ value }, idx) => {
			setTimeout(() => tweens[idx].set(value), delay);
			delay += duration + 400; // small pause between each counter
		});
	});

	const fmt = new Intl.NumberFormat(); // nice thousands-separator
</script>

<div class="mt-6 flex flex-wrap justify-center gap-8">
	{#each stats as { label }, i}
		<div class="text-center">
			<h2 class="text-4xl font-extrabold tracking-tight tabular-nums">
				{stats[i].value}
				<!-- {fmt.format(Math.round(tweens[i]))} -->
				<!-- <- 🔑 unwrap store -->
			</h2>
			<p class="text-xs tracking-wide text-gray-500 uppercase">
				{label}
			</p>
		</div>
	{/each}
</div>

<style>
	h2 {
		font-variant-numeric: tabular-nums;
	}
</style>
