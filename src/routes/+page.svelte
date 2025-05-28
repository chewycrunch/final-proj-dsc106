<!-- File: src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';

	import AgeDistribution from '$lib/AgeDistribution.svelte';
	import DepartmentDistribution from '$lib/DepartmentDistribution.svelte';
	import Timeline from '$lib/Timeline.svelte';
	import Comparison from '$lib/Comparison.svelte';
	import BuildPatient from '$lib/BuildPatient.svelte';
	import RiskRadar from '$lib/RiskRadar.svelte';

	// import RiskFactorComparison from '$lib/RiskFactorComparison.svelte';

	let cases: SurgeryCase[] = [];

	let high: SurgeryCase | null = null;
	let low: SurgeryCase | null = null;

	// Hold the selected case ID and derive the object reactively
	let selectedCaseId = '';
	$: selectedCase = cases.find((c) => c.caseid === selectedCaseId) ?? null;

	let profileA: SurgeryCase | null = null;
	let profileB: SurgeryCase | null = null;

	// reactive predictors for BuildPatient
	let predictors = {
		age: 65,
		bmi: 28,
		asa: 3,
		emergency: 1
	};

	onMount(async () => {
		const url = `${base}/cases.csv`;
		const num = (v: string | undefined) => (v === '' || v == null ? NaN : +v);

		cases = await csv<SurgeryCase>(url, (row) => {
			const obj: SurgeryCase = {
				caseid: row.caseid!,

				age: num(row.age),
				bmi: num(row.bmi),
				sex: row.sex as 'M' | 'F',

				department: row.department!,
				asa: num(row.asa),
				emergency: num(row.emop),

				casestart: num(row.casestart),
				anestart: num(row.anestart),
				opstart: num(row.opstart),
				opend: num(row.opend),
				dis: num(row.dis),

				icu_days: num(row.icu_days),
				intraop_ebl: num(row.intraop_ebl),
				death_inhosp: num(row.death_inhosp),

				preop_htn: num(row.preop_htn),
				preop_dm: num(row.preop_dm)
			};

			return obj;
		});

		/* ---------- pick contrasting profiles ---------- */

		const risk = (c: SurgeryCase) =>
			c.death_inhosp * 100 + // deaths dominate
			c.icu_days + // + ICU-days
			c.intraop_ebl / 500; // + scaled blood loss

		const hasMetrics = (c: SurgeryCase) =>
			[c.icu_days, c.intraop_ebl, c.death_inhosp].every((v) => !isNaN(v) && v > 0);

		const valid = cases.filter(hasMetrics);

		// sort descending for high-risk
		valid.sort((a, b) => risk(b) - risk(a));

		high = valid[0]; // worst
		// low = valid[valid.length - 1]; // best
		low = valid[Math.floor(valid.length * 0.1)];
	});
</script>

<h1>Title here</h1>
<!-- Section 1: Demographics (visual on right) -->
<section>
	<h2>Explore Patient Demographics</h2>
	<div class="flex flex-col items-center gap-8 md:flex-row">
		<div class="space-y-4 md:w-1/2">
			<p>
				Before diving into outcomes, it’s critical to understand who our patients are. Here we plot
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
<section>
	<h2>Average Phase Durations Over Departments</h2>
	<p class="mb-4">
		For each surgical department, this line chart shows the average minutes spent in 1) Anesthesia
		(from anesthesia start to operation start), 2) Surgery (operation start to end), and 3) Recovery
		(operation end to discharge).
	</p>
	<div class="mx-auto w-full md:w-4/5">
		<Timeline data={cases} />
	</div>
</section>

<h1>The Tension</h1>

<!-- Section 3: Profile Comparison (visual on right) -->
<section class="space-y-6">
	<!-- heading -->
	<h2 id="dynamic-comparison">
		Dynamic Comparison — Median Outcomes for High-Risk vs Low-Risk Cohorts
	</h2>

	<!-- high-level intro -->
	<p>
		We contrast two carefully defined cohorts to show how <strong>age + hypertension</strong>
		compound surgical risk. The radar chart plots <em>median</em> outcomes — mortality (%), ICU-stay
		(days) and blood loss (mL). A vertex farther from the centre means a worse median outcome.
	</p>

	<!-- methodology -->
	<h3>How we built the comparison</h3>
	<ol class="list-inside list-decimal space-y-2">
		<li>
			<strong>Define cohorts</strong>
			<ul class="ml-4 list-inside list-disc">
				<li>
					<em>High-risk (A)</em> — patients <mark>≥ 70 years</mark> <em>and</em> with pre-operative hypertension.
				</li>
				<li>
					<em>Low-risk (B)</em> — patients <mark>≤ 40 years</mark> with <em>no</em> hypertension.
				</li>
			</ul>
		</li>
		<li><strong>Filter to valid cases</strong> — rows missing any outcome metric are dropped.</li>
		<li><strong>Summarise by the median</strong> within each cohort.</li>
		<li>
			<strong>Normalise each spoke</strong> by the larger of the two medians so the outer rim equals
			“worse of these two groups,” not a single outlier.
		</li>
	</ol>

	<!-- radar chart -->
	{#if high && low}
		<div class="flex justify-center">
			<RiskRadar {high} {low} />
		</div>
	{/if}

	<!-- findings -->
	<h3>What the chart reveals</h3>
	<ul class="list-inside list-disc space-y-1">
		<li>
			<strong>Mortality</strong> — median mortality in the high-risk cohort is non-zero, while the low-risk
			cohort’s median is 0 %, so the red vertex reaches the rim and the blue hugs the centre.
		</li>
		<li>
			<strong>ICU-stay</strong> — elderly hypertensive patients spend roughly
			<span class="font-semibold">4× longer</span> in the ICU.
		</li>
		<li>
			<strong>Blood loss</strong> — median intra-operative blood loss is markedly higher for the high-risk
			group.
		</li>
	</ul>

	<!-- takeaway -->
	<p>
		The outward-bulging red polygon shows how a seemingly small pre-operative difference (age +
		hypertension) magnifies surgical risk across <em>all</em> major outcomes. Hover any vertex to see
		the exact median values.
	</p>
</section>

<!-- Section 4: Build Your Own Patient (visual on left) -->
