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
		emergency: 0
	};

	onMount(async () => {
		const url = `${base}/cases.csv`;
		cases = await csv<SurgeryCase>(url, (row) => ({
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
			emergency: +row.emop! // or row.emergency
		}));

		// defaults
		if (cases.length) {
			selectedCaseId = cases[0].caseid;
			profileA = cases[0];
			profileB = cases[1] ?? null;
		}
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
<section>
	<h2>Profile Comparison</h2>
	<div class="flex flex-col items-center gap-8 md:flex-row">
		<div class="space-y-4 md:w-1/2">
			<p>
				Not all patients share the same journey. Here, we line up two distinct profiles to compare
				critical outcomes: ICU length of stay, intraoperative blood loss, and survival. Profile A
				might be an elderly emergency case, while Profile B is a younger elective surgery. Examining
				their “dumbbell” plot highlights how small differences—like a one-day longer stay in ICU—can
				translate into major resource implications.
			</p>
			<p>
				The connecting lines between each pair of points underscore the delta in outcomes. You’ll
				quickly see which metrics diverge most dramatically—perhaps blood loss swings by hundreds of
				milliliters, while mortality risk remains low for both. This side-by-side view encourages
				viewers to ask: what preoperative or procedural factors drive these differences?
			</p>
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
				This interactive “risk profile” tool brings theory into practice: you’ll see how even a
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
					bind:checked={predictors.emergency}
					on:change={() => (predictors.emergency = predictors.emergency ? 1 : 0)}
				/>
				<label>Emergency Case</label>
			</div>
		</div>
		<div class="md:w-1/2">
			<BuildPatient {predictors} />
		</div>
	</div>
</section>
