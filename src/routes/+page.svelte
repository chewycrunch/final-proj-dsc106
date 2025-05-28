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

	let cases: SurgeryCase[] = [];
	let selectedPatient: SurgeryCase | null = null;
	let selectedPatientIndex: number = 0;

	// Filtering criteria
	let selectedOpType: string | null = null;
	let selectedDepartment: string | null = null;
	let ageMin: number = 0;
	let ageMax: number = 120;

	let availableOpTypes: string[] = [];
	let availableDepartments: string[] = [];

	$: availableOpTypes = Array.from(new Set(cases.map(p => p.optype))).filter(Boolean);
	$: availableDepartments = Array.from(new Set(cases.map(p => p.department))).filter(Boolean);

	$: filteredPatients = cases.filter(p =>
		(!selectedOpType || p.optype === selectedOpType) &&
		(!selectedDepartment || p.department === selectedDepartment) &&
		(typeof p.age === 'number' ? p.age >= ageMin && p.age <= ageMax : true)
	);

	$: selectedPatient = filteredPatients[selectedPatientIndex] || null;

	let profileA: SurgeryCase | null = null;
	let profileB: SurgeryCase | null = null;

	// reactive predictors for BuildPatient
	// interface Predictors moved to script context="module"

	let predictors: Predictors = {
		age: 65,
		bmi: 28,
		asa: 3,
		emergency: 0
	};

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

		// defaults
		if (cases.length) {
			selectedPatientIndex = 0;
			selectedPatient = cases[0];
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
