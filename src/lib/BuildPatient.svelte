<!-- File: src/lib/BuildPatient.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';

	interface SurgeryCase {
		caseid: string;
		age: number;
		sex: 'M' | 'F';
		bmi: number;
		height: number;
		department: string;
		asa: number;
		emergency: number;
		casestart: number;
		anestart: number;
		opstart: number;
		opend: number;
		dis: number;
		icu_days: number;
		intraop_ebl: number;
		death_inhosp: number;
		preop_htn: number;
		preop_dm: number;
	}

	interface Predictors {
		age: number;
		bmi: number;
		asa: number;
		height: number; // This will store height in cm internally
	}

	export let predictors!: Predictors;
	export let cases: SurgeryCase[] = [];

	// Game state
	let isGuessing = false;
	let userGuess = {
		icuDays: 0,
		mortality: 0,
		bloodLoss: 0
	};
	let showResults = false;
	let percentileRank = 0;
	let showOutcomes = false;

	// Filter toggles
	let activeFilters = {
		age: true,
		height: true,
		bmi: true,
		asa: true
	};

	// Height conversion functions
	function cmToFeetInches(cm: number): { feet: number; inches: number } {
		const totalInches = cm / 2.54;
		const feet = Math.floor(totalInches / 12);
		const inches = Math.round(totalInches % 12);
		return { feet, inches };
	}

	function feetInchesToCm(feet: number, inches: number): number {
		return Math.round((feet * 12 + inches) * 2.54);
	}

	// Height range in feet and inches
	const heightRangeFtIn = {
		min: { feet: 4, inches: 5 },
		max: { feet: 7, inches: 5 }
	};

	// Convert to cm for internal use
	$: heightRange = {
		min: feetInchesToCm(heightRangeFtIn.min.feet, heightRangeFtIn.min.inches),
		max: feetInchesToCm(heightRangeFtIn.max.feet, heightRangeFtIn.max.inches)
	};

	$: ageRange =
		cases.length > 0
			? { min: Math.min(...cases.map((c) => c.age)), max: Math.max(...cases.map((c) => c.age)) }
			: { min: 0, max: 0 };
	$: bmiRange =
		cases.length > 0
			? { min: Math.min(...cases.map((c) => c.bmi)), max: Math.max(...cases.map((c) => c.bmi)) }
			: { min: 0, max: 0 };
	$: asaValues = cases.length > 0 ? [...new Set(cases.map((c) => c.asa))].sort() : [];

	let avgICUStay = 0;
	let mortalityRate = 0;
	let avgBloodLoss = 0;
	let matchingCasesCount = 0;
	let icuIQR = { q1: 0, q3: 0 };
	let bloodLossIQR = { q1: 0, q3: 0 };

	// Calculate percentile rank for user's guess
	function calculatePercentileRank(guess: number, actual: number, allValues: number[]): number {
		const sorted = [...allValues].sort((a, b) => a - b);
		const actualRank = sorted.indexOf(actual);
		const guessRank = sorted.indexOf(guess);
		return Math.abs(actualRank - guessRank) / sorted.length;
	}

	// Single reactive block to handle all calculations
	$: {
		if (cases.length > 0) {
			// Calculate matches with similarity criteria
			const ageMatches = activeFilters.age 
				? cases.filter((c) => Math.abs(c.age - predictors.age) <= 5)
				: cases;
			const bmiMatches = activeFilters.bmi
				? cases.filter((c) => Math.abs(c.bmi - predictors.bmi) <= 5)
				: cases;
			const heightMatches = activeFilters.height
				? cases.filter((c) => Math.abs(c.height - predictors.height) <= 5.08) // 2 inches in cm
				: cases;
			const asaMatches = activeFilters.asa
				? cases.filter((c) => Math.abs(c.asa - predictors.asa) <= 2)
				: cases;

			const ageAndBmi = ageMatches.filter((c) => bmiMatches.includes(c));
			const ageBmiAndHeight = ageAndBmi.filter((c) => heightMatches.includes(c));
			const finalMatches = ageBmiAndHeight.filter((c) => asaMatches.includes(c));

			matchingCasesCount = finalMatches.length;

			// Calculate stats
			if (finalMatches.length > 0) {
				// ICU days calculations
				const icuValues = finalMatches
					.map((c) => Number(c.icu_days))
					.filter((v) => !isNaN(v))
					.sort((a, b) => a - b);
				avgICUStay = icuValues.reduce((a, b) => a + b, 0) / icuValues.length;
				icuIQR = {
					q1: icuValues[Math.floor(icuValues.length * 0.25)],
					q3: icuValues[Math.floor(icuValues.length * 0.75)]
				};

				// Mortality calculations
				mortalityRate = finalMatches.reduce((sum, case_) => sum + (case_.death_inhosp || 0), 0) / finalMatches.length;

				// Blood loss calculations
				const bloodLossValues = finalMatches
					.map((c) => Number(c.intraop_ebl))
					.filter((v) => !isNaN(v))
					.sort((a, b) => a - b);
				avgBloodLoss = bloodLossValues.reduce((a, b) => a + b, 0) / bloodLossValues.length;
				bloodLossIQR = {
					q1: bloodLossValues[Math.floor(bloodLossValues.length * 0.25)],
					q3: bloodLossValues[Math.floor(bloodLossValues.length * 0.75)]
				};

				// Calculate percentile rank if in guessing mode
				if (isGuessing && showResults) {
					const icuPercentile = calculatePercentileRank(userGuess.icuDays, avgICUStay, icuValues);
					const mortalityPercentile = calculatePercentileRank(userGuess.mortality, mortalityRate, finalMatches.map(c => c.death_inhosp));
					const bloodLossPercentile = calculatePercentileRank(userGuess.bloodLoss, avgBloodLoss, bloodLossValues);
					percentileRank = (icuPercentile + mortalityPercentile + bloodLossPercentile) / 3;
				}
			} else {
				avgICUStay = 0;
				mortalityRate = 0;
				avgBloodLoss = 0;
				icuIQR = { q1: 0, q3: 0 };
				bloodLossIQR = { q1: 0, q3: 0 };
			}
		}
	}

	function startGuessing() {
		isGuessing = true;
		showResults = false;
		showOutcomes = false;
		userGuess = {
			icuDays: 0,
			mortality: 0,
			bloodLoss: 0
		};
	}

	// ASA color mapping
	const asaColors = {
		1: '#22c55e', // green
		2: '#a3e635', // greenish yellow
		3: '#eab308', // yellow
		4: '#f97316', // orange
		5: '#ef4444'  // red
	};

	// Calculate stick figure dimensions based on height
	$: figureScale = (predictors.height - heightRange.min) / (heightRange.max - heightRange.min);
	$: figureHeight = 250 + (figureScale * 150); // Base height 250px, can grow up to 400px

	// Calculate stick thickness based on BMI
	$: stickThickness = 2 + (predictors.bmi - bmiRange.min) / (bmiRange.max - bmiRange.min) * 4; // 2px to 6px
	
	// Calculate stomach size based on BMI
	$: stomachScale = (predictors.bmi - bmiRange.min) / (bmiRange.max - bmiRange.min);
	$: stomachWidth = 10 + (stomachScale * 25); // 10px to 35px
	$: stomachHeight = figureHeight * 0.2; // Constant height

	// Calculate hair whiteness based on age
	$: hairColor = `rgb(${(predictors.age - ageRange.min) / (ageRange.max - ageRange.min) * 255}, ${(predictors.age - ageRange.min) / (ageRange.max - ageRange.min) * 255}, ${(predictors.age - ageRange.min) / (ageRange.max - ageRange.min) * 255})`;

	// Calculate ASA color
	$: asaColor = asaColors[predictors.asa as keyof typeof asaColors] || asaColors[1];

	// Function to get active filter count
	$: activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
	$: activeFilterText = activeFilterCount === 4 
		? "all filters" 
		: `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`;
