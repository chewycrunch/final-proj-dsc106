<!-- File: src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';

	import AgeDistribution from '$lib/AgeDistribution.svelte';
	import DepartmentDistribution from '$lib/DepartmentDistribution.svelte';
	import AggregatedTimeline from '$lib/AggregatedTimeline.svelte';
	import BuildPatient from '$lib/BuildPatient.svelte';
	import RiskRadar from '$lib/RiskRadar.svelte';

	let cases: SurgeryCase[] = $state([]);

	let high: SurgeryCase | null = $state(null);
	let low: SurgeryCase | null = $state(null);

	// reactive predictors for BuildPatient
	let predictors = {
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
		cases = await csv<SurgeryCase>(url, (row) => {
			// Convert emergency to number, defaulting to 0 if NaN
			const emergency = row.emergency ? Number(row.emergency) : 0;
			if (isNaN(emergency)) {
				console.warn('Invalid emergency value:', row.emergency, 'defaulting to 0');
			}

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

<h1>Vitals Unveiled: Building Patient Profiles to Forecast Surgical Risk</h1>
<!-- Section 1: Demographics (visual on right) -->
<section>
	<h2>Explore Patient Demographics</h2>
	<div class="flex flex-col items-center gap-8 md:flex-row">
		<div class="space-y-4 md:w-1/2">
			<p>
				Prior to examining outcomes, it is essential to characterize our patient population. 
				We present an age-distribution histogram alongside a breakdown of surgical cases by department. 
				The histogram shows that our cohort ranges from patients in their twenties to those in their eighties—highlighting 
				the wide variation in risk profiles across different age groups.
			</p>
			<p>
				The accompanying bar chart illustrates the volume of cases by specialty, with general surgery comprising the largest share 
				and thoracic and urologic procedures also representing substantial cohorts. Establishing this foundational context will improve readers’ understanding 
				of the detailed risk and outcome analyses that follow.
			</p>
		</div>
		<div class="space-y-8 md:w-1/2">
			<AgeDistribution data={cases} />
			<DepartmentDistribution data={cases} />
		</div>
	</div>
</section>

<!-- Section 2: Timeline (visual on left, with selector) -->
<section>
	<h2>Average Phase Durations Over Departments</h2>
	<p class="mb-4">
		For each surgical department, this line chart shows the average minutes spent in 1) Anesthesia
		(from anesthesia start to operation start), 2) Surgery (operation start to end), and 3) Recovery
		(operation end to discharge).
	</p>
	<div class="mx-auto w-full md:w-4/5">
		<AggregatedTimeline patients={cases} />
	</div>
</section>

<h1>The Tension</h1>

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
		</div>
	{/if}

	<h3>What the chart reveals</h3>
	<ul class="list-inside list-disc space-y-1">
		<li>
			<strong>Mortality</strong> — cohort&nbsp;A shows a non-zero median mortality, whereas cohort&nbsp;B's
			median is 0&nbsp;%; hover the red and blue vertices to see exact percentages.
		</li>
		<li>
			<strong>ICU-stay</strong> — high-risk patients spend roughly
			<span class="font-semibold">4× longer</span> in the ICU.
		</li>
		<li>
			<strong>Blood loss</strong> — median intra-operative blood loss is markedly higher for cohort&nbsp;A.
		</li>
	</ul>

	<p>
		The outward-bulging red polygon demonstrates how pre-operative factors magnify surgical risk
		across <em>all</em> major outcomes. Hover any point to inspect the underlying medians.
	</p>
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
			<BuildPatient {predictors} {cases} />
		</div>
	</div>
</section>
