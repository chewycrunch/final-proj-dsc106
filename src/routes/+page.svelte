<!--  File: src/routes/+page.svelte  -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';
	import HeroCounter from '$lib/HeroCounter.svelte';
	import Container from '$lib/Container.svelte';
	import type { Snippet } from 'svelte';

	/* ---------- visual sections (they each do their own processing) ---------- */

	// Slides
	import HookSlide from '$lib/slides/HookSlide.svelte';
	import DemographicsSlide from '$lib/slides/DemographicsSlide.svelte';
	import TimelineSlide from '$lib/slides/TimelineSlide.svelte';
	import AlbuminSlide from '$lib/slides/AlbuminSlide.svelte';
	import TakeawaySlide from '$lib/slides/TakeawaySlide.svelte';
	import WriteupSlide from '$lib/slides/WriteupSlide.svelte';
	import BuildPatient from '$lib/slides/BuildPatient.svelte';

	/* ---------- dataset ---------- */
	let cases: SurgeryCase[] = [];
	let loading = true;
	let predictors = { age: 60, bmi: 25, asa: 2, emergency: 0 };

	let currentSlide = 0;
	let isTransitioning = false;
	const TRANSITION_DURATION = 300; // Reduced from 500ms to 300ms

	// Define slides array
	const slides = [
		{ id: 'hook', content: HookSlide },
		{ id: 'demographics', content: DemographicsSlide },
		{ id: 'timeline', content: TimelineSlide },
		{ id: 'albumin', content: AlbuminSlide },
		{ id: 'buildPatient', content: BuildPatient },
		{ id: 'takeaway', content: TakeawaySlide },
		{ id: 'writeup', content: WriteupSlide }
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
				<Container class="py-10">
					<svelte:component this={slide.content} {cases} />
					<!-- {@render slideContent(slide)} -->
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
