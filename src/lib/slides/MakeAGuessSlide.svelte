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

<div class="container">
	{#if cases && cases.length > 0}
		<!-- Header Section -->
		<div class="controls-panel">
			<div class="controls-content">
				<h3>🧠 Test Your Knowledge</h3>
				<p class="subtitle">Based on the patient profile below, predict their likely outcomes. Consider factors like age, BMI, ASA score, and height when making your predictions.</p>
				
				<!-- Progress indicator -->
				<div class="progress-section">
					<div class="progress-stats">
						<span class="progress-item">Question {currentQuestionIndex + 1} of {patientProfiles.length}</span>
						<span class="progress-item">Average Score: {averageScore.toFixed(1)}%</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Patient Profile Section -->
		<div class="profile-panel">
			<h4>👤 Patient Profile</h4>
			<p class="profile-description">{currentProfile.description}</p>
			<div class="profile-grid">
				<div class="profile-item">
					<span class="profile-label">Age</span>
					<span class="profile-value">{currentProfile.age} years</span>
				</div>
				<div class="profile-item">
					<span class="profile-label">Height</span>
					<span class="profile-value">{cmToFeetInches(currentProfile.height).feet}' {cmToFeetInches(currentProfile.height).inches}"</span>
				</div>
				<div class="profile-item">
					<span class="profile-label">BMI</span>
					<span class="profile-value">{currentProfile.bmi}</span>
				</div>
				<div class="profile-item">
					<span class="profile-label">ASA Score</span>
					<span class="profile-value">{currentProfile.asa}</span>
				</div>
			</div>
		</div>

		<!-- Prediction Inputs -->
		<div class="prediction-panel">
			<h4>📊 Make Your Predictions</h4>
			<div class="prediction-grid">
				<div class="prediction-item">
					<label class="prediction-label">Predicted ICU Stay (days)</label>
					<input
						type="number"
						bind:value={userGuess.icuDays}
						min="0"
						step="0.1"
						class="prediction-input"
					/>
				</div>
				<div class="prediction-item">
					<label class="prediction-label">Predicted Mortality (%)</label>
					<input
						type="number"
						bind:value={userGuess.mortality}
						min="0"
						max="100"
						step="0.1"
						class="prediction-input"
					/>
				</div>
				<div class="prediction-item">
					<label class="prediction-label">Predicted Blood Loss (mL)</label>
					<input
						type="number"
						bind:value={userGuess.bloodLoss}
						min="0"
						step="1"
						class="prediction-input"
					/>
				</div>
			</div>

			{#if !showResults}
				<button
					class="check-button"
					on:click={checkAnswer}
					disabled={isLoading}
				>
					{#if isLoading}
						<div class="loading-content">
							<div class="loading-spinner"></div>
							<span>Calculating...</span>
						</div>
					{:else}
						Check Your Predictions
					{/if}
				</button>
			{:else}
				<!-- Results Section -->
				<div class="results-panel">
					<h4>📈 Actual Outcomes from Similar Cases</h4>
					<div class="outcomes-grid">
						<div class="outcome-card">
							<div class="outcome-icon">🏥</div>
							<div class="outcome-content">
								<span class="outcome-label">Average ICU Stay</span>
								<span class="outcome-value">{avgICUStay.toFixed(1)} days</span>
								<span class="outcome-range">IQR: {icuIQR.q1.toFixed(1)} - {icuIQR.q3.toFixed(1)} days</span>
							</div>
						</div>
						<div class="outcome-card">
							<div class="outcome-icon">💗</div>
							<div class="outcome-content">
								<span class="outcome-label">Mortality Rate</span>
								<span class="outcome-value">{(mortalityRate * 100).toFixed(1)}%</span>
								<div class="mortality-bar">
									<div class="mortality-fill" style="width: {(mortalityRate * 100)}%"></div>
								</div>
							</div>
						</div>
						<div class="outcome-card">
							<div class="outcome-icon">🩸</div>
							<div class="outcome-content">
								<span class="outcome-label">Average Blood Loss</span>
								<span class="outcome-value">{avgBloodLoss.toFixed(0)} mL</span>
								<span class="outcome-range">IQR: {bloodLossIQR.q1.toFixed(0)} - {bloodLossIQR.q3.toFixed(0)} mL</span>
							</div>
						</div>
					</div>

					<div class="accuracy-panel">
						<span class="accuracy-label">Your guess was {(percentileRank * 100).toFixed(1)}% accurate!</span>
						{#if percentileRank <= 0.25}
							<p class="accuracy-feedback poor">
								Your predictions were quite far from the actual outcomes. Consider reviewing the patient's risk factors more carefully.
							</p>
						{:else if percentileRank <= 0.5}
							<p class="accuracy-feedback fair">
								Your predictions were somewhat off. Try to consider how different factors might interact to affect outcomes.
							</p>
						{:else if percentileRank <= 0.75}
							<p class="accuracy-feedback good">
								Good predictions! You're getting better at understanding how patient characteristics influence outcomes.
							</p>
						{:else}
							<p class="accuracy-feedback excellent">
								Excellent predictions! You have a strong understanding of how patient factors correlate with surgical outcomes.
							</p>
						{/if}
					</div>

					{#if !isLastQuestion}
						<button class="next-button" on:click={nextQuestion}>
							Next Question
						</button>
					{:else}
						<div class="completion-panel">
							<div class="completion-card">
								<h3>🎉 Quiz Complete!</h3>
								<p>Your final average score: {averageScore.toFixed(1)}%</p>
							</div>
							<button class="reset-button" on:click={resetQuiz}>
								Try Again
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="loading">
			<div class="loading-spinner"></div>
			<p>Loading surgical data...</p>
		</div>
	{/if}
</div>

<style>
	/* Global styles */
	:global(body),
	:global(html) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow-x: hidden;
	}

	:global(body) {
		background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
	}

	.container {
		max-width: 100vw;
		margin: 0 auto;
		padding: 0.75rem;
		min-height: 100vh;
		height: 100vh;
		width: 100%;
		color: #f1f5f9;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		margin-top: -5vh;
	}

	.container > * {
		width: 100%;
		max-width: 1200px;
	}

	.controls-panel {
		background: rgba(30, 41, 59, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.controls-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.controls-panel h3 {
		margin: 0;
		color: #f1f5f9;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.subtitle {
		margin: 0;
		color: #94a3b8;
		font-size: 0.9rem;
	}

	.progress-section {
		border-top: 1px solid #475569;
		padding-top: 1rem;
	}

	.progress-stats {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.progress-item {
		font-size: 0.9rem;
		color: #94a3b8;
		font-weight: 600;
	}

	.profile-panel {
		background: rgba(30, 41, 59, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.profile-panel h4 {
		margin: 0 0 1rem 0;
		color: #f1f5f9;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.profile-description {
		margin: 0 0 1rem 0;
		color: #94a3b8;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.profile-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.profile-item {
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid #475569;
		border-radius: 8px;
		padding: 1rem;
		text-align: center;
		transition: transform 0.2s ease;
	}

	.profile-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		background: rgba(51, 65, 85, 0.5);
	}

	.profile-label {
		display: block;
		font-size: 0.8rem;
		color: #94a3b8;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.profile-value {
		display: block;
		font-size: 1.25rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.prediction-panel {
		background: rgba(30, 41, 59, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.prediction-panel h4 {
		margin: 0 0 1rem 0;
		color: #f1f5f9;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.prediction-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.prediction-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.prediction-label {
		font-size: 0.9rem;
		color: #94a3b8;
		font-weight: 600;
	}

	.prediction-input {
		padding: 0.75rem;
		border: 1px solid #475569;
		border-radius: 8px;
		background: rgba(51, 65, 85, 0.4);
		color: #f1f5f9;
		font-size: 1rem;
		transition: all 0.2s ease;
	}

	.prediction-input:focus {
		outline: none;
		border-color: #3b82f6;
		background: rgba(51, 65, 85, 0.6);
	}

	.prediction-input::placeholder {
		color: #64748b;
	}

	.check-button {
		background: #1e40af;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.check-button:hover:not(:disabled) {
		background: #1d4ed8;
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
	}

	.check-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.loading-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.results-panel {
		margin-top: 1.5rem;
	}

	.results-panel h4 {
		margin: 0 0 1rem 0;
		color: #f1f5f9;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.outcomes-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.outcome-card {
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid #475569;
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: transform 0.2s ease;
	}

	.outcome-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		background: rgba(51, 65, 85, 0.5);
	}

	.outcome-icon {
		font-size: 1.5rem;
		width: 3rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(59, 130, 246, 0.2);
		border-radius: 50%;
	}

	.outcome-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.outcome-label {
		font-size: 0.8rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.outcome-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.outcome-range {
		font-size: 0.75rem;
		color: #64748b;
	}

	.mortality-bar {
		width: 100%;
		height: 4px;
		background: rgba(51, 65, 85, 0.6);
		border-radius: 2px;
		overflow: hidden;
		margin-top: 0.25rem;
	}

	.mortality-fill {
		height: 100%;
		background: linear-gradient(90deg, #22c55e, #f59e0b, #ef4444);
		transition: width 0.3s ease;
	}

	.accuracy-panel {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid #334155;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.accuracy-label {
		display: block;
		font-size: 1rem;
		font-weight: 600;
		color: #f1f5f9;
		margin-bottom: 0.5rem;
	}

	.accuracy-feedback {
		margin: 0.5rem 0 0 0;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.accuracy-feedback.poor {
		color: #ef4444;
	}

	.accuracy-feedback.fair {
		color: #f59e0b;
	}

	.accuracy-feedback.good {
		color: #eab308;
	}

	.accuracy-feedback.excellent {
		color: #22c55e;
	}

	.next-button {
		background: #1e40af;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.next-button:hover {
		background: #1d4ed8;
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
	}

	.completion-panel {
		text-align: center;
	}

	.completion-card {
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid #22c55e;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
	}

	.completion-card h3 {
		margin: 0 0 0.5rem 0;
		color: #22c55e;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.completion-card p {
		margin: 0;
		color: #f1f5f9;
		font-size: 1rem;
	}

	.reset-button {
		background: #1e40af;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		width: 100%;
	}

	.reset-button:hover {
		background: #1d4ed8;
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #94a3b8;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #334155;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@media (max-width: 768px) {
		.container {
			padding: 0.5rem;
		}
		
		.profile-grid,
		.prediction-grid,
		.outcomes-grid {
			grid-template-columns: 1fr;
		}
		
		.progress-stats {
			flex-direction: column;
			gap: 0.5rem;
			align-items: flex-start;
		}
	}
</style>
