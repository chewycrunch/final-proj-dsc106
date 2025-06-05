<!--  File: src/routes/+page.svelte  -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';
	import HeroCounter from '$lib/HeroCounter.svelte';
	import Container from '$lib/Container.svelte';
	import type { Snippet } from 'svelte';

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
	let loading = true;
	let filteredCases: SurgeryCase[] = [];
	let filteredDepartment: string | null = null;
	let filteredAgeRange: [number, number] | null = null;
	let showPercentage = false;
	let showBySex = true;
	let predictors = { age: 60, bmi: 25, asa: 2, emergency: 0 };

	// Slide management
	let currentSlide = 0;
	let isTransitioning = false;
	const TRANSITION_DURATION = 300; // Reduced from 500ms to 300ms

	// Define slides array
	const slides = [
		{ id: 'hook', content: hookSlide },
		{ id: 'demographics', content: demographicsSlide },
		{ id: 'timeline', content: timelineSlide },
		{ id: 'albumin', content: albuminSlide },
		{ id: 'buildPatient', content: buildPatientSlide },
		{ id: 'takeaway', content: takeawaySlide },
		{ id: 'writeup', content: writeupSlide }
	];

	const totalSlides = slides.length;

	function nextSlide() {
		if (currentSlide < totalSlides - 1 && !isTransitioning) {
			isTransitioning = true;
			currentSlide++;
			setTimeout(() => {
				isTransitioning = false;
			}, TRANSITION_DURATION);
		}
	}

	function prevSlide() {
		if (currentSlide > 0 && !isTransitioning) {
			isTransitioning = true;
			currentSlide--;
			setTimeout(() => {
				isTransitioning = false;
			}, TRANSITION_DURATION);
		}
	}

	function goToSlide(index: number) {
		if (index >= 0 && index < totalSlides && !isTransitioning) {
			isTransitioning = true;
			currentSlide = index;
			setTimeout(() => {
				isTransitioning = false;
			}, TRANSITION_DURATION);
		}
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			nextSlide();
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			prevSlide();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

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
</script>

{#snippet hookSlide()}
	<div class="space-y-6 text-center">
		<h1 class="text-4xl leading-tight font-semibold md:text-5xl">
			Vitals&nbsp;Unveiled:<br />
			<span class="text-indigo-600">Why Some "Routine" Surgeries Aren't</span>
		</h1>

		<p class="mx-auto max-w-2xl text-lg md:text-xl">
			Every morning an OR schedule hums like clockwork. <strong>6 388</strong>
			patients arrive, expecting a smooth ride through anesthesia and stitched-up certainty. Yet buried
			in those charts are
			<em>blood-loss spikes, surprise ICU transfers, and silent tragedies</em> that no checklist predicted.
			What separates the happy recoveries from the heart-stopping detours?
		</p>

		<p class="mx-auto max-w-2xl text-lg md:text-xl">
			Scroll on 👇 as we crack open the VitalDB dataset to follow every heartbeat, incision, and lab
			value—then build <strong>interactive risk profiles</strong> that may one day warn us before routine
			turns to critical.
		</p>

		<HeroCounter
			stats={[
				{ label: 'Total Surgeries', value: cases.length },
				{
					label: 'ICU Transfers',
					value: cases.filter((c) => (c.icu_days ?? 0) > 0).length
				},
				{
					label: 'In-hospital Deaths',
					value: cases.filter((c) => c.death_inhosp == 1).length
				}
			]}
		/>
	</div>
{/snippet}

{#snippet demographicsSlide()}
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

			<p class="text-xs text-gray-600 italic">
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
{/snippet}

{#snippet timelineSlide()}
	<h2>Time on the Table</h2>
	<p class="max-w-9xl mx-auto mb-4">
		Each dot marks a key moment in surgery. The visualization shows <strong
			>mean, min, and max durations</strong
		>
		across our 6,388 cases. Try the filters above—switch between department and surgery type to see how
		<strong>different procedures have their own rhythm</strong>. For instance, breast surgeries
		average just <strong>34 minutes</strong> from anesthesia to incision, while transplantations
		take nearly twice as long,
		<strong>at 70 minutes</strong>. This pre-incision time matters, as longer anesthesia exposure
		before surgery increases risk of complications. If you're facing surgery, use these filters to
		see typical timing patterns for your procedure—knowledge that can help you understand and
		prepare for your own surgical journey. Hover over dots for exact timing stats.
	</p>
	<div>
		<AggregatedTimeline {cases} />
	</div>
{/snippet}

{#snippet albuminSlide()}
	<h2>Hidden Risk Factor — The Albumin Cliff</h2>
	<p>
		Albumin is a blood protein that reflects nutritional reserve and overall physiological
		resilience. In the pre-operative setting, low albumin levels often signal that a patient's body
		may struggle to recover. By highlighting albumin, we remind viewers that a seemingly "routine"
		lab value—often checked before surgery—can quietly predict who sails through the OR and who may
		end up in the ICU. It's the kind of hidden detail that turns "routine" into "unexpected" when no
		one is watching.
	</p>
	<br />
	<p>
		<strong>x-axis</strong> = pre-operative albumin (g/dL).
		<strong>Dot colour</strong> = post-op ICU stay (<span style="color:#a50026">red ≈ ≥ 3 days</span
		>,
		<span style="color:#3288bd">deep-blue ≈ 0–1 day</span>). Use the radio buttons to flip between
		routine <b>elective</b>, urgent <b>emergency</b>, or <b>all</b> cases. Below a certain threshold,
		the risk of prolonged ICU stay climbs sharply—our so-called "Albumin Cliff."
	</p>
	<br />

	<AlbuminRiskScatter patients={cases} />

	<h3>What we actually see</h3>
	<ul class="list-inside list-disc space-y-1">
		<li>
			<strong>In elective cases, a pronounced shift appears near 3 g/dL.</strong>
			Patients with albumin just under 3 g/dL begin to light up orange and red, whereas above 3 g/dL
			most stay deep-blue.
			<span class="font-semibold">Median ICU stay below 3 g/dL is about 2.1 days (IQR 1–4),</span>
			compared to
			<span class="font-semibold">0.7 days (IQR 0–1) above 3 g/dL</span>. A few low-albumin blue
			outliers exist, but long-stayers (amber & red) become nearly three times more common once you
			cross that cliff.
		</li>
		<li>
			<strong>In emergencies, the "cliff" shifts upward to around 3.5 g/dL.</strong>
			Because urgent cases already carry extra risk, the median albumin threshold where ICU stays spike
			is higher. Below ~3.5 g/dL,
			<span class="font-semibold">the chance of ≥ 3-day ICU stay more than doubles</span>
			compared to those with albumin above 3.5 g/dL. The spread of dots is wider, but the colour gradient
			still tilts toward red as albumin drops.
		</li>
		<li>
			High-albumin (> 4 g/dL) patients rarely linger, anchoring the schedule "clockwork" we saw in
			the opening hook.
		</li>
	</ul>

	<p>
		<b>Take-away&nbsp;→</b> Albumin isn't a guarantee of trouble, but a
		<em>silent gravity well</em>: the lower it drops, the harder it is to climb off the ICU track.
		Even in apparently routine electives, nutrition can tip the balance from day-case discharge to
		days of critical care.
	</p>
{/snippet}

{#snippet buildPatientSlide()}
	<h2>Interactive Risk Builder</h2>
	<p class="mb-4 max-w-xl">
		Now it's your turn. Build a patient profile using the sliders below. Watch how tiny shifts—a
		single ASA notch or clicking 'Emergency'—can triple the mortality risk instantly. We'll show you
		how many similar historical cases we found, so you can trust the predictions. Try the "Make a
		Guess" mode to test your intuition against the data.
	</p>
	<BuildPatient {cases} bind:predictors />
{/snippet}

{#snippet takeawaySlide()}
	<div class="mx-auto max-w-2xl rounded-lg bg-indigo-50 p-8">
		<h2>The Takeaway</h2>
		<p class="text-lg text-indigo-800">
			The data reveals three critical insights: First, pre-op albumin levels—easily measured and
			often correctable—strongly predict ICU stays. Second, emergency status and ASA score interact
			in ways that standard checklists miss. And third, while we can't change age, we can optimize
			timing, prepare blood products, and adjust recovery expectations based on these risk factors.
			The data tells us where to look—before the knife ever touches skin.
		</p>
	</div>
{/snippet}

{#snippet writeupSlide()}
	<h2>Writeup</h2>
	<p>
		1. What have you done so far? So far, we’ve built a comprehensive exploratory analysis of our
		surgical patient population to lay the groundwork for outcome-based modeling. We began by
		visualizing age distribution, revealing a wide range of patients from their twenties to their
		eighties. This range emphasizes the variation in baseline risk and physiological resilience
		across the cohort. We then created a department-wise breakdown of surgical cases, showing that
		general surgery dominates in volume, with notable contributions from thoracic surgery and
		urology.
		<br />In addition to demographic insights, we constructed a line chart to compare the average
		duration of each surgical phase (anesthesia, surgery, and recovery) across departments. This
		helps contextualize how time and resource demands vary by specialty. We also explored risk
		stratification through a radar chart comparing median outcomes for high- and low-risk cohorts.
		Metrics like mortality, ICU stay, and blood loss were visualized, clearly showing that
		pre-operative risk factors correlate with worse outcomes. Finally, we built an interactive tool
		that allows users to manipulate variables like age, ASA status, and emergency status to simulate
		predicted risks, making the data both accessible and actionable.
		<br /><br />2. What will be the most challenging part of your project to design and why? The
		most challenging component of the project will likely be the design and refinement of the “Build
		Your Own Patient” predictive interface. While the tool currently visualizes model output based
		on user-selected inputs, accurately modeling risk for ICU stay and in-hospital mortality from
		such a small set of parameters introduces complexity. Capturing the nuances of surgical
		risk—especially interactions between variables like age and ASA score—requires both careful
		feature engineering and robust validation against clinical outcomes.
		<br />Additionally, designing an interface that is intuitive yet scientifically accurate
		presents a UI/UX challenge. Users must understand the sensitivity of predictions without
		misinterpreting them as deterministic. Balancing simplicity with explanatory power, and ensuring
		the tool reflects real-world risk distributions without bias, will require tight integration
		between the front-end experience and the underlying model logic. Finally, scaling the model for
		more granular or department-specific predictions while maintaining speed and clarity will
		require thoughtful architectural decisions as the project evolves.
	</p>
{/snippet}

{#snippet slideContent(slide)}
	<div class="py-10">
		{@render slide.content()}
	</div>
{/snippet}

{#if loading}
	<p class="py-16 text-center text-lg">Loading VitalDB dataset …</p>
{:else}
	<!-- Navigation Buttons -->
	<button
		class="absolute top-1/2 left-4 z-50 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg hover:bg-white"
		on:click={prevSlide}
		disabled={currentSlide === 0 || isTransitioning}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
		</svg>
	</button>

	<button
		class="absolute top-1/2 right-4 z-50 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg hover:bg-white"
		on:click={nextSlide}
		disabled={currentSlide === totalSlides - 1 || isTransitioning}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
	</button>

	<!-- Dot Navigation (Bottom dots) -->
	<div class="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-2">
		{#each slides as _, i}
			<button
				class="h-3 w-3 rounded-full transition-all duration-300 {currentSlide === i
					? 'bg-indigo-600'
					: 'bg-gray-300 hover:bg-gray-400'}"
				on:click={() => goToSlide(i)}
				disabled={isTransitioning}
			/>
		{/each}
	</div>

	<!-- Sections Container -->
	{#each slides as slide, i}
		{#if currentSlide === i}
			<div
				class="absolute inset-0 overflow-y-auto transition-opacity duration-300"
				style="opacity: {isTransitioning ? 0 : 1}"
			>
				<Container>
					{@render slideContent(slide)}
				</Container>
			</div>
		{/if}
	{/each}
{/if}

<style>
	@reference '$lib/../app.css';

	:global(svg) {
		max-width: 100%;
	}

	/* Prevent default scroll behavior */
	:global(body) {
		overflow: hidden;
	}

	/* Ensure proper scrolling within sections */
	.overflow-y-auto {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 #f1f5f9;
	}

	.overflow-y-auto::-webkit-scrollbar {
		width: 8px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: #f1f5f9;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background-color: #cbd5e1;
		border-radius: 4px;
	}

	h2 {
		@apply mb-4 text-2xl font-semibold text-indigo-900;
	}
</style>
