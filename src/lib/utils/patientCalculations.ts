export function getMatchingCases(
	cases: SurgeryCase[],
	profile: { age: number; bmi: number; height: number; asa: number }
): SurgeryCase[] {
	// Use the same matching criteria as BuildPatient
	const ageMatches = cases.filter((c) => c.age != null && Math.abs(c.age - profile.age) <= 10); // Increased to 10 years
	const bmiMatches = cases.filter((c) => c.bmi != null && Math.abs(c.bmi - profile.bmi) <= 8); // Increased to 8 points
	const heightMatches = cases.filter(
		(c) => c.height != null && Math.abs(c.height - profile.height) <= 10.16
	); // Increased to 4 inches
	const asaMatches = cases.filter((c) => c.asa != null && Math.abs(c.asa - profile.asa) <= 3); // Increased to 3 points

	// Intersect all matches in the same order as BuildPatient
	const ageAndBmi = ageMatches.filter((c) => bmiMatches.includes(c));
	const ageBmiAndHeight = ageAndBmi.filter((c) => heightMatches.includes(c));
	const finalMatches = ageBmiAndHeight.filter((c) => asaMatches.includes(c));

	// Log the number of matches for debugging
	console.log('Matching cases:', {
		ageMatches: ageMatches.length,
		bmiMatches: bmiMatches.length,
		heightMatches: heightMatches.length,
		asaMatches: asaMatches.length,
		finalMatches: finalMatches.length,
		profile
	});

	return finalMatches;
}

export function calculateOutcomes(matchingCases: SurgeryCase[]): {
	avgICUStay: number;
	mortalityRate: number;
	avgBloodLoss: number;
	icuIQR: { q1: number; q3: number };
	bloodLossIQR: { q1: number; q3: number };
	icuValues: number[];
	bloodLossValues: number[];
} {
	if (matchingCases.length === 0) {
		return {
			avgICUStay: 0,
			mortalityRate: 0,
			avgBloodLoss: 0,
			icuIQR: { q1: 0, q3: 0 },
			bloodLossIQR: { q1: 0, q3: 0 },
			icuValues: [],
			bloodLossValues: []
		};
	}

	// ICU days calculations
	const icuValues = matchingCases
		.map((c) => Number(c.icu_days))
		.filter((v) => !isNaN(v))
		.sort((a, b) => a - b);
	const avgICUStay = icuValues.reduce((a, b) => a + b, 0) / icuValues.length;
	const icuIQR = {
		q1: icuValues[Math.floor(icuValues.length * 0.25)],
		q3: icuValues[Math.floor(icuValues.length * 0.75)]
	};

	// Mortality calculations
	const mortalityRate =
		matchingCases.reduce((sum, case_) => sum + (case_.death_inhosp || 0), 0) / matchingCases.length;

	// Blood loss calculations
	const bloodLossValues = matchingCases
		.map((c) => Number(c.intraop_ebl))
		.filter((v) => !isNaN(v))
		.sort((a, b) => a - b);
	const avgBloodLoss = bloodLossValues.reduce((a, b) => a + b, 0) / bloodLossValues.length;
	const bloodLossIQR = {
		q1: bloodLossValues[Math.floor(bloodLossValues.length * 0.25)],
		q3: bloodLossValues[Math.floor(bloodLossValues.length * 0.75)]
	};

	return {
		avgICUStay,
		mortalityRate,
		avgBloodLoss,
		icuIQR,
		bloodLossIQR,
		icuValues,
		bloodLossValues
	};
}

export function calculateAccuracyScore(guess: number, actual: number, allValues: number[]): number {
	// Handle zero or very small values
	if (actual === 0 && guess === 0) return 1;
	if (actual === 0 || guess === 0) return 0;

	// Calculate relative error
	const relativeError = Math.abs(guess - actual) / Math.max(actual, 1);

	// Convert to accuracy score (1 - normalized error)
	// Using exponential decay to make it more sensitive to differences
	return Math.exp(-relativeError);
}
