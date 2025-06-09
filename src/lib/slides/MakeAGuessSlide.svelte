<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getMatchingCases,
		calculateOutcomes,
		calculateAccuracyScore
	} from '$lib/utils/patientCalculations';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();

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

	// Define preset patient profiles for the quiz
	const patientProfiles = [
		{
			age: 45,
			bmi: 22,
			asa: 1,
			height: 175,
			description: 'A healthy middle-aged patient with normal BMI'
		},
		{
			age: 75,
			bmi: 32,
			asa: 3,
			height: 165,
			description: 'An elderly patient with obesity and severe systemic disease'
		},
		{
			age: 60,
			bmi: 28,
			asa: 2,
			height: 170,
			description: 'A patient with mild systemic disease and slightly elevated BMI'
		}
	];

	// Game state
	let currentQuestionIndex = $state(0);
	let showResults = $state(false);
	let percentileRank = $state(0);
	let totalScore = $state(0);
	let questionsAnswered = $state(0);
	let isLoading = $state(false);

	let userGuess = $state({
		icuDays: 0,
		mortality: 0,
		bloodLoss: 0
	});

	// Stats for current question
	let avgICUStay = $state(0);
	let mortalityRate = $state(0);
	let avgBloodLoss = $state(0);
	let icuIQR = $state({ q1: 0, q3: 0 });
	let bloodLossIQR = $state({ q1: 0, q3: 0 });
	let matchingCasesCount = $state(0);

	// Cache for matching cases to avoid recalculation
	let matchingCasesCache = $state<Map<number, SurgeryCase[]>>(new Map());

	function checkAnswer() {
		if (showResults) return;

		// Get current patient profile
		const currentProfile = patientProfiles[currentQuestionIndex];

		// Get matching cases using shared function
		const finalMatches = getMatchingCases(cases, currentProfile);
		matchingCasesCount = finalMatches.length;

		// Calculate outcomes using shared function
		const outcomes = calculateOutcomes(finalMatches);

		// Update state variables with calculated outcomes
		avgICUStay = outcomes.avgICUStay;
		mortalityRate = outcomes.mortalityRate;
		avgBloodLoss = outcomes.avgBloodLoss;
		icuIQR = outcomes.icuIQR;
		bloodLossIQR = outcomes.bloodLossIQR;

		// Calculate accuracy using shared function
		const icuAccuracy = calculateAccuracyScore(
			userGuess.icuDays,
			outcomes.avgICUStay,
			outcomes.icuValues
		);
		const mortalityAccuracy = calculateAccuracyScore(
			userGuess.mortality,
			outcomes.mortalityRate * 100,
			finalMatches.map((c) => (c.death_inhosp ?? 0) * 100)
		);
		const bloodLossAccuracy = calculateAccuracyScore(
			userGuess.bloodLoss,
			outcomes.avgBloodLoss,
			outcomes.bloodLossValues
		);

		// Weight the accuracies
		percentileRank = icuAccuracy * 0.4 + mortalityAccuracy * 0.3 + bloodLossAccuracy * 0.3;

		// Update total score and questions answered
		totalScore += percentileRank;
		questionsAnswered++;

		// Show results
		showResults = true;
	}

	function nextQuestion() {
		if (currentQuestionIndex < patientProfiles.length - 1) {
			currentQuestionIndex++;
			showResults = false;
			userGuess = {
				icuDays: 0,
				mortality: 0,
				bloodLoss: 0
			};
		}
	}

	function resetQuiz() {
		currentQuestionIndex = 0;
		showResults = false;
		totalScore = 0;
		questionsAnswered = 0;
		userGuess = {
			icuDays: 0,
			mortality: 0,
			bloodLoss: 0
		};
		matchingCasesCache.clear();
	}

	let currentProfile = $derived(patientProfiles[currentQuestionIndex]);
	let isLastQuestion = $derived(currentQuestionIndex === patientProfiles.length - 1);
	let averageScore = $derived(questionsAnswered > 0 ? (totalScore / questionsAnswered) * 100 : 0);
</script>

