<!-- File: src/routes/+page.svelte -->
<script context="module" lang="ts">
	// Define the patient data type, exported for use in other components
	export interface SurgeryCase {
		caseid: string;
		age: number;
		department: string;
		casestart: number;
		anestart: number;
		opstart: number;
		opend: number;
		dis: number;
		los_icu: number;
		intraop_ebl: number;
		death_inhosp: number;
		bmi: number;
		asa: number;
		emergency: number; // Assuming this is a number (0 or 1) based on previous code
		optype: string;
		[key: string]: any; // Add index signature for groupBy access
	}

	interface Predictors {
		age: number;
		bmi: number;
		asa: number;
		emergency: number; // Assuming number based on previous interactions
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';

	import AgeDistribution from '$lib/AgeDistribution.svelte';
	import DepartmentDistribution from '$lib/DepartmentDistribution.svelte';
	// import Timeline from '../lib/Timeline.svelte'; // Removed old Timeline import
	import AggregatedTimeline from '$lib/AggregatedTimeline.svelte'; // Import AggregatedTimeline
	import Comparison from '$lib/Comparison.svelte';
	import BuildPatient from '$lib/BuildPatient.svelte';

	// interface SurgeryCase moved to script context="module"

	let cases: SurgeryCase[] = $state([]);

	let high: SurgeryCase | null = $state(null);
	let low: SurgeryCase | null = $state(null);

	// reactive predictors for BuildPatient
	// interface Predictors moved to script context="module"

	let predictors: Predictors = {
		age: 65,
		bmi: 28,
		asa: 3,
		emergency: 0
	};

	const num = (v: string | undefined) => (v === '' || v == null ? NaN : +v);

	const hasMetrics = (c: SurgeryCase) =>
		[c.icu_days, c.intraop_ebl, c.death_inhosp].every((v) => !isNaN(v) && v > 0);

	/* simple composite risk score: deaths dominate, then ICU days, then blood loss */
	const riskScore = (c: SurgeryCase) => c.death_inhosp * 100 + c.icu_days + c.intraop_ebl / 500;

	$effect(() => {
		if (cases.length) {
			// sort ascending → index 0 = safest
			const valid = cases.filter(hasMetrics).sort((a, b) => riskScore(a) - riskScore(b));

			/* safest-decile median vs worst single case */
			low = valid[Math.floor(valid.length * 0.1)] ?? null; // safest 10 %
			high = valid[valid.length - 1] ?? null; // worst
		}
	});

	onMount(async () => {
		const url = `${base}/cases.csv`;
		cases = await csv<SurgeryCase>(url, (row: Record<string, string>) => ({
			caseid: row.caseid!,
			age: +row.age!,
			department: row.department!,
			casestart: +row.casestart!,
			anestart: +row.anestart!,
			opstart: +row.opstart!,
			opend: +row.opend!,
			dis: +row.dis!,
			los_icu: +row.los_icu!,
			intraop_ebl: +row.intraop_ebl!,
			death_inhosp: +row.death_inhosp!,
			bmi: +row.bmi!,
			asa: +row.asa!,
			emergency: row.emop === '1' ? 1 : 0,
			optype: row.optype!
		}));

			// Parse ICU stay, defaulting to 0 if NaN
			const icu_days = row.icu_days ? Number(row.icu_days) : 0;
			if (isNaN(icu_days)) {
				console.warn('Invalid ICU stay value:', row.icu_days, 'defaulting to 0');
			}

			const obj: SurgeryCase = {
				caseid: row.caseid!,

				age: +row.age!,
				sex: (row.sex as 'M' | 'F') ?? 'M',
				bmi: +row.bmi!,

				department: row.department!,
				asa: +row.asa!,
				emergency: emergency,

				casestart: +row.casestart!,
				anestart: +row.anestart!,
				opstart: +row.opstart!,
				opend: +row.opend!,
				dis: +row.dis!,

				icu_days: icu_days,
				intraop_ebl: +row.intraop_ebl!,
				death_inhosp: +row.death_inhosp!,

				preop_htn: num(row.preop_htn), // hypertension 0 / 1
				preop_dm: num(row.preop_dm)
			};

			return obj;
		});

		/* ---------- helpers ---------- */

		/* after cases are loaded … */
		// $: if (cases.length) {
		// 	const valid = cases.filter(hasMetrics).sort((a, b) => riskScore(b) - riskScore(a));

		// 	/* highest-risk median vs safest-decile median */
		// 	high = valid[0] ?? null;
		// 	low = valid[Math.floor(valid.length * 0.1)] ?? null;
		// }
	});
</script>

