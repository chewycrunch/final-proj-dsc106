<!--  File: src/routes/+page.svelte  -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';
	import HeroCounter from '$lib/HeroCounter.svelte';

	/* ---------- visual sections (they each do their own processing) ---------- */
	import AgeDistribution from '$lib/AgeDistribution.svelte';
	import DepartmentDistribution from '$lib/DepartmentDistribution.svelte';
	import AggregatedTimeline from '$lib/AggregatedTimeline.svelte';
	import AlbuminScatter from '$lib/AlbuminRiskScatter.svelte';
	import RiskRadar from '$lib/RiskRadar.svelte';
	import BuildPatient from '$lib/BuildPatient.svelte';
	import RiskDumbbell from '$lib/RiskDumbbell.svelte';
	import AlbuminRiskScatter from '$lib/AlbuminRiskScatter.svelte';

	/* ---------- dataset ---------- */
	let cases: SurgeryCase[] = [];
	let filteredCases: SurgeryCase[] = [];
	let filteredDepartment: string | null = null;
	let filteredAgeRange: [number, number] | null = null;
	let showPercentage = false; // Shared state for both charts
	let loading = true;

	/** helper - cast numeric-looking strings to Number, leave others as string */
	function coerce(v: string | undefined): string | number {
		if (v == null || v.trim() === '') return '';
		return /^[+\-]?\d+(\.\d+)?$/.test(v) ? +v : v;
	}

	onMount(async () => {
		const url = `${base}/cases.csv`;
		cases = await csv<SurgeryCase>(url, (row) => {
			// iterate over every header present in the CSV row
			const rec: any = {};
			for (const k in row) rec[k] = coerce(row[k]);
			// Ensure department is always present as a string (fallback to empty string if missing)
			rec.department = typeof rec.department === 'string' ? rec.department : '';
			return rec as SurgeryCase; // keep full schema; components will pick what they need
		});
		
		// Initialize filtered cases with all cases
		filteredCases = [...cases];
		loading = false;
	});

	/* sliders for Build-Your-Own-Patient (passed unchanged to component) */
	let predictors = { age: 60, bmi: 25, asa: 2, emergency: 0 };
</script>

{#if loading}
	<p class="py-16 text-center text-lg">Loading VitalDB dataset …</p>
{:else}
	<article class="prose mx-auto space-y-20 py-10">
		<!-- 1 · Hook ------------------------------------------------------------------ -->
		<section class="space-y-6 text-center">
			<h1 class="text-4xl leading-tight font-semibold md:text-5xl">
				Vitals&nbsp;Unveiled:<br />
				<span class="text-indigo-600">Why Some "Routine" Surgeries Aren't</span>
			</h1>

			<p class="mx-auto max-w-2xl text-lg md:text-xl">
				Every morning an OR schedule hums like clockwork. <strong>6 388</strong> patients arrive,
				expecting a smooth ride through anesthesia and stitched-up certainty. Yet buried in those
				charts are <em>blood-loss spikes, surprise ICU transfers, and silent tragedies</em> that no checklist
				predicted. What separates the happy recoveries from the heart-stopping detours?
			</p>

			<p class="mx-auto max-w-2xl text-lg md:text-xl">
				Scroll on 👇 as we crack open the VitalDB dataset to follow every heartbeat, incision, and
				lab value—then build <strong>interactive risk profiles</strong> that may one day warn us before
				routine turns to critical.
			</p>

			<!-- hero counter ---------------------------------------------------------- -->
			<HeroCounter
				stats={[
					{ label: 'Total Surgeries', value: cases.length },
					{ label: 'ICU Transfers', value: cases.filter((c) => (c.icu_days ?? 0) > 0).length },
					{ label: 'In-hospital Deaths', value: cases.filter((c) => c.death_inhosp == 1).length }
				]}
			/>
		</section>

		<!-- 2 · Demographics ----------------------------------------------------------- -->
		<section>
			<h2>Who Steps Into the OR?</h2>
			<p class="mb-4 max-w-xl">
				Let's start by meeting our patients. The charts below reveal a striking pattern: while our
				patients span six decades,
				<strong>70% cluster in just two surgical departments</strong>. This concentration—combined
				with age and sex differences—creates wildly different baseline risks before the first
				incision. Click any department bar to filter the dashboard and see how demographics shift
				across specialties.
			</p>
			<div class="grid gap-8 md:grid-cols-2">
				<AgeDistribution {cases} />
				<DepartmentDistribution {cases} />
			</div>
		</section>

		<!-- 3 · OR Phase Timeline ------------------------------------------------------ -->
		<section>
			<h2 class="text-center text-3xl font-bold mb-1 pb-4">Time on the Table</h2>
			<p class="mb-4 text-center max-w-5xl mx-auto">
				Each dot marks a key moment in surgery. The visualization shows <strong>mean, min, and max durations</strong> across our 6,388 cases. 
				Try the filters above—switch between department and surgery type to see how <strong>different procedures have their own rhythm</strong>. 
				For instance, breast surgeries average just <strong>34 minutes</strong> from anesthesia to incision, while transplantations take nearly twice as long, <strong>at 70 minutes</strong>. 
				This pre-incision time matters, as longer anesthesia exposure before surgery increases risk of complications. If you're facing surgery, 
				use these filters to see typical timing patterns for your procedure—knowledge that can help you understand and prepare for your own surgical journey. 
				Hover over dots for exact timing stats.
			</p>
			<AggregatedTimeline {cases} />
		</section>

		<!-- 4 · Albumin vs ICU Scatter ------------------------------------------------- -->
		<section>
			<h2>Low Albumin ↔ Long ICU Stay?</h2>
			<AlbuminScatter {cases} />
		</section>

		<!-- 5 · High- vs Low-Risk Outcomes -------------------------------------------- -->
		<section>
			<h2>High-Risk vs Low-Risk Profiles</h2>
			<RiskRadar {cases} />
		</section>

		<!-- 6 · Build Your Own Patient ------------------------------------------------- -->
		<section>
			<h2>Interactive Risk Builder</h2>
			<BuildPatient {cases} bind:predictors />
		</section>

		<!-- 7 · Final Takeaway -------------------------------------------------------- -->
		<section class="text-center">
			<div class="mx-auto max-w-2xl rounded-lg bg-indigo-50 p-8">
				<h2 class="mb-4 text-2xl font-semibold text-indigo-900">The Takeaway</h2>
				<p class="text-lg text-indigo-800">
					The data reveals three critical insights: First, pre-op albumin levels—easily measured and
					often correctable—strongly predict ICU stays. Second, emergency status and ASA score
					interact in ways that standard checklists miss. And third, while we can't change age, we
					can optimize timing, prepare blood products, and adjust recovery expectations based on
					these risk factors. The data tells us where to look—before the knife ever touches skin.
				</p>
			</div>
		</section>
	</article>
{/if}

<style>
	:global(svg) {
		max-width: 100%;
	}
</style>