<div class="space-y-6 rounded-lg bg-gray-50 p-4">
	<h2 class="text-2xl font-bold">Test Your Knowledge</h2>
	<p class="text-gray-600">
		Based on the patient profile below, predict their likely outcomes. Consider factors like age,
		BMI, ASA score, and height when making your predictions.
	</p>

	<!-- Progress indicator -->
	<div class="flex items-center justify-between text-sm text-gray-600">
		<span>Question {currentQuestionIndex + 1} of {patientProfiles.length}</span>
		<span>Average Score: {averageScore.toFixed(1)}%</span>
	</div>

	<!-- Current patient profile -->
	<div class="mt-4 rounded-lg bg-white p-4 shadow-sm">
		<h3 class="mb-2 text-lg font-semibold text-gray-900">Patient Profile</h3>
		<p class="mb-4 text-gray-700">{currentProfile.description}</p>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div>
				<p class="text-sm text-gray-600">Age</p>
				<p class="font-medium text-gray-900">{currentProfile.age} years</p>
			</div>
			<div>
				<p class="text-sm text-gray-600">Height</p>
				<p class="font-medium text-gray-900">
					{cmToFeetInches(currentProfile.height).feet}' {cmToFeetInches(currentProfile.height)
						.inches}"
				</p>
			</div>
			<div>
				<p class="text-sm text-gray-600">BMI</p>
				<p class="font-medium text-gray-900">{currentProfile.bmi}</p>
			</div>
			<div>
				<p class="text-sm text-gray-600">ASA Score</p>
				<p class="font-medium text-gray-900">{currentProfile.asa}</p>
			</div>
		</div>
	</div>

	<!-- Prediction inputs -->
	<div class="mt-6 space-y-4">
		<div class="grid gap-4">
			<div>
				<label class="block text-sm text-gray-600">Predicted ICU Stay (days)</label>
				<input
					type="number"
					bind:value={userGuess.icuDays}
					min="0"
					step="0.1"
					class="mt-1 w-full rounded border p-2 text-gray-900"
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
					class="mt-1 w-full rounded border p-2 text-gray-900"
				/>
			</div>
			<div>
				<label class="block text-sm text-gray-600">Predicted Blood Loss (mL)</label>
				<input
					type="number"
					bind:value={userGuess.bloodLoss}
					min="0"
					step="1"
					class="mt-1 w-full rounded border p-2 text-gray-900"
				/>
			</div>
		</div>

		{#if !showResults}
			<button
				class="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
				on:click={checkAnswer}
				disabled={isLoading}
			>
				{#if isLoading}
					<div class="flex items-center gap-2">
						<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						<span>Calculating...</span>
					</div>
				{:else}
					Check Your Predictions
				{/if}
			</button>
		{:else}
			<div class="mt-6 space-y-4">
				<h3 class="text-lg font-semibold text-gray-900">Actual Outcomes from Similar Cases</h3>
				<div class="grid grid-cols-3 gap-4">
					<div>
						<p class="text-sm text-gray-600">Average ICU Stay</p>
						<p class="font-medium text-gray-900">{avgICUStay.toFixed(1)} days</p>
						<p class="text-xs text-gray-600">
							IQR: {icuIQR.q1.toFixed(1)} - {icuIQR.q3.toFixed(1)} days
						</p>
					</div>
					<div>
						<p class="text-sm text-gray-600">Mortality Rate</p>
						<div
							class="h-2 w-full rounded-full"
							style="background: linear-gradient(to right, #22c55e, #ef4444)"
						/>
						<p class="font-medium text-gray-900">{(mortalityRate * 100).toFixed(1)}%</p>
					</div>
					<div>
						<p class="text-sm text-gray-600">Average Blood Loss</p>
						<p class="font-medium text-gray-900">{avgBloodLoss.toFixed(0)} mL</p>
						<p class="text-xs text-gray-600">
							IQR: {bloodLossIQR.q1.toFixed(0)} - {bloodLossIQR.q3.toFixed(0)} mL
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
							Your predictions were somewhat off. Try to consider how different factors might
							interact to affect outcomes.
						</p>
					{:else if percentileRank <= 0.75}
						<p class="mt-2 text-yellow-600">
							Good predictions! You're getting better at understanding how patient characteristics
							influence outcomes.
						</p>
					{:else}
						<p class="mt-2 text-green-600">
							Excellent predictions! You have a strong understanding of how patient factors
							correlate with surgical outcomes.
						</p>
					{/if}
				</div>

				{#if !isLastQuestion}
					<button
						class="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
						on:click={nextQuestion}
					>
						Next Question
					</button>
				{:else}
					<div class="mt-4 space-y-4">
						<div class="rounded bg-green-50 p-4 text-center">
							<h3 class="text-lg font-semibold text-green-800">Quiz Complete!</h3>
							<p class="mt-2 text-green-700">
								Your final average score: {averageScore.toFixed(1)}%
							</p>
						</div>
						<button
							class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
							on:click={resetQuiz}
						>
							Try Again
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