<h1>Title here</h1>
<!-- Section 1: Demographics (visual on right) -->
<section>
	<h2>Explore Patient Demographics</h2>
	<div class="flex flex-col items-center gap-8 md:flex-row">
		<div class="space-y-4 md:w-1/2">
			<p>
				Before diving into outcomes, it's critical to understand who our patients are. Here we plot
				the age distribution of all surgical cases alongside a breakdown of procedure types by
				department. The age histogram reveals the full span of adult patients—ranging from young
				adults in their twenties to seniors in their eighties—highlighting that risk profiles may
				vary substantially across that range.
			</p>
			<p>
				The department bar chart then shows which specialties contribute most to our dataset.
				General surgery leads by volume, but thoracic and urologic procedures also form significant
				cohorts. By surfacing these basic patterns, we equip viewers with the demographic and
				procedural context needed to interpret subsequent analyses of risk and outcomes.
			</p>
		</div>
		<div class="space-y-8 md:w-1/2">
			<AgeDistribution data={cases} />
			<DepartmentDistribution data={cases} />
		</div>
	</div>
</section>

<!-- Section 2: Timeline (visual on left, with selector) -->
<section class="timeline-section">
	<h2>Timeline of a <span class="highlight-orange">Surgical Journey</span></h2>
	<p class="mb-8">
		Explore the average timeline of surgical procedures. Filter by surgery type, department, or age range to see how different patient groups progress through their surgical journey. The timeline shows the average duration of each stage, with ranges indicating the variation across patients.
	</p>
	<div class="md:w-3/4 mx-auto mb-4">
		<AggregatedTimeline 
			patients={filteredPatients}
			groupBy="optype"
			ageRange={[ageMin, ageMax]}
		/>
	</div>
</section>

<!-- Section 3: Profile Comparison (visual on right) -->
<section class="space-y-6">
	<h2 id="dynamic-comparison">
		Dynamic Comparison — Median Outcomes for High-Risk vs Low-Risk Cohorts
	</h2>

	<p>
		We summarise the <strong>highest-risk cohort&nbsp;(A)</strong> (worst composite score) and the
		<strong>lowest-risk decile&nbsp;(B)</strong>. The radar chart shows median values for
		<em>mortality&nbsp;(%)</em>, <em>ICU-stay&nbsp;(days)</em>, and
		<em>blood loss&nbsp;(mL)</em>. A vertex farther from the centre signals a worse outcome.
	</p>

	{#if high && low}
		<div class="flex justify-center">
			<RiskRadar {cases} />
<section>
	<h2>Profile Comparison</h2>
	<div class="flex flex-col items-center gap-8 md:flex-row">
		<div class="space-y-4 md:w-1/2">
			<p>
				Not all patients share the same journey. Here, we line up two distinct profiles to compare
				critical outcomes: ICU length of stay, intraoperative blood loss, and survival. Profile A
				might be an elderly emergency case, while Profile B is a younger elective surgery. Examining
				their "dumbbell" plot highlights how small differences—like a one-day longer stay in ICU—can
				translate into major resource implications.
			</p>
			<p>
				The connecting lines between each pair of points underscore the delta in outcomes. You'll
				quickly see which metrics diverge most dramatically—perhaps blood loss swings by hundreds of
				milliliters, while mortality risk remains low for both. This side-by-side view encourages
				viewers to ask: what preoperative or procedural factors drive these differences?
			</p>
		</div>
		<div class="md:w-1/2">
			{#if profileA && profileB}
				<Comparison profileA={profileA} profileB={profileB} /> <!-- Explicitly pass props -->
			{/if}
		</div>
	</div>
</section>

<!-- Section 4: Build Your Own Patient (visual on left) -->
<section>
	<h2>Build Your Own Patient</h2>
	<div class="flex flex-col items-center gap-8 md:flex-row-reverse">
		<div class="space-y-4 md:w-1/2">
			<p>
				What if you could dial in exactly the characteristics of a patient and instantly preview
				their risks? Use the sliders below to set age, BMI, ASA physical status, and toggle
				emergency status. These inputs feed a simple predictive model that estimates both ICU stay
				duration and in-hospital mortality percentage.
			</p>
			<p>
				This interactive "risk profile" tool brings theory into practice: you'll see how even a
				single-point change in ASA score or marking the case as emergency can shift predicted ICU
				days by several hours or double mortality probability. Experiment freely to build intuition
				about how each factor compounds overall risk.
			</p>

			<div>
				<label class="block font-medium">Age: {predictors.age}</label>
				<input type="range" min="0" max="100" bind:value={predictors.age} class="w-full" />
			</div>
			<div>
				<label class="block font-medium">BMI: {predictors.bmi}</label>
				<input type="range" min="10" max="50" step="1" bind:value={predictors.bmi} class="w-full" />
			</div>
			<div>
				<label class="block font-medium">ASA Score: {predictors.asa}</label>
				<input type="range" min="1" max="5" bind:value={predictors.asa} class="w-full" />
			</div>
			<div class="flex items-center space-x-2">
				<input
					type="checkbox"
					checked={predictors.emergency === 1}
					on:change={() => (predictors.emergency = predictors.emergency === 1 ? 0 : 1)}
				/>
				<label>Emergency Case</label>
			</div>
		</div>
		<div class="md:w-1/2">
			<BuildPatient predictors={predictors} /> <!-- Explicitly pass props -->
		</div>
	</div>
</section>
