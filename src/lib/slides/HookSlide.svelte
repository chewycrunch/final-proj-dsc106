<script lang="ts">
	import HeroCounter from '$lib/HeroCounter.svelte';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();
</script>

<div class="slide-container">
	<div class="content">
		<h1 class="title">
			Vitals&nbsp;Unveiled:<br />
			<span class="text-text-accent">When "Routine" Surgeries Take Unexpected Turns</span>
		</h1>

		<p class="description">
			Imagine an operating room humming along in perfect rhythm, dozens of cases lined up, each one
			expected to end smoothly. Yet among those <strong>6 388</strong> surgeries lie stories of sudden
			blood-loss emergencies, unplanned ICU detours, and the quiet heartbreak of lives forever changed.
		</p>

		<p class="description">
			Today, we invite you on a journey through Seoul National University's VitalDB. We'll follow
			every heartbeat, incision, and lab result in search of the subtle signs that tip a "routine"
			case into crisis.
		</p>

		<p class="description">
			Scroll down to meet our patients, feel the pulse of the OR phases, test your own predictions,
			and discover the hidden signals that could one day warn us, before the routine becomes critical.
		</p>

		<HeroCounter
			stats={[
				{ label: 'Total Surgeries', value: cases.length },
				{ label: 'ICU Transfers', value: cases.filter((c) => (c.icu_days ?? 0) > 0).length },
				{ label: 'In-Hospital Deaths', value: cases.filter((c) => c.death_inhosp === 1).length }
			]}
		/>
	</div>
</div>

<style>
	.slide-container {
		height: 100vh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 15vh 4vw 4vh 4vw;
		box-sizing: border-box;
	}

	.content {
		max-width: 90ch;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: clamp(1.5rem, 3vh, 2.5rem);
		margin-top: 5vh;
	}

	.title {
		font-size: clamp(2rem, 5vh, 3.5rem);
		line-height: 1.2;
		font-weight: 600;
		text-align: center;
	}

	.description {
		font-size: clamp(1rem, 2vh, 1.25rem);
		line-height: 1.6;
		text-align: center;
		margin: 0;
	}

	/* Make sure the counter component scales appropriately */
	:global(.hero-counter) {
		margin-top: clamp(1rem, 2vh, 2rem);
	}

	:global(.hero-counter .stat) {
		font-size: clamp(1.5rem, 3vh, 2.5rem);
	}

	:global(.hero-counter .label) {
		font-size: clamp(0.875rem, 1.5vh, 1rem);
	}
</style>
