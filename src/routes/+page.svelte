<!--  File: src/routes/+page.svelte  -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { base } from '$app/paths';
	import HeroCounter from '$lib/HeroCounter.svelte';

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
	}

	// Function to handle filtering by department
	function handleDepartmentFilter(event: CustomEvent) {
		const { department } = event.detail;
		filteredDepartment = department;

		if (department) {
			filteredCases = cases.filter((c) => c.department === department);
		} else {
			filteredCases = [...cases];
		}
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

	/* sliders for Build-Your-Own-Patient (passed unchanged to component) */
	let predictors = { age: 60, bmi: 25, asa: 2, emergency: 0 };
</script>

{#if loading}
	<p class="py-16 text-center text-lg">Loading VitalDB dataset …</p>
{:else}
	<article class="prose mx-auto space-y-20 py-10">
		<!-- 1 · Hook ------------------------------------------------------------------ -->
		<section class="space-y-6 text-center">
			<h1 class="text-4xl leading-tight font-semibold md:text-5xl">
				Vitals&nbsp;Unveiled:<br />
				<span class="text-indigo-600">Why Some "Routine" Surgeries Aren't</span>
			</h1>

			<p class="mx-auto max-w-2xl text-lg md:text-xl">
				Every morning an OR schedule hums like clockwork. <strong>6 388</strong> patients arrive,
				expecting a smooth ride through anesthesia and stitched-up certainty. Yet buried in those
				charts are <em>blood-loss spikes, surprise ICU transfers, and silent tragedies</em> that no checklist
				predicted. What separates the happy recoveries from the heart-stopping detours?
			</p>

			<p class="mx-auto max-w-2xl text-lg md:text-xl">
				Scroll on 👇 as we crack open the VitalDB dataset to follow every heartbeat, incision, and
				lab value—then build <strong>interactive risk profiles</strong> that may one day warn us before
				routine turns to critical.
			</p>

			<!-- hero counter ---------------------------------------------------------- -->
			<HeroCounter
				stats={[
					{ label: 'Total Surgeries', value: cases.length },
					{ label: 'ICU Transfers', value: cases.filter((c) => (c.icu_days ?? 0) > 0).length },
					{ label: 'In-hospital Deaths', value: cases.filter((c) => c.death_inhosp == 1).length }
				]}
			/>
		</section>

		<!-- 2 · Demographics ----------------------------------------------------------- -->
		<section>
			<h2>Who Steps Into the OR?</h2>
			<p class="mb-4 max-w-xl">
				Let's start by meeting our patients. The charts below reveal a striking pattern: while our
				patients span six decades,
				<strong>70% cluster in just two surgical departments</strong>. This concentration—combined
				with age and sex differences—creates wildly different baseline risks before the first
				incision. Click any department bar to filter the dashboard and see how demographics shift
				across specialties.
			</p>
			<div class="grid gap-8 md:grid-cols-2">
				<AgeDistribution data={filteredDepartment ? filteredCases : cases} />
				<DepartmentDistribution
					data={cases}
					{filteredDepartment}
					on:filter={handleDepartmentFilter}
				/>
			</div>
		</section>

		<!-- 3 · OR Phase Timeline ------------------------------------------------------ -->
		<section>
			<h2 class="mb-1 pb-4 text-center text-3xl font-bold">Time on the Table</h2>
			<p class="mx-auto mb-4 max-w-2xl text-center">
				Each dot marks a key moment in surgery, from case start to end. The visualization shows <strong
					>mean, min, and max durations</strong
				>
				for each phase across our 6,388 cases. For instance, patients typically wait
				<strong>45 minutes</strong> between anesthesia and operation start. Filter by age or department
				to compare specialties. Hover over dots for exact timing stats.
			</p>
			<div class="mx-auto max-w-4xl">
				<AggregatedTimeline {cases} />
			</div>
		</section>

		<!-- 4 · Albumin vs ICU Scatter ------------------------------------------------- -->
		<section>
			<!-- ───────────── 4 · Hidden Risk Factor ───────────── -->
			<h2>Hidden Risk Factor — The Albumin Cliff</h2>

			<!-- Intro paragraph about albumin and its relevance -->
			<p>
				Albumin is a blood protein that reflects nutritional reserve and overall physiological
				resilience. In the pre-operative setting, low albumin levels often signal that a patient’s
				body may struggle to recover. By highlighting albumin, we remind viewers that a seemingly
				“routine” lab value—often checked before surgery—can quietly predict who sails through the
				OR and who may end up in the ICU. It’s the kind of hidden detail that turns “routine” into
				“unexpected” when no one is watching.
			</p>
			<br />
			<!-- Dedicated paragraph explaining the graph itself -->
			<p>
				<strong>x-axis</strong> = pre-operative albumin (g/dL).
				<strong>Dot colour</strong> = post-op ICU stay (<span style="color:#a50026"
					>red ≈ ≥ 3 days</span
				>,
				<span style="color:#3288bd">deep-blue ≈ 0–1 day</span>). Use the radio buttons to flip
				between routine
				<b>elective</b>, urgent <b>emergency</b>, or <b>all</b> cases. Below a certain threshold, the
				risk of prolonged ICU stay climbs sharply—our so-called “Albumin Cliff.”
			</p>
			<br />

			<AlbuminRiskScatter patients={cases} />

			<h3>What we actually see</h3>
			<ul class="list-inside list-disc space-y-1">
				<li>
					<strong>In elective cases, a pronounced shift appears near 3 g/dL.</strong> Patients with
					albumin just under 3 g/dL begin to light up orange and red, whereas above 3 g/dL most stay
					deep-blue.
					<span class="font-semibold"
						>Median ICU stay below 3 g/dL is about 2.1 days (IQR 1–4),</span
					>
					compared to
					<span class="font-semibold">0.7 days (IQR 0–1) above 3 g/dL</span>. A few low-albumin blue
					outliers exist, but long-stayers (amber & red) become nearly three times more common once
					you cross that cliff.
				</li>
				<li>
					<strong>In emergencies, the “cliff” shifts upward to around 3.5 g/dL.</strong> Because
					urgent cases already carry extra risk, the median albumin threshold where ICU stays spike
					is higher. Below ~3.5 g/dL,
					<span class="font-semibold">the chance of ≥ 3-day ICU stay more than doubles</span> compared
					to those with albumin above 3.5 g/dL. The spread of dots is wider, but the colour gradient
					still tilts toward red as albumin drops.
				</li>
				<li>
					<strong>High-albumin (> 4 g/dL) patients rarely linger.</strong> Both elective and emergency
					groups show that when albumin is above 4 g/dL, almost no one spends over a day in the ICU.
					These high-protein outliers anchor the schedule’s “clockwork,” as promised in our opening hook.
				</li>
			</ul>

			<p>
				<b>Take-away →</b> Albumin isn’t a guarantee of trouble, but a <em>silent gravity well</em>:
				as this crucial protein dips, it becomes exponentially harder to climb off the ICU track.
				Even in seemingly routine electives, a low albumin check—below 3 g/dL—can foreshadow a
				multi-day ICU stay. And for urgent emergencies, that “cliff” sits even higher, around 3.5
				g/dL. This insight matters because it highlights a single lab value that’s easy to check
				pre-op yet often overlooked—reminding clinicians and patients alike that routine surgery can
				quickly become unpredictable when nutrition and reserves run low.
			</p>
		</section>

		<!-- 5 · High- vs Low-Risk Outcomes -------------------------------------------- -->
		<!-- <section class="my-16">
			<h2 class="mb-4 text-2xl font-semibold">The Big Contrast — High-Risk vs Low-Risk Patients</h2>
			<p class="mb-4 max-w-xl">
				The chart compares median outcomes for the sickest&nbsp;0.5 % of cases against the
				healthiest&nbsp;10 % of survivors. One polygon balloons, the other hugs the centre — showing
				how two patients in the same operating room can face radically different fates.
			</p>

			<RiskRadar patients={cases} />
		</section> -->

		<!-- The big contrast -->
		<!-- <section>
			<h2 class="mb-4 text-2xl font-semibold">The Big Contrast — High vs Routine Elective</h2>
			<p class="mb-6 max-w-xl">
				From our 6,388 surgeries, we've pulled the sickest 0.5% and the healthiest routine cases. This is where the story takes a turn: 
				blood loss rockets, ICU days triple, and mortality—not shown in the booking sheet—lurks behind that red dot. Hover any circle 
				for the raw median. <strong>Same operating room, entirely different fates.</strong> The data shows that even among elective cases, 
				small differences in pre-op status can cascade into dramatically different outcomes.
			</p>

			<RiskDumbbell patients={cases} />
		</section> -->

		<!-- 6 · Build Your Own Patient ------------------------------------------------- -->
		<section>
			<h2>Interactive Risk Builder</h2>
			<p class="mb-4 max-w-xl">
				Now it's your turn. Build a patient profile using the sliders below. Watch how tiny shifts—a
				single ASA notch or clicking 'Emergency'—can triple the mortality risk instantly. We'll show
				you how many similar historical cases we found, so you can trust the predictions. Try the
				"Make a Guess" mode to test your intuition against the data.
			</p>
			<BuildPatient {cases} bind:predictors />
		</section>

		<!-- 7 · Final Takeaway -------------------------------------------------------- -->
		<section class="text-center">
			<div class="mx-auto max-w-2xl rounded-lg bg-indigo-50 p-8">
				<h2 class="mb-4 text-2xl font-semibold text-indigo-900">The Takeaway</h2>
				<p class="text-lg text-indigo-800">
					The data reveals three critical insights: First, pre-op albumin levels—easily measured and
					often correctable—strongly predict ICU stays. Second, emergency status and ASA score
					interact in ways that standard checklists miss. And third, while we can't change age, we
					can optimize timing, prepare blood products, and adjust recovery expectations based on
					these risk factors. The data tells us where to look—before the knife ever touches skin.
				</p>
			</div>
		</section>
	</article>
{/if}

<style>
	:global(svg) {
		max-width: 100%;
	}
</style>
