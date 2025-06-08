<script lang="ts">
	import { onMount } from 'svelte';
	import {
		predictionsWereMade,
		usePredictions,
		usePredictionsDisabled
	} from '../../stores/predictions.svelte';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();

	let predictors = $state({ age: 60, bmi: 25, asa: 2, emergency: 0, height: 170 });

	// Game state
	let userGuess = {
		icuDays: 0,
		mortality: 0,
		bloodLoss: 0
	};

	// Calculate accuracy score for a prediction
	function calculateAccuracyScore(guess: number, actual: number, allValues: number[]): number {
		// Handle zero or very small values
		if (actual === 0 && guess === 0) return 1;
		if (actual === 0 || guess === 0) return 0;

		// Calculate relative error
		const relativeError = Math.abs(guess - actual) / Math.max(actual, 1);

		// Convert to accuracy score (1 - normalized error)
		// Using exponential decay to make it more sensitive to differences
		return Math.exp(-relativeError);
	}

	// Calculate outcomes based on similar cases
	$effect(() => {
		if (cases.length > 0) {
			// Calculate matches with similarity criteria
			const ageMatches = cases.filter((c) => Math.abs(c.age - predictors.age) <= 5);
			const bmiMatches = cases.filter((c) => Math.abs(c.bmi - predictors.bmi) <= 5);
			const heightMatches = cases.filter((c) => Math.abs(c.height - predictors.height) <= 5.08); // 2 inches in cm
			const asaMatches = cases.filter((c) => Math.abs(c.asa - predictors.asa) <= 2);

			const ageAndBmi = ageMatches.filter((c) => bmiMatches.includes(c));
			const ageBmiAndHeight = ageAndBmi.filter((c) => heightMatches.includes(c));
			const finalMatches = ageBmiAndHeight.filter((c) => asaMatches.includes(c));

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
				mortalityRate =
					finalMatches.reduce((sum, case_) => sum + (case_.death_inhosp || 0), 0) /
					finalMatches.length;

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

				// Calculate accuracy if showing results
				if (showResults) {
					const icuAccuracy = calculateAccuracyScore(userGuess.icuDays, avgICUStay, icuValues);
					const mortalityAccuracy = calculateAccuracyScore(
						userGuess.mortality,
						mortalityRate * 100,
						finalMatches.map((c) => c.death_inhosp * 100)
					);
					const bloodLossAccuracy = calculateAccuracyScore(
						userGuess.bloodLoss,
						avgBloodLoss,
						bloodLossValues
					);

					// Weight the accuracies
					percentileRank = icuAccuracy * 0.4 + mortalityAccuracy * 0.3 + bloodLossAccuracy * 0.3;
				}
			} else {
				avgICUStay = 0;
				mortalityRate = 0;
				avgBloodLoss = 0;
				icuIQR = { q1: 0, q3: 0 };
				bloodLossIQR = { q1: 0, q3: 0 };
			}
		}
	});

	const actualPredictions = usePredictions();

	onMount(() => {});
	const predictionsDisabled = usePredictionsDisabled();
</script>

<div class="space-y-6 rounded-lg bg-gray-50 p-4">
	<h2 class="text-2xl font-bold">Make Your Predictions</h2>
	<p class="text-gray-600">
		Based on the patient profile you've built, predict their likely outcomes. Consider factors like
		age, BMI, ASA score, and height when making your predictions.
	</p>

	<div class="mt-6 space-y-4">
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

		{#if yesPredictionsWereMade}
			<button
				class="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				on:click={() => (showResults = true)}
			>
				Check Your Predictions
			</button>
		{:else}
			<p class="mt-2 text-sm text-gray-500">You did not set up your risk profile yet.</p>
		{/if}
	</div>

	{#if showResults}
		<div class="mt-6 space-y-4">
			<h3 class="text-lg font-semibold">Actual Outcomes from Similar Cases</h3>
			<div class="grid grid-cols-3 gap-4">
				<div>
					<p class="text-sm text-gray-600">Average ICU Stay</p>
					<p class="font-medium">{actualPredictions.avgICUStay.toFixed(1)} days</p>
					<p class="text-xs text-gray-500">
						IQR: {actualPredictions.icuIQR.q1.toFixed(1)} - {actualPredictions.icuIQR.q3.toFixed(1)}
						days
					</p>
				</div>
				<div>
					<p class="text-sm text-gray-600">Mortality Rate</p>
					<div
						class="h-2 w-full rounded-full"
						style="background: linear-gradient(to right, #22c55e, #ef4444)"
					/>
					<p class="font-medium">{(actualPredictions.mortalityRate * 100).toFixed(1)}%</p>
				</div>
				<div>
					<p class="text-sm text-gray-600">Average Blood Loss</p>
					<p class="font-medium">{actualPredictions.avgBloodLoss.toFixed(0)} mL</p>
					<p class="text-xs text-gray-500">
						IQR: {actualPredictions.bloodLossIQR.q1.toFixed(0)} - {actualPredictions.bloodLossIQR.q3.toFixed(
							0
						)} mL
					</p>
				</div>
			</div>

			<div class="mt-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
				Your guess was {(percentileRank * 100).toFixed(1)}% accurate!
				{#if percentileRank <= 0.25}
					<p class="mt-2 text-red-600">
						Your predictions were quite far from the actual outcomes. Consider reviewing the
						patient's risk factors more carefully.
					</p>
				{:else if percentileRank <= 0.5}
					<p class="mt-2 text-orange-600">
						Your predictions were somewhat off. Try to consider how different factors might interact
						to affect outcomes.
					</p>
				{:else if percentileRank <= 0.75}
					<p class="mt-2 text-yellow-600">
						Good predictions! You're getting better at understanding how patient characteristics
						influence outcomes.
					</p>
				{:else}
					<p class="mt-2 text-green-600">
						Excellent predictions! You have a strong understanding of how patient factors correlate
						with surgical outcomes.
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
