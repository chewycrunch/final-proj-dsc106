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
	import AlbuminScatter from '$lib/AlbuminScatter.svelte';
	import RiskRadar from '$lib/RiskRadar.svelte';
	import BuildPatient from '$lib/BuildPatient.svelte';
	import RiskDumbbell from '$lib/RiskDumbbell.svelte';

	/* ---------- dataset ---------- */
	let cases: SurgeryCase[] = [];
	let loading = true;
	let filteredCases: SurgeryCase[] = [];
	let filteredDepartment: string | null = null;

	// Function to handle filtering by department
	function handleDepartmentFilter(event: CustomEvent) {
		const { department } = event.detail;
		filteredDepartment = department;

		if (department) {
			filteredCases = cases.filter((c) => c.department === department);
		} else {
			filteredCases = [...cases];
		}
	}

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
			return rec as SurgeryCase; // keep full schema; components will pick what they need
		});

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
				<span class="text-indigo-600">Why Some “Routine” Surgeries Aren’t</span>
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
			<div class="grid gap-8 md:grid-cols-2">
				<AgeDistribution data={filteredDepartment ? filteredCases : cases} />
				<DepartmentDistribution
					data={cases}
					{filteredDepartment}
					on:filter={handleDepartmentFilter}
				/>
			</div>
		</section>

		<!-- 3 · OR Phase Timeline ------------------------------------------------------ -->
		<section>
			<h2>Time on the Table</h2>
			<p class="mb-4">
				Compare anaesthesia, incision, and recovery time across departments or surgery types.
			</p>
			<AggregatedTimeline {cases} />
		</section>

		<!-- 4 · Albumin vs ICU Scatter ------------------------------------------------- -->
		<section>
			<h2>Hidden Risk Factors — Albumin × Age</h2>
			<p class="mb-4 max-w-xl">
				Albumin hints at nutritional reserve. In the scatter below, colour encodes ICU days and ▲
				marks emergency cases. Switch between a robust
				<strong>median-bin trend</strong> and a smooth <strong>LOESS curve</strong>. Hover the
				pale-purple dots under 3 g/dL — these patients linger nearly
				<strong>three days longer</strong> in ICU.
			</p>

			<AlbuminScatter patients={cases} />
		</section>

		<!-- 5 · High- vs Low-Risk Outcomes -------------------------------------------- -->
		<!-- <section class="my-16">
			<h2 class="mb-4 text-2xl font-semibold">The Big Contrast — High-Risk vs Low-Risk Patients</h2>
			<p class="mb-4 max-w-xl">
				The chart compares median outcomes for the sickest&nbsp;0.5 % of cases against the
				healthiest&nbsp;10 % of survivors. One polygon balloons, the other hugs the centre — showing
				how two patients in the same operating room can face radically different fates.
			</p>

			<RiskRadar patients={cases} />
		</section> -->
		<section>
			<h2 class="mb-4 text-2xl font-semibold">The Big Contrast — High vs Routine Elective</h2>
			<p class="mb-6 max-w-xl">
				From 6 388 surgeries we pull the sickest 0.5 % and the healthiest routine cases. Drag your
				eyes across the lines: blood loss rockets, ICU days triple, and mortality—not shown in the
				booking sheet—lurks behind that red dot. Hover any circle for the raw median.
			</p>

			<RiskDumbbell patients={cases} />
		</section>

		<!-- 6 · Build Your Own Patient ------------------------------------------------- -->
		<section>
			<h2>Interactive Risk Builder</h2>
			<BuildPatient {cases} bind:predictors />
		</section>
	</article>
{/if}

<style>
	:global(svg) {
		max-width: 100%;
	}
</style>
