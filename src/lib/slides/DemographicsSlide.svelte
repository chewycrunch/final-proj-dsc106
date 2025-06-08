<script lang="ts">
	import AgeDistribution from '$lib/AgeDistribution.svelte';
	import DepartmentDistribution from '$lib/DepartmentDistribution.svelte';
	import { onMount } from 'svelte';

	let filteredCases: SurgeryCase[] = [];
	let filteredDepartment: string | null = null;
	let filteredAgeRange: [number, number] | null = null;
	let showPercentage = false;
	let showBySex = false;

	let predictors = { age: 60, bmi: 25, asa: 2, emergency: 0 };
	export let cases: SurgeryCase[] = [];

	// Calculate mortality rates for different groups
	$: if (cases.length > 0) {
		const emergencyLowAlb = cases.filter((c) => c.emop === 1 && (c.preop_alb ?? 0) < 3);
		const electiveHighAlb = cases.filter((c) => c.emop === 0 && (c.preop_alb ?? 0) > 3.5);

		const emergencyMortality =
			emergencyLowAlb.length > 0
				? emergencyLowAlb.reduce((sum, c) => sum + (c.death_inhosp ?? 0), 0) /
					emergencyLowAlb.length
				: 0;
		const electiveMortality =
			electiveHighAlb.length > 0
				? electiveHighAlb.reduce((sum, c) => sum + (c.death_inhosp ?? 0), 0) /
					electiveHighAlb.length
				: 0;

		console.log('Emergency Low Alb Mortality:', (emergencyMortality * 100).toFixed(1) + '%');
		console.log('Elective High Alb Mortality:', (electiveMortality * 100).toFixed(1) + '%');
		console.log('Ratio:', (emergencyMortality / (electiveMortality || 0.001)).toFixed(1) + 'x');

		// Analyze timing patterns by department and surgery type
		const deptTiming = new Map<string, { count: number; avgWait: number; stdDev: number }>();
		const surgeryTiming = new Map<string, { count: number; avgWait: number; stdDev: number }>();

		// Helper to calculate running standard deviation
		function updateStats(stats: { count: number; avgWait: number; stdDev: number }, wait: number) {
			const oldAvg = stats.avgWait;
			stats.count++;
			stats.avgWait = (oldAvg * (stats.count - 1) + wait) / stats.count;
			// Simplified running standard deviation calculation
			stats.stdDev = Math.sqrt(
				((stats.count - 2) * stats.stdDev * stats.stdDev +
					(wait - oldAvg) * (wait - stats.avgWait)) /
					(stats.count - 1)
			);
		}

		cases.forEach((c) => {
			if (c.department && c.optype && c.anestart && c.opstart) {
				const wait = (c.opstart - c.anestart) / 60; // convert to minutes

				// Update department stats
				if (!deptTiming.has(c.department)) {
					deptTiming.set(c.department, { count: 0, avgWait: 0, stdDev: 0 });
				}
				updateStats(deptTiming.get(c.department)!, wait);

				// Update surgery type stats
				if (!surgeryTiming.has(c.optype)) {
					surgeryTiming.set(c.optype, { count: 0, avgWait: 0, stdDev: 0 });
				}
				updateStats(surgeryTiming.get(c.optype)!, wait);
			}
		});

		// Log timing patterns
		console.log('\nDepartment Timing Patterns (sorted by case count):');
		Array.from(deptTiming.entries())
			.sort((a, b) => b[1].count - a[1].count)
			.forEach(([dept, stats]) => {
				console.log(
					`${dept}: ${stats.count} cases, avg wait ${stats.avgWait.toFixed(1)} ± ${stats.stdDev.toFixed(1)} min`
				);
			});

		console.log('\nSurgery Type Timing Patterns (top 10 by case count):');
		Array.from(surgeryTiming.entries())
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 10)
			.forEach(([type, stats]) => {
				console.log(
					`${type}: ${stats.count} cases, avg wait ${stats.avgWait.toFixed(1)} ± ${stats.stdDev.toFixed(1)} min`
				);
			});
	}

	// Function to handle filtering by department
	function handleDepartmentFilter(event: CustomEvent) {
		const { department } = event.detail;
		filteredDepartment = department;

		applyFilters();
	}

	// Function to handle percentage view changes
	function handlePercentageChange(event: CustomEvent) {
		showPercentage = event.detail.showPercentage;
	}

	// Function to handle age range filtering
	function handleAgeFilter(event: CustomEvent) {
		const { ageRange } = event.detail;
		filteredAgeRange = ageRange;

		applyFilters();
	}

	// Apply both department and age filters together
	function applyFilters() {
		// Start with all cases
		let filtered = [...cases];

		// Apply department filter if active
		if (filteredDepartment) {
			filtered = filtered.filter((c) => c.department === filteredDepartment);
		}

		// Apply age range filter if active
		if (filteredAgeRange) {
			filtered = filtered.filter(
				(c) => c.age !== undefined && c.age >= filteredAgeRange[0] && c.age <= filteredAgeRange[1]
			);
		}

		// Update filtered cases
		filteredCases = filtered;
	}

	/** helper - cast numeric-looking strings to Number, leave others as string */
	function coerce(v: string | undefined): string | number {
		if (v == null || v.trim() === '') return '';
		return /^[+\-]?\d+(\.\d+)?$/.test(v) ? +v : v;
	}
</script>

<h2>Who Steps Into the OR?</h2>
<p class="mb-4 max-w-xl">
	Let's start by meeting our patients. The charts below reveal a striking pattern: while our
	patients span six decades,
	<strong>95% cluster in just two surgical departments</strong>. This concentration—combined with
	age and sex differences—creates wildly different baseline risks before the first incision. Click
	any department bar or select an age range to filter the dashboard and see how demographics shift
	across specialties.
</p>

<div class="controls-container mb-4">
	<div class="flex flex-wrap gap-4">
		<label class="flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={showPercentage}
				on:change={() => {
					handlePercentageChange({ detail: { showPercentage } });
				}}
			/>
			Show percentages
		</label>

		<label class="flex cursor-pointer items-center gap-2">
			<input type="checkbox" bind:checked={showBySex} />
			Split by sex
		</label>

		<p class="text-text-secondary text-xs italic">
			<i
				>Tip: Click and drag on the age chart to filter by age range. Click on department bars to
				filter by department.</i
			>
		</p>
	</div>
</div>

<div class="visualization-grid grid gap-8 md:grid-cols-2">
	<AgeDistribution
		data={filteredDepartment ? filteredCases : cases}
		bind:showPercentage
		bind:showBySex
		on:percentageChange={handlePercentageChange}
		on:filter={handleAgeFilter}
	/>
	<DepartmentDistribution
		data={filteredAgeRange ? filteredCases : cases}
		{filteredDepartment}
		{showPercentage}
		on:filter={handleDepartmentFilter}
	/>
</div>
