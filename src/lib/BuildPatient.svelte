<!-- File: src/lib/BuildPatient.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import * as d3 from 'd3';

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

	// Radar chart reference values
	const maxICUStay = 10; // days
	const maxMortalityRate = 0.3; // 30%
	const maxBloodLoss = 1500; // mL

	// Radar chart SVG dimensions
	const R = 160,
		pad = 80,
		W = R * 2 + pad * 2,
		H = W;
	let radarSvg: SVGSVGElement;

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

				// Calculate accuracy if in guessing mode
				if (isGuessing && showResults) {
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
		5: '#ef4444' // red
	};

	// Calculate stick figure dimensions based on height
	$: figureScale = (predictors.height - heightRange.min) / (heightRange.max - heightRange.min);
	$: figureHeight = 250 + figureScale * 150; // Base height 250px, can grow up to 400px

	// Calculate stick thickness based on BMI
	$: stickThickness = 2 + ((predictors.bmi - bmiRange.min) / (bmiRange.max - bmiRange.min)) * 4; // 2px to 6px

	// Calculate stomach size based on BMI
	$: stomachScale = (predictors.bmi - bmiRange.min) / (bmiRange.max - bmiRange.min);
	$: stomachWidth = 10 + stomachScale * 25; // 10px to 35px
	$: stomachHeight = figureHeight * 0.2; // Constant height

	// Calculate hair whiteness based on age
	$: hairColor = `rgb(${((predictors.age - ageRange.min) / (ageRange.max - ageRange.min)) * 255}, ${((predictors.age - ageRange.min) / (ageRange.max - ageRange.min)) * 255}, ${((predictors.age - ageRange.min) / (ageRange.max - ageRange.min)) * 255})`;

	// Calculate ASA color
	$: asaColor = asaColors[predictors.asa as keyof typeof asaColors] || asaColors[1];

	// Function to get active filter count
	$: activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
	$: activeFilterText =
		activeFilterCount === 4
			? 'all filters'
			: `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`;

	// Radar chart calculations - using predictors for consistency
	function calculateRadarOutcomes(predictors: Predictors) {
		// Realistic medical formulas based on research correlations

		// ICU Stay calculation (days)
		const ageImpact = Math.max(0, (predictors.age - 40) * 0.05);
		const asaImpact = (predictors.asa - 1) * 1.2;
		const bmiImpact = Math.abs(predictors.bmi - 25) * 0.08;
		const heightImpact = Math.max(0, (170 - predictors.height) * 0.01);
		const icuStay = Math.min(maxICUStay, 1.5 + ageImpact + asaImpact + bmiImpact + heightImpact);

		// Mortality Rate calculation (0-1)
		const baseMortality = 0.02; // 2% baseline
		const ageMortality = Math.max(0, (predictors.age - 50) * 0.003);
		const asaMortality = (predictors.asa - 1) * 0.04;
		const bmiMortality = Math.max(0, Math.abs(predictors.bmi - 25) - 10) * 0.005;
		const mortality = Math.min(
			maxMortalityRate,
			baseMortality + ageMortality + asaMortality + bmiMortality
		);

		// Blood Loss calculation (mL)
		const baseBloodLoss = 200;
		const asaBloodLoss = (predictors.asa - 1) * 150;
		const bmiBloodLoss = Math.max(0, (predictors.bmi - 30) * 20);
		const heightBloodLoss = Math.max(0, (170 - predictors.height) * 3);
		const ageBloodLoss = Math.max(0, (predictors.age - 60) * 5);
		const bloodLoss = Math.min(
			maxBloodLoss,
			baseBloodLoss + asaBloodLoss + bmiBloodLoss + heightBloodLoss + ageBloodLoss
		);

		return {
			icuStay: Math.max(0, icuStay),
			mortality: Math.max(0, mortality),
			bloodLoss: Math.max(0, bloodLoss)
		};
	}

	// Risk level calculation for color coding
	function getRiskLevel(outcomes: any) {
		const riskScore =
			outcomes.mortality * 100 +
			(outcomes.icuStay / maxICUStay) * 30 +
			(outcomes.bloodLoss / maxBloodLoss) * 20;
		if (riskScore < 15)
			return {
				level: 'Low',
				color: 'text-green-600',
				triangleColor: '#10b981',
				triangleFill: 'rgba(16, 185, 129, 0.15)'
			};
		if (riskScore < 35)
			return {
				level: 'Medium',
				color: 'text-yellow-600',
				triangleColor: '#f59e0b',
				triangleFill: 'rgba(245, 158, 11, 0.15)'
			};
		return {
			level: 'High',
			color: 'text-red-600',
			triangleColor: '#ef4444',
			triangleFill: 'rgba(239, 68, 68, 0.15)'
		};
	}

	// Individual risk level calculations for each metric
	function getICURiskLevel(icuStay: number) {
		const percentage = icuStay / maxICUStay;
		if (percentage < 0.3)
			return {
				level: 'Low',
				bgColor: 'bg-green-500',
				textColor: 'text-green-500',
				borderColor: 'border-green-500'
			};
		if (percentage < 0.7)
			return {
				level: 'Medium',
				bgColor: 'bg-yellow-500',
				textColor: 'text-yellow-500',
				borderColor: 'border-yellow-500'
			};
		return {
			level: 'High',
			bgColor: 'bg-red-500',
			textColor: 'text-red-500',
			borderColor: 'border-red-500'
		};
	}

	function getMortalityRiskLevel(mortality: number) {
		const percentage = mortality / maxMortalityRate;
		if (percentage < 0.3)
			return {
				level: 'Low',
				bgColor: 'bg-green-500',
				textColor: 'text-green-500',
				borderColor: 'border-green-500'
			};
		if (percentage < 0.7)
			return {
				level: 'Medium',
				bgColor: 'bg-yellow-500',
				textColor: 'text-yellow-500',
				borderColor: 'border-yellow-500'
			};
		return {
			level: 'High',
			bgColor: 'bg-red-500',
			textColor: 'text-red-500',
			borderColor: 'border-red-500'
		};
	}

	function getBloodLossRiskLevel(bloodLoss: number) {
		const percentage = bloodLoss / maxBloodLoss;
		if (percentage < 0.3)
			return {
				level: 'Low',
				bgColor: 'bg-green-500',
				textColor: 'text-green-500',
				borderColor: 'border-green-500'
			};
		if (percentage < 0.7)
			return {
				level: 'Medium',
				bgColor: 'bg-yellow-500',
				textColor: 'text-yellow-500',
				borderColor: 'border-yellow-500'
			};
		return {
			level: 'High',
			bgColor: 'bg-red-500',
			textColor: 'text-red-500',
			borderColor: 'border-red-500'
		};
	}

	// Reactive calculations for radar chart
	$: radarOutcomes = calculateRadarOutcomes(predictors);
	$: riskAssessment = getRiskLevel(radarOutcomes);
	$: icuRisk = getICURiskLevel(radarOutcomes.icuStay);
	$: mortalityRisk = getMortalityRiskLevel(radarOutcomes.mortality);
	$: bloodLossRisk = getBloodLossRiskLevel(radarOutcomes.bloodLoss);

	// Metrics for the radar chart
	$: outcomeMetrics = [
		{
			label: 'ICU Stay (days)',
			key: 'icu',
			value: radarOutcomes.icuStay,
			max: maxICUStay,
			fmt: (v: number) => v.toFixed(1)
		},
		{
			label: 'Mortality Rate (%)',
			key: 'mort',
			value: radarOutcomes.mortality * 100,
			max: maxMortalityRate * 100,
			fmt: (v: number) => v.toFixed(1) + '%'
		},
		{
			label: 'Blood Loss (mL)',
			key: 'blood',
			value: radarOutcomes.bloodLoss,
			max: maxBloodLoss,
			fmt: (v: number) => Math.round(v).toLocaleString()
		}
	];

	// Update the radar chart when the component mounts or when metrics change
	$: if (radarSvg && outcomeMetrics) {
		updateRadarChart();
	}

	// The main function to update/draw the radar chart
	function updateRadarChart() {
		// Clear any existing chart
		d3.select(radarSvg).selectAll('*').remove();

		const g = d3
			.select(radarSvg)
			.attr('width', W)
			.attr('height', H)
			.append('g')
			.attr('transform', `translate(${W / 2},${H / 2})`)
			.style('font-family', 'Inter, sans-serif');

		// Calculate angles for labels - keep original evenly spaced positioning
		const getLabelAngle = (i: number) => ((Math.PI * 2) / outcomeMetrics.length) * i - Math.PI / 2;

		// Calculate angles for triangle vertices - positioned at specific clock positions
		const getVertexAngle = (i: number) => {
			const clockPositions = {
				0: -Math.PI / 2, // ICU Stay at 6 o'clock (bottom)
				1: Math.PI / 6, // Mortality Rate at 2 o'clock (top-right)
				2: (5 * Math.PI) / 6 // Blood Loss at 10 o'clock (top-left)
			};
			return clockPositions[i as keyof typeof clockPositions];
		};

		// Normalize value to the radius scale
		const radius = (value: number, max: number) => (value / max) * R;

		/* grid rings with better styling */
		g.selectAll('.ring')
			.data([0.2, 0.4, 0.6, 0.8, 1])
			.enter()
			.append('circle')
			.attr('class', 'ring')
			.attr('r', (d) => d * R)
			.attr('fill', 'none')
			.attr('stroke', '#e5e7eb')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', (d, i) => (i === 4 ? 'none' : '3 3'));

		/* scale labels on the right side */
		g.selectAll('.scale-label')
			.data([0.2, 0.4, 0.6, 0.8, 1])
			.enter()
			.append('text')
			.attr('class', 'scale-label')
			.attr('x', (d) => d * R + 5)
			.attr('y', 0)
			.attr('text-anchor', 'start')
			.attr('dominant-baseline', 'middle')
			.attr('fill', '#ffffff')
			.attr('font-size', 10)
			.attr('font-weight', '500')
			.text((d) => Math.round(d * 100) + '%');

		/* labels positioned around the perimeter */
		const labelGroup = g
			.selectAll('.label-group')
			.data(outcomeMetrics)
			.enter()
			.append('g')
			.attr('class', 'label-group');

		labelGroup
			.append('text')
			.attr('x', (d, i) => {
				const labelAngle = getLabelAngle(i);
				return (R + 35) * Math.cos(labelAngle);
			})
			.attr('y', (d, i) => {
				const labelAngle = getLabelAngle(i);
				return (R + 35) * Math.sin(labelAngle) * -1;
			})
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('fill', '#ffffff')
			.attr('font-size', 13)
			.attr('font-weight', '600')
			.style('text-shadow', '1px 1px 2px rgba(0,0,0,0.5)')
			.text((d) => d.label);

		// Calculate triangle vertices
		const triangleVertices = outcomeMetrics.map((d, i) => {
			const vertexAngle = getVertexAngle(i);
			const vertexRadius = radius(d.value, d.max);
			return {
				x: vertexRadius * Math.cos(vertexAngle),
				y: vertexRadius * Math.sin(vertexAngle) * -1,
				data: d,
				index: i,
				angle: vertexAngle,
				radius: vertexRadius
			};
		});

		// Add enhanced glow effect definition
		const defs = g.append('defs');
		const filter = defs
			.append('filter')
			.attr('id', 'glow')
			.attr('x', '-50%')
			.attr('y', '-50%')
			.attr('width', '200%')
			.attr('height', '200%');

		filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');

		const feMerge = filter.append('feMerge');
		feMerge.append('feMergeNode').attr('in', 'coloredBlur');
		feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

		// Add triangle fill
		const trianglePath = `M ${triangleVertices[0].x} ${triangleVertices[0].y} 
							 L ${triangleVertices[1].x} ${triangleVertices[1].y} 
							 L ${triangleVertices[2].x} ${triangleVertices[2].y} Z`;

		g.append('path')
			.attr('d', trianglePath)
			.attr('fill', riskAssessment.triangleFill)
			.attr('stroke', 'none')
			.style('transition', 'all 0.3s ease');

		// Create triangle edges
		const triangleEdges = [
			{ from: 0, to: 1 },
			{ from: 1, to: 2 },
			{ from: 2, to: 0 }
		];

		triangleEdges.forEach((edge, i) => {
			const fromVertex = triangleVertices[edge.from];
			const toVertex = triangleVertices[edge.to];

			if (
				fromVertex &&
				toVertex &&
				!isNaN(fromVertex.x) &&
				!isNaN(fromVertex.y) &&
				!isNaN(toVertex.x) &&
				!isNaN(toVertex.y)
			) {
				g.append('line')
					.attr('class', `triangle-edge-${i}`)
					.attr('x1', fromVertex.x)
					.attr('y1', fromVertex.y)
					.attr('x2', toVertex.x)
					.attr('y2', toVertex.y)
					.attr('stroke', riskAssessment.triangleColor)
					.attr('stroke-width', 3)
					.attr('stroke-linecap', 'round')
					.style('filter', 'url(#glow)')
					.style('transition', 'all 0.3s ease');
			}
		});

		// Clear any existing tooltips first
		d3.select(radarSvg.parentElement).selectAll('.tooltip').remove();

		const tip = d3
			.select(radarSvg.parentElement)
			.append('div')
			.attr(
				'class',
				'tooltip fixed z-30 rounded bg-gray-900 px-2 py-1 text-xs text-white pointer-events-none'
			)
			.style('opacity', '0')
			.style('transition', 'opacity 0.2s ease');

		// Add vertex dots with tooltips
		g.selectAll('.vertex-dot')
			.data(triangleVertices)
			.enter()
			.append('circle')
			.attr('class', 'vertex-dot')
			.attr('cx', (d) => d.x)
			.attr('cy', (d) => d.y)
			.attr('r', 8)
			.attr('fill', '#ffffff')
			.attr('stroke', riskAssessment.triangleColor)
			.attr('stroke-width', 4)
			.style('filter', 'drop-shadow(0px 2px 6px rgba(37, 99, 235, 0.4))')
			.style('cursor', 'pointer')
			.on('mouseenter', function (e, d) {
				tip.style('opacity', '1').html(`${d.data.label}: ${d.data.fmt(d.data.value)}`);
				d3.select(this).transition().duration(200).attr('r', 10).attr('stroke-width', 5);
			})
			.on('mousemove', function (e, d) {
				tip.style('left', e.pageX + 14 + 'px').style('top', e.pageY - 32 + 'px');
			})
			.on('mouseleave', function () {
				tip.style('opacity', '0');
				d3.select(this).transition().duration(200).attr('r', 8).attr('stroke-width', 4);
			});

		// Add inner dots
		g.selectAll('.vertex-inner-dot')
			.data(triangleVertices)
			.enter()
			.append('circle')
			.attr('class', 'vertex-inner-dot')
			.attr('cx', (d) => d.x)
			.attr('cy', (d) => d.y)
			.attr('r', 3)
			.attr('fill', riskAssessment.triangleColor)
			.style('pointer-events', 'none');
	}

	// Initialize radar chart on mount
	onMount(() => {
		if (radarSvg) {
			updateRadarChart();
		}
	});
