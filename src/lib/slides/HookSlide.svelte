<script lang="ts">
	import HeroCounter from '$lib/HeroCounter.svelte';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();
</script>

<div class="space-y-6 text-center">
	<h1 class="text-4xl leading-tight font-semibold md:text-5xl">
		Vitals&nbsp;Unveiled:<br />
		<span class="text-indigo-600">When “Routine” Surgeries Take Unexpected Turns</span>
	</h1>

	<p class="mx-auto max-w-2xl text-lg md:text-xl">
		Imagine an operating room humming along in perfect rhythm—dozens of cases lined up, each one
		expected to end smoothly. Yet among those <strong>6 388</strong> surgeries lie stories of sudden
		blood-loss emergencies, unplanned ICU detours, and the quiet heartbreak of lives forever changed.
	</p>

	<p class="mx-auto max-w-2xl text-lg md:text-xl">
		Today, we invite you on a journey through Seoul National University’s VitalDB. We’ll follow
		every heartbeat, incision, and lab result in search of the subtle signs that tip a “routine”
		case into crisis.
	</p>

	<p class="mx-auto max-w-2xl text-lg md:text-xl">
		Scroll down to meet our patients, feel the pulse of the OR phases, test your own predictions,
		and discover the hidden signals that could one day warn us—before the routine becomes critical.
	</p>

	<HeroCounter
		stats={[
			{ label: 'Total Surgeries', value: cases.length },
			{ label: 'ICU Transfers', value: cases.filter((c) => (c.icu_days ?? 0) > 0).length },
			{ label: 'In-Hospital Deaths', value: cases.filter((c) => c.death_inhosp === 1).length }
		]}
	/>
</div>
