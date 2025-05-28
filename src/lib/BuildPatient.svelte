<!-- File: src/lib/BuildPatient.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';

	export interface Predictors {
		age: number;
		bmi: number;
		asa: number;
		emergency: number;
	}

	export interface SurgeryCase {
		caseid: string;
		age: number;
		department: string;
		casestart: number;
		anestart: number;
		opstart: number;
		opend: number;
		dis: number;
		icu_days: number;
		intraop_ebl: number;
		death_inhosp: number;
		bmi: number;
		asa: number;
		emergency: number;
	}

	export let predictors!: Predictors;
	export let cases: SurgeryCase[] = [];

	$: ageRange = cases.length > 0 
		? { min: Math.min(...cases.map(c => c.age)), max: Math.max(...cases.map(c => c.age)) }
		: { min: 0, max: 0 };
	$: bmiRange = cases.length > 0
		? { min: Math.min(...cases.map(c => c.bmi)), max: Math.max(...cases.map(c => c.bmi)) }
		: { min: 0, max: 0 };
	$: asaValues = cases.length > 0
		? [...new Set(cases.map(c => c.asa))].sort()
		: [];
	$: emergencyValues = cases.length > 0
		? [...new Set(cases.map(c => c.emergency).filter(v => !isNaN(v)))].sort()
		: [];

	let avgICUStay = 0;
	let mortalityRate = 0;
	let avgBloodLoss = 0;
	let matchingCasesCount = 0;

	// Single reactive block to handle all calculations
	$: {
		if (cases.length > 0) {
			// Calculate matches
			const ageMatches = cases.filter(c => Math.abs(c.age - predictors.age) <= 10);
			const bmiMatches = cases.filter(c => Math.abs(c.bmi - predictors.bmi) <= 5);
			const asaMatches = cases.filter(c => c.asa === predictors.asa);
			const emergencyMatches = cases.filter(c => !isNaN(c.emergency) && c.emergency === predictors.emergency);

			const ageAndBmi = ageMatches.filter(c => bmiMatches.includes(c));
			const ageAndBmiAndAsa = ageAndBmi.filter(c => asaMatches.includes(c));
			const finalMatches = ageAndBmiAndAsa.filter(c => emergencyMatches.includes(c));

			matchingCasesCount = finalMatches.length;

			// Calculate stats
			if (finalMatches.length > 0) {
				const icuSum = finalMatches.reduce((sum, case_) => {
					const icuValue = Number(case_.icu_days);
					return sum + (isNaN(icuValue) ? 0 : icuValue);
				}, 0);

				avgICUStay = Math.max(0, icuSum / finalMatches.length);
				mortalityRate = Math.max(0, finalMatches.reduce((sum, case_) => sum + (case_.death_inhosp || 0), 0) / finalMatches.length);
				avgBloodLoss = Math.max(0, finalMatches.reduce((sum, case_) => sum + (case_.intraop_ebl || 0), 0) / finalMatches.length);
			} else {
				avgICUStay = 0;
				mortalityRate = 0;
				avgBloodLoss = 0;
			}
		}
	}
</script>

<div class="space-y-6 p-4 bg-gray-50 rounded-lg">
	<h3 class="text-lg font-semibold">Current Filters</h3>
	<div class="grid grid-cols-2 gap-4">
		<div>
			<p class="text-sm text-gray-600">Age</p>
			<p class="font-medium">{predictors.age} years</p>
			<p class="text-xs text-gray-500">Range in data: {ageRange.min} - {ageRange.max}</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">BMI</p>
			<p class="font-medium">{predictors.bmi}</p>
			<p class="text-xs text-gray-500">Range in data: {bmiRange.min.toFixed(1)} - {bmiRange.max.toFixed(1)}</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">ASA Score</p>
			<p class="font-medium">{predictors.asa}</p>
			<p class="text-xs text-gray-500">Available values: {asaValues.join(', ')}</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">Emergency Case</p>
			<p class="font-medium">{predictors.emergency === 1 ? 'Yes' : 'No'}</p>
			<p class="text-xs text-gray-500">Available values: {emergencyValues.join(', ')}</p>
		</div>
	</div>

	<h3 class="text-lg font-semibold mt-6">Outcomes from Similar Cases</h3>
	<div class="grid grid-cols-3 gap-4">
		<div>
			<p class="text-sm text-gray-600">Average ICU Stay</p>
			<p class="font-medium">{avgICUStay.toFixed(1)} days</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">Mortality Rate</p>
			<p class="font-medium">{(mortalityRate * 100).toFixed(1)}%</p>
		</div>
		<div>
			<p class="text-sm text-gray-600">Average Blood Loss</p>
			<p class="font-medium">{avgBloodLoss.toFixed(0)} mL</p>
		</div>
	</div>

	<div class="mt-4 text-sm text-gray-600">
		Based on {matchingCasesCount} similar cases in our database
	</div>
</div>
