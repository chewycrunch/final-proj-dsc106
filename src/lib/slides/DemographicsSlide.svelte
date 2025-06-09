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
				(c) => c.age !== undefined && c.age >= filteredAgeRange![0] && c.age <= filteredAgeRange![1]
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

<div class="slide-container">
	<div class="content">
		<h2>Who Steps Into the OR?</h2>
		<p class="description">
			Let's start by meeting our patients. The charts below reveal a striking pattern: while our
			patients span six decades,
			<strong>95% cluster in just two surgical departments</strong>. This concentration—combined with
			age and sex differences—creates wildly different baseline risks before the first incision. Click
			any department bar or select an age range to filter the dashboard and see how demographics shift
			across specialties.
		</p>

		<div class="controls-container">
			<div class="flex-controls">
				<label class="control-item">
					<input
						type="checkbox"
						bind:checked={showPercentage}
					/>
					<span class="checkbox-label">Show percentages</span>
				</label>

				<label class="control-item">
					<input type="checkbox" bind:checked={showBySex} />
					<span class="checkbox-label">Split by sex</span>
				</label>

				<p class="tip-text">
					<i
						>Tip: Click and drag on the age chart to filter by age range. Click on department bars to
						filter by department.</i
					>
				</p>
			</div>
		</div>

		<div class="visualization-grid">
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

		<div class="insights-container">
			<h4>Insights into Demographics</h4>
			<div class="insights-grid">
				<div class="insight-card">
					<p>
						Our surgical cases span six decades of life. The median age of 59.0 suggests an
						aging population, with implications for surgical risk and recovery
						considerations.
					</p>
				</div>
				<div class="insight-card">
					<p>
						Our patients span six decades, but 95% of them cluster in just two surgical
						departments, setting the stage for wildly different baseline risks.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.slide-container {
		height: 100vh;
		width: 100vw;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 8vh 2.5rem 4vh 2.5rem;
		box-sizing: border-box;
		overflow: hidden;
		color: #f1f5f9;
		position: fixed;
		top: 0;
		left: 0;
	}

	.content {
		width: min(1200px, 95vw);
		max-width: 1200px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin: 0 auto;
	}

	h2 {
		font-size: 2.2rem;
		text-align: left;
		margin: 0;
		line-height: 1.2;
	}

	.description {
		font-size: 1.1rem;
		line-height: 1.5;
		text-align: left;
		margin: 0;
		max-width: 1000px;
	}

	.controls-container {
		background: rgba(30, 41, 59, 0.8);
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		width: 100%;
	}

	.flex-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}

	.control-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		color: #f1f5f9;
	}

	.control-item input[type="checkbox"] {
		appearance: none;
		width: 1.2rem;
		height: 1.2rem;
		border: 2px solid #64748b;
		border-radius: 4px;
		background: transparent;
		position: relative;
		transition: all 0.2s ease;
	}

	.control-item input[type="checkbox"]:checked {
		background: #3b82f6;
		border-color: #3b82f6;
	}

	.control-item input[type="checkbox"]:checked::after {
		content: '✓';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white;
		font-weight: bold;
		font-size: 0.8rem;
	}

	.checkbox-label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.tip-text {
		font-size: 0.85rem;
		color: #94a3b8;
		margin-left: auto;
		text-align: right;
		flex-grow: 1;
	}

	.visualization-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		width: 100%;
	}

	.insights-container {
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1.5rem;
		margin-top: 1.5rem;
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		width: 100%;
	}

	.insights-container h4 {
		margin: 0 0 1rem 0;
		color: #f1f5f9;
		font-size: 1.1rem;
	}

	.insights-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		width: 100%;
	}

	.insight-card {
		background: rgba(51, 65, 85, 0.6);
		border: 1px solid #475569;
		border-radius: 8px;
		padding: 1rem;
		text-align: left;
		transition: transform 0.2s ease;
		font-size: 1rem;
		line-height: 1.5;
		min-height: 120px;
		display: flex;
		align-items: center;
	}

	.insight-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.insight-card p {
		margin: 0;
		color: #CBD5E0;
	}

	/* Responsive adjustments */
	@media (max-width: 1200px) {
		.content {
			width: 95vw;
		}
	}

	@media (max-width: 900px) {
		.visualization-grid,
		.insights-grid {
			grid-template-columns: 1fr;
		}

		.slide-container {
			padding: 6vh 1.5rem 2vh 1.5rem;
		}

		h2 {
			font-size: 1.8rem;
		}

		.description {
			font-size: 1rem;
		}
	}

	@media (max-width: 600px) {
		.slide-container {
			padding: 4vh 1rem 2vh 1rem;
		}

		h2 {
			font-size: 1.5rem;
		}

		.description {
			font-size: 0.95rem;
		}

		.insight-card {
			min-height: 100px;
		}
	}
</style>
