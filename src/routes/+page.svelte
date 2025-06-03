<!--  File: src/routes/+page.svelte  -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';
	
	// Define the SurgeryCase type to fix TypeScript errors
	interface SurgeryCase {
		age?: number;
		sex?: string;
		department: string;
		[key: string]: any; // Allow any other properties
	}

	/* ---------- visual sections (they each do their own processing) ---------- */
	import AgeDistribution from '$lib/AgeDistribution.svelte';
	import DepartmentDistribution from '$lib/DepartmentDistribution.svelte';
	// import AggregatedTimeline from '$lib/AggregatedTimeline.svelte';
	// import AlbuminScatter from '$lib/AlbuminScatter.svelte';
	// import RiskRadar from '$lib/RiskRadar.svelte';
	// import BuildPatient from '$lib/BuildPatient.svelte';

	/* ---------- dataset ---------- */
	let cases: SurgeryCase[] = [];
	let filteredCases: SurgeryCase[] = [];
	let filteredDepartment: string | null = null;
	let filteredAgeRange: [number, number] | null = null;
	let showPercentage = false; // Shared state for both charts
	let loading = true;
	
	// Function to trigger a redraw when the percentage view changes
	function draw() {
		// This will be called when showPercentage changes to update both charts
	}
	
	// Function to handle filtering by department
	function handleDepartmentFilter(event: CustomEvent) {
		const { department } = event.detail;
		filteredDepartment = department;
		
		applyFilters();
	}
	
	// Function to handle filtering by age range
	function handleAgeFilter(event: CustomEvent) {
		const { ageRange } = event.detail;
		filteredAgeRange = ageRange;
		
		applyFilters();
	}
	
	// Apply all active filters
	function applyFilters() {
		// Start with all cases
		let result = [...cases];
		
		// Apply department filter if active
		if (filteredDepartment) {
			result = result.filter(c => c.department === filteredDepartment);
		}
		
		// Apply age filter if active
		if (filteredAgeRange) {
			result = result.filter(c => 
				c.age !== undefined && 
				c.age >= filteredAgeRange[0] && 
				c.age <= filteredAgeRange[1]
			);
		}
		
		// Update filtered cases
		filteredCases = result;
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
		<section>
			<h1 class="text-3xl font-semibold">
				Vitals Unveiled: Building Patient Profiles to Forecast Surgical Risk
			</h1>
			<p>
				Surgeries feel routine—until they’re not. Scroll to uncover hidden patterns in
				<strong>{cases.length}</strong> operations.
			</p>
		</section>

		<!-- 2 · Demographics ----------------------------------------------------------- -->
		<section>
			<h2>Who Steps Into the OR?</h2>
			<div class="grid gap-8 md:grid-cols-2">
				<AgeDistribution data={filteredDepartment ? filteredCases : cases} bind:showPercentage />
				<DepartmentDistribution data={cases} {filteredDepartment} {showPercentage} on:filter={handleDepartmentFilter} />
			</div>
		</section>

		<!-- 3 · OR Phase Timeline ------------------------------------------------------ -->
		<section>
			<h2>Time on the Table</h2>
			<p class="mb-4">
				Compare anaesthesia, incision, and recovery time across departments or surgery types.
			</p>
			<!-- <AggregatedTimeline {cases} /> -->
		</section>

		<!-- 4 · Albumin vs ICU Scatter ------------------------------------------------- -->
		<section>
			<h2>Low Albumin ↔ Long ICU Stay?</h2>
			<!-- <AlbuminScatter {cases} /> -->
		</section>

		<!-- 5 · High- vs Low-Risk Outcomes -------------------------------------------- -->
		<section>
			<h2>High-Risk vs Low-Risk Profiles</h2>
			<!-- <RiskRadar {cases} /> -->
		</section>

		<!-- 6 · Build Your Own Patient ------------------------------------------------- -->
		<section>
			<h2>Interactive Risk Builder</h2>
			<!-- <BuildPatient {cases} bind:predictors /> -->
		</section>
	</article>
{/if}

<style>
	:global(svg) {
		max-width: 100%;
	}
</style>
