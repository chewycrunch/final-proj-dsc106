<!-- File: src/lib/BuildPatient.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';

	export interface Predictors {
		age: number;
		bmi: number;
		asa: number;
		emergency: number;
	}

	export let predictors!: Predictors;

	$: riskICU = 0.1 * predictors.age + 0.5 * predictors.asa + 2 * predictors.emergency + 0.05 * Math.abs(predictors.bmi - 25);
	
	// Age-based mortality risk using a sigmoid-like function
	$: ageRisk = Math.pow(predictors.age / 50, 2) * 0.02; // Quadratic increase with age
	$: riskMort = Math.min(
		1,
		ageRisk + 0.1 * predictors.emergency + 0.05 * (predictors.asa - 1) + 0.01 * Math.abs(predictors.bmi - 25)
	);
</script>

<div class="space-y-6 p-4 bg-gray-50 rounded-lg">
	<h3 class="text-lg font-semibold">Current Filters</h3>
	<div class="grid grid-cols-2 gap-4">
		<div>
			<p class="text-sm text-gray-600">Age</p>
			<p class="font-medium">{predictors.age} years</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">BMI</p>
			<p class="font-medium">{predictors.bmi}</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">ASA Score</p>
			<p class="font-medium">{predictors.asa}</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">Emergency Case</p>
			<p class="font-medium">{predictors.emergency ? 'Yes' : 'No'}</p>
		</div>
	</div>

	<h3 class="text-lg font-semibold mt-6">Predicted Outcomes</h3>
	<div class="grid grid-cols-2 gap-4">
		<div>
			<p class="text-sm text-gray-600">Predicted ICU Stay</p>
			<p class="font-medium">{riskICU.toFixed(1)} days</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">Predicted Mortality</p>
			<p class="font-medium">{(riskMort * 100).toFixed(1)}%</p>
		</div>
	</div>
</div>
