<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	interface Props {
		stats: { label: string; value: number }[];
		duration?: number;
	}

	/** items to display in sequence */
	/** how long (ms) each number animates */
	let { stats, duration = 1200 }: Props = $props();

	// one tween per stat
	const tweens = $derived(stats.map(() => tweened(0, { duration, easing: cubicOut })));

	onMount(() => {
		console.log(stats, duration);
		// animate sequentially
		let delay = 0;
		stats.forEach((s, i) => {
			setTimeout(() => tweens[i].set(s.value), delay);
			delay += duration + 400; // small pause between numbers
		});
	});

	const fmt = new Intl.NumberFormat();
</script>

<div class="mt-6 flex flex-wrap justify-center gap-8">
	{#each stats as { label }, i}
		<div class="text-center">
			<h2 class="text-4xl font-extrabold tracking-tight tabular-nums">
				{stats[i].value}
				<!-- {fmt.format(Math.round(tweens[i]))} -->
			</h2>
			<p class="text-sm tracking-wide text-gray-600 uppercase">{label}</p>
		</div>
	{/each}
</div>

<style>
	h2 {
		font-variant-numeric: tabular-nums;
	}
</style>