</script>

<div class="container">
	<div class="space-y-4 rounded-lg p-3 shadow-sm bg-[#0e192b]">
		<!-- Header and Filter Controls Section -->
		<div class="controls-panel">
			<div class="controls-content">
				<div class="flex items-center justify-between">
					<h3 class="text-base font-semibold">Adjust Patient Profile</h3>
					<div class="flex items-center gap-3">
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={activeFilters.age} class="rounded border-gray-300" />
							<span class="factor-name">Age</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={activeFilters.height} class="rounded border-gray-300" />
							<span class="factor-name">Height</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={activeFilters.bmi} class="rounded border-gray-300" />
							<span class="factor-name">BMI</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={activeFilters.asa} class="rounded border-gray-300" />
							<span class="factor-name">ASA</span>
						</label>
					</div>
				</div>

				<!-- All Sliders in Grid Layout -->
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
					<div class={activeFilters.age ? 'control-item' : 'control-item opacity-50'}>
						<label class="block text-xs opacity-80">Age: {predictors.age} years</label>
						<input
							type="range"
							bind:value={predictors.age}
							min={ageRange.min}
							max={ageRange.max}
							class="w-full"
							disabled={!activeFilters.age}
						/>
						<p class="text-xs opacity-60">Range: {ageRange.min} - {ageRange.max} years</p>
					</div>

					<div class={activeFilters.height ? 'control-item' : 'control-item opacity-50'}>
						<label class="block text-xs opacity-80">
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
						<p class="text-xs opacity-60">
							Range: {heightRangeFtIn.min.feet}'{heightRangeFtIn.min.inches}" - {heightRangeFtIn.max.feet}'{heightRangeFtIn.max.inches}"
						</p>
					</div>

					<div class={activeFilters.bmi ? 'control-item' : 'control-item opacity-50'}>
						<label class="block text-xs opacity-80">BMI: {predictors.bmi}</label>
						<input
							type="range"
							bind:value={predictors.bmi}
							min={bmiRange.min}
							max={bmiRange.max}
							step="0.1"
							class="w-full"
							disabled={!activeFilters.bmi}
						/>
						<p class="text-xs opacity-60">Range: {bmiRange.min.toFixed(1)} - {bmiRange.max.toFixed(1)}</p>
					</div>

					<div class={activeFilters.asa ? 'control-item' : 'control-item opacity-50'}>
						<label class="block text-xs opacity-80">ASA Score: {predictors.asa}</label>
						<input
							type="range"
							bind:value={predictors.asa}
							min="1"
							max="5"
							step="1"
							class="w-full"
							disabled={!activeFilters.asa}
						/>
						<p class="text-xs opacity-60">
							ASA {predictors.asa}: {predictors.asa === 1
								? 'Healthy patient'
								: predictors.asa === 2
									? 'Mild systemic disease'
									: predictors.asa === 3
										? 'Severe systemic disease'
										: predictors.asa === 4
											? 'Severe systemic disease that is a constant threat to life'
											: 'Moribund patient not expected to survive without the operation'}
						</p>
					</div>
				</div>
			</div>
		</div>

		{#if matchingCasesCount < 10}
			<div class="chart-wrapper">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
						<span class="text-lg">⚠️</span>
					</div>
					<div class="flex-1">
						<div class="flex items-center justify-between">
							<h4 class="mb-2 font-bold text-red-700">
								{matchingCasesCount === 0 ? 'No Matching Cases Found' : 'Limited Data Available'}
							</h4>
							<div class="flex items-center justify-center gap-2 min-w-[200px]">
								<span class="text-base font-medium">Overall Risk Level:</span>
								<span class="text-base font-semibold {riskAssessment.color}">{riskAssessment.level}</span>
							</div>
						</div>
						{#if matchingCasesCount === 0}
							<p class="mb-3 text-sm opacity-80">
								There are no historical cases that match your current patient profile.
							</p>
							<div class="space-y-1">
								<p class="text-sm font-medium opacity-80">Consider:</p>
								<ul class="ml-4 space-y-1 text-sm opacity-70">
									<li>• Relaxing some of your filters</li>
									<li>• Adjusting the patient's characteristics to more common values</li>
									<li>• Using a broader range for age, BMI, or ASA score</li>
								</ul>
							</div>
						{:else}
							<p class="mb-3 text-sm opacity-80">
								Only {matchingCasesCount} cases match your current filters. The predictions may not be
								reliable.
							</p>
							<div class="space-y-1">
								<p class="text-sm font-medium opacity-80">Consider:</p>
								<ul class="ml-4 space-y-1 text-sm opacity-70">
									<li>• Relaxing some filters to get more comparable cases</li>
									<li>• Adjusting the patient profile to match more common characteristics</li>
								</ul>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else if matchingCasesCount < 50}
			<div class="chart-wrapper">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
						<span class="text-lg">👍</span>
					</div>
					<div class="flex-1">
						<div class="flex items-center justify-between">
							<h4 class="mb-2 font-bold text-yellow-700">Good Sample Size</h4>
							<div class="flex items-center justify-center gap-2 min-w-[200px]">
								<span class="text-base font-medium">Overall Risk Level:</span>
								<span class="text-base font-semibold {riskAssessment.color}">{riskAssessment.level}</span>
							</div>
						</div>
						<p class="text-sm opacity-80">
							With {matchingCasesCount} matching cases, the predictions are reasonably reliable.
						</p>
					</div>
				</div>
			</div>
		{:else if matchingCasesCount >= 50}
			<div class="chart-wrapper">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
						<span class="text-lg">✅</span>
					</div>
					<div class="flex-1">
						<div class="flex items-center justify-between">
							<h4 class="mb-2 font-bold text-green-700">Excellent Sample Size</h4>
							<div class="flex items-center justify-center gap-2 min-w-[200px]">
								<span class="text-base font-medium">Overall Risk Level:</span>
								<span class="text-base font-semibold {riskAssessment.color}">{riskAssessment.level}</span>
							</div>
						</div>
						<p class="text-sm opacity-80">
							Great! With {matchingCasesCount} matching cases, the predictions are highly reliable.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Main Visualization Section: Three Columns -->
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<!-- Left side: Stick Figure -->
			<div class="space-y-2 lg:col-span-3">
				<h4 class="text-center text-sm font-semibold">Patient Visualization</h4>
				<div class="flex items-center justify-center">
					<svg
						viewBox="0 0 200 {figureHeight}"
						class="h-full w-full"
						style="min-height: 250px; max-height: 350px;"
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

			<!-- Middle: Radar Chart -->
			<div class="space-y-2 lg:col-span-6">
				<h4 class="text-center text-sm font-semibold">Patient Outcomes Radar</h4>
				<div class="flex justify-center h-[450px] -mt-10 w-[120%] -ml-[10%]">
					<svg bind:this={radarSvg} class="radar-chart h-full"></svg>
				</div>
			</div>

			<!-- Right side: Explanation Panels -->
			<div class="space-y-3 max-w-[350px] ml-auto lg:col-span-3">
				<div class="control-item">
					<h4 class="mb-2 text-sm font-semibold">How to Read This Chart</h4>
					<div class="space-y-1 text-xs opacity-80">
						<p>• <strong>Distance from center</strong> = Risk level (0-100%)</p>
						<p>• <strong>Triangle shape</strong> = Overall risk profile</p>
						<p>• <strong>Color</strong> = Risk severity level</p>
					</div>
				</div>

				<div class="control-item">
					<h4 class="mb-2 text-sm font-semibold">Scale Ranges</h4>
					<div class="space-y-1 text-xs opacity-80">
						<div>
							<strong>ICU Stay:</strong> 0 - {maxICUStay} days
						</div>
						<div>
							<strong>Mortality Rate:</strong> 0 - {(maxMortalityRate * 100).toFixed(0)}%
						</div>
						<div>
							<strong>Blood Loss:</strong> 0 - {maxBloodLoss.toLocaleString()} mL
						</div>
					</div>
				</div>

				<div class="control-item">
					<h4 class="mb-2 text-sm font-semibold">Risk Levels</h4>
					<div class="space-y-1 text-xs opacity-80">
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-green-500"></span>
							<span class="font-medium text-green-500">Low Risk</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-yellow-500"></span>
							<span class="font-medium text-yellow-500">Medium Risk</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-red-500"></span>
							<span class="font-medium text-red-500">High Risk</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Individual Outcome Cards -->
		{#if matchingCasesCount != 0}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
				<div class="control-item">
					<div class="flex items-center gap-3">
						<div class="h-8 w-8 rounded-full {icuRisk.bgColor} flex items-center justify-center">
							<span class="text-base text-white">🏥</span>
						</div>
						<div>
							<h3 class="text-sm font-medium opacity-80">ICU Stay</h3>
							<p class="text-xl font-bold {icuRisk.textColor}">
								{radarOutcomes.icuStay.toFixed(1)} days
							</p>
						</div>
					</div>
				</div>

				<div class="control-item">
					<div class="flex items-center gap-3">
						<div class="h-8 w-8 rounded-full {mortalityRisk.bgColor} flex items-center justify-center">
							<span class="text-base text-white">💗</span>
						</div>
						<div>
							<h3 class="text-sm font-medium opacity-80">Mortality Rate</h3>
							<p class="text-xl font-bold {mortalityRisk.textColor}">
								{(radarOutcomes.mortality * 100).toFixed(1)}%
							</p>
						</div>
					</div>
				</div>

				<div class="control-item">
					<div class="flex items-center gap-3">
						<div class="h-8 w-8 rounded-full {bloodLossRisk.bgColor} flex items-center justify-center">
							<span class="text-base text-white">🩸</span>
						</div>
						<div>
							<h3 class="text-sm font-medium opacity-80">Blood Loss</h3>
							<p class="text-xl font-bold {bloodLossRisk.textColor}">
								{Math.round(radarOutcomes.bloodLoss)} mL
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if isGuessing}
			<div class="mt-6 space-y-4">
				<h3 class="text-lg font-semibold">Make Your Predictions</h3>
				<div class="grid gap-4">
					<div>
						<label class="block text-sm opacity-80">Predicted ICU Stay (days)</label>
						<input
							type="number"
							bind:value={userGuess.icuDays}
							min="0"
							step="0.1"
							class="mt-1 w-full rounded border p-2"
						/>
					</div>
					<div>
						<label class="block text-sm opacity-80">Predicted Mortality (%)</label>
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
						<label class="block text-sm opacity-80">Predicted Blood Loss (mL)</label>
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
					<p class="text-sm opacity-80">Average ICU Stay</p>
					<p class="font-medium">{avgICUStay.toFixed(1)} days</p>
					<p class="text-xs opacity-60">
						IQR: {icuIQR.q1.toFixed(1)} - {icuIQR.q3.toFixed(1)} days
					</p>
				</div>
				<div>
					<p class="text-sm opacity-80">Mortality Rate</p>
					<div
						class="h-2 w-full rounded-full"
						style="background: linear-gradient(to right, #22c55e, #ef4444)"
					/>
					<p class="font-medium">{(mortalityRate * 100).toFixed(1)}%</p>
				</div>
				<div>
					<p class="text-sm opacity-80">Average Blood Loss</p>
					<p class="font-medium">{avgBloodLoss.toFixed(0)} mL</p>
					<p class="text-xs opacity-60">
						IQR: {bloodLossIQR.q1.toFixed(0)} - {bloodLossIQR.q3.toFixed(0)} mL
					</p>
				</div>
			</div>

			{#if isGuessing && showResults}
				<div class="mt-4 rounded p-3 text-sm shadow-sm">
					Your guess was {(percentileRank * 100).toFixed(1)}% accurate!
					{#if percentileRank <= 0.25}
						<p class="mt-2 opacity-80">
							Your predictions were quite far from the actual outcomes. Consider reviewing the
							patient's risk factors more carefully.
						</p>
					{:else if percentileRank <= 0.5}
						<p class="mt-2 opacity-80">
							Your predictions were somewhat off. Try to consider how different factors might interact
							to affect outcomes.
						</p>
					{:else if percentileRank <= 0.75}
						<p class="mt-2 opacity-80">
							Good predictions! You're getting better at understanding how patient characteristics
							influence outcomes.
						</p>
					{:else}
						<p class="mt-2 opacity-80">
							Excellent predictions! You have a strong understanding of how patient factors correlate
							with surgical outcomes.
						</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
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
		min-height: auto;
		height: auto;
		width: 100%;
		color: #f1f5f9;
		overflow-y: auto;
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

	.control-item {
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid #475569;
		border-radius: 8px;
		padding: 0.75rem;
		transition: all 0.2s ease;
	}

	.control-item:hover {
		background: rgba(71, 85, 105, 0.6);
		border-color: #64748b;
		transform: translateY(-1px);
	}

	.control-item input[type="range"] {
		-webkit-appearance: none;
		width: 100%;
		height: 4px;
		background: #475569;
		border-radius: 2px;
		outline: none;
		margin: 0.5rem 0;
	}

	.control-item input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		background: #3b82f6;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.control-item input[type="range"]::-webkit-slider-thumb:hover {
		transform: scale(1.1);
		background: #60a5fa;
	}

	.control-item input[type="checkbox"] {
		appearance: none;
		width: 1.2rem;
		height: 1.2rem;
		border: 2px solid #64748b;
		border-radius: 4px;
		background: transparent;
		position: relative;
		transition: all 0.2s ease;
	}

	.control-item input[type="checkbox"]:checked {
		background: #3b82f6;
		border-color: #3b82f6;
	}

	.control-item input[type="checkbox"]:checked::after {
		content: '✓';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white;
		font-weight: bold;
		font-size: 0.8rem;
	}

	.factor-name {
		font-weight: 600;
		color: #f1f5f9;
	}

	.chart-wrapper {
		background: rgba(30, 41, 59, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.radar-chart {
		display: block;
		margin: 0 auto;
		width: 100%;
		max-width: 500px;
		height: 450px;
	}

	@media (max-width: 768px) {
		.container {
			padding: 0.5rem;
		}
		
		.controls-panel {
			padding: 1rem;
		}
	}
</style>