</script>

<div class="space-y-6 rounded-lg bg-gray-50 p-4">
	<div class="flex gap-8">
		<!-- Left side: Sliders -->
		<div class="flex-1 space-y-6">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold">Adjust Patient Profile</h3>
				<div class="flex items-center gap-2 text-sm text-gray-600">
					<span>Active: {activeFilterText}</span>
				</div>
			</div>
			
			<!-- Filter Toggles -->
			<div class="grid grid-cols-2 gap-4">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={activeFilters.age}
						class="rounded border-gray-300"
					/>
					<span class="text-sm">Age Filter</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={activeFilters.height}
						class="rounded border-gray-300"
					/>
					<span class="text-sm">Height Filter</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={activeFilters.bmi}
						class="rounded border-gray-300"
					/>
					<span class="text-sm">BMI Filter</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={activeFilters.asa}
						class="rounded border-gray-300"
					/>
					<span class="text-sm">ASA Filter</span>
				</label>
			</div>
			
			<!-- Sliders -->
			<div class="space-y-6">
				<div class={activeFilters.age ? '' : 'opacity-50'}>
					<label class="block text-sm text-gray-600">Age: {predictors.age} years</label>
					<input
						type="range"
						bind:value={predictors.age}
						min={ageRange.min}
						max={ageRange.max}
						class="w-full"
						disabled={!activeFilters.age}
					/>
					<p class="text-xs text-gray-500">Range: {ageRange.min} - {ageRange.max} years</p>
				</div>

				<div class={activeFilters.height ? '' : 'opacity-50'}>
					<label class="block text-sm text-gray-600">
						Height: {cmToFeetInches(predictors.height).feet}' {cmToFeetInches(predictors.height).inches}"
					</label>
					<input
						type="range"
						bind:value={predictors.height}
						min={heightRange.min}
						max={heightRange.max}
						class="w-full"
						disabled={!activeFilters.height}
					/>
					<p class="text-xs text-gray-500">
						Range: {heightRangeFtIn.min.feet}'{heightRangeFtIn.min.inches}" - {heightRangeFtIn.max.feet}'{heightRangeFtIn.max.inches}"
					</p>
				</div>

				<div class={activeFilters.bmi ? '' : 'opacity-50'}>
					<label class="block text-sm text-gray-600">BMI: {predictors.bmi}</label>
					<input
						type="range"
						bind:value={predictors.bmi}
						min={bmiRange.min}
						max={bmiRange.max}
						step="0.1"
						class="w-full"
						disabled={!activeFilters.bmi}
					/>
					<p class="text-xs text-gray-500">Range: {bmiRange.min.toFixed(1)} - {bmiRange.max.toFixed(1)}</p>
				</div>

				<div class={activeFilters.asa ? '' : 'opacity-50'}>
					<label class="block text-sm text-gray-600">ASA Score: {predictors.asa}</label>
					<input
						type="range"
						bind:value={predictors.asa}
						min="1"
						max="5"
						step="1"
						class="w-full"
						disabled={!activeFilters.asa}
					/>
					<p class="text-xs text-gray-500">
						ASA {predictors.asa}: {
							predictors.asa === 1
								? 'Healthy patient'
								: predictors.asa === 2
								? 'Mild systemic disease'
								: predictors.asa === 3
								? 'Severe systemic disease'
								: predictors.asa === 4
								? 'Severe systemic disease that is a constant threat to life'
								: 'Moribund patient not expected to survive without the operation'
						}
					</p>
				</div>
			</div>
		</div>

		<!-- Right side: Stick Figure -->
		<div class="flex-1 flex items-center justify-center">
			<svg
				viewBox="0 0 200 {figureHeight}"
				class="w-full h-full"
				style="min-height: 350px; max-height: 500px;"
			>
				<!-- Head -->
				<circle
					cx="100"
					cy="30"
					r="20"
					fill={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.asa ? 1 : 0.5}
				/>

				<!-- Body -->
				<line
					x1="100"
					y1="50"
					x2="100"
					y2={figureHeight * 0.6}
					stroke={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.asa ? 1 : 0.5}
				/>

				<!-- Stomach -->
				<ellipse
					cx="100"
					cy={figureHeight * 0.45}
					rx={stomachWidth}
					ry={stomachHeight}
					fill={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.bmi ? 1 : 0.5}
				/>

				<!-- Arms -->
				<line
					x1="100"
					y1="80"
					x2={60 - Math.max(0, stomachWidth - 20)}
					y2={figureHeight * 0.4}
					stroke={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.asa ? 1 : 0.5}
				/>
				<line
					x1="100"
					y1="80"
					x2={140 + Math.max(0, stomachWidth - 20)}
					y2={figureHeight * 0.4}
					stroke={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.asa ? 1 : 0.5}
				/>

				<!-- Legs -->
				<line
					x1="100"
					y1={figureHeight * 0.6}
					x2="70"
					y2={figureHeight * 0.9}
					stroke={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.asa ? 1 : 0.5}
				/>
				<line
					x1="100"
					y1={figureHeight * 0.6}
					x2="130"
					y2={figureHeight * 0.9}
					stroke={asaColor}
					stroke-width={stickThickness}
					opacity={activeFilters.asa ? 1 : 0.5}
				/>

				<!-- Hair (moved to end to appear on top) -->
				<path
					d="M80,20 Q100,0 120,20"
					fill="none"
					stroke={hairColor}
					stroke-width={stickThickness * 1.5}
					opacity={activeFilters.age ? 1 : 0.5}
				/>
			</svg>
		</div>
	</div>

	<!-- Similarity Bar -->
	<div class="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-800">
		Found {matchingCasesCount} historical patients within {
			[
				activeFilters.age && '±5 years age',
				activeFilters.height && '±2 inches height',
				activeFilters.bmi && '±5 BMI',
				activeFilters.asa && '±2 ASA score'
			].filter(Boolean).join(', ')
		}
	</div>

	<div class="mt-4 flex space-x-4">
		{#if !isGuessing}
			<button
				class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				on:click={startGuessing}
			>
				Make a Guess
			</button>
		{:else}
			<button
				class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				on:click={() => {
					isGuessing = false;
					showResults = false;
					showOutcomes = false;
				}}
			>
				Back
			</button>
		{/if}

		<button
			class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
			on:click={() => {
				showOutcomes = !showOutcomes;
				if (isGuessing) {
					showResults = true;
				}
			}}
		>
			{showOutcomes ? 'Hide Outcomes' : 'Show Outcomes'}
		</button>
	</div>

	{#if isGuessing}
		<div class="mt-6 space-y-4">
			<h3 class="text-lg font-semibold">Make Your Predictions</h3>
			<div class="grid gap-4">
				<div>
					<label class="block text-sm text-gray-600">Predicted ICU Stay (days)</label>
					<input
						type="number"
						bind:value={userGuess.icuDays}
						min="0"
						step="0.1"
						class="mt-1 w-full rounded border p-2"
					/>
				</div>
				<div>
					<label class="block text-sm text-gray-600">Predicted Mortality (%)</label>
					<input
						type="number"
						bind:value={userGuess.mortality}
						min="0"
						max="100"
						step="0.1"
						class="mt-1 w-full rounded border p-2"
					/>
				</div>
				<div>
					<label class="block text-sm text-gray-600">Predicted Blood Loss (mL)</label>
					<input
						type="number"
						bind:value={userGuess.bloodLoss}
						min="0"
						step="1"
						class="mt-1 w-full rounded border p-2"
					/>
				</div>
			</div>
		</div>
	{/if}

	{#if (!isGuessing || showResults) && showOutcomes}
		<h3 class="mt-6 text-lg font-semibold">Outcomes from Similar Cases</h3>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<p class="text-sm text-gray-600">Average ICU Stay</p>
				<p class="font-medium">{avgICUStay.toFixed(1)} days</p>
				<p class="text-xs text-gray-500">
					IQR: {icuIQR.q1.toFixed(1)} - {icuIQR.q3.toFixed(1)} days
				</p>
			</div>
			<div>
				<p class="text-sm text-gray-600">Mortality Rate</p>
				<div
					class="h-2 w-full rounded-full"
					style="background: linear-gradient(to right, #22c55e, #ef4444)"
				/>
				<p class="font-medium">{(mortalityRate * 100).toFixed(1)}%</p>
			</div>
			<div>
				<p class="text-sm text-gray-600">Average Blood Loss</p>
				<p class="font-medium">{avgBloodLoss.toFixed(0)} mL</p>
				<p class="text-xs text-gray-500">
					IQR: {bloodLossIQR.q1.toFixed(0)} - {bloodLossIQR.q3.toFixed(0)} mL
				</p>
			</div>
		</div>

		{#if isGuessing && showResults}
			<div class="mt-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
				Your guess was within the {((1 - percentileRank) * 100).toFixed(1)}th percentile of accuracy!
			</div>
		{/if}
	{/if}
</div>

