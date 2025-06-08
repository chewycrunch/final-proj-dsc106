<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	// Inputs from BuildPatient - now using numeric ranges instead of booleans
	export let activeFilters = {
		age: 65, // years (20-90)
		height: 170, // cm (140-200)
		bmi: 25, // kg/m² (15-45)
		asa: 2 // ASA score (1-5)
	};

	// Filter ranges for sliders
	const filterRanges = {
		age: { min: 20, max: 90, step: 1, unit: 'years' },
		height: { min: 140, max: 200, step: 1, unit: 'cm' },
		bmi: { min: 15, max: 45, step: 0.1, unit: 'kg/m²' },
		asa: { min: 1, max: 5, step: 1, unit: 'score' }
	};

	// Reference values for comparison
	export let maxICUStay = 10; // days
	export let maxMortalityRate = 0.3; // 30%
	export let maxBloodLoss = 1500; // mL

	// Calculate outcomes based on filter values
	function calculateOutcomes(filters: typeof activeFilters) {
		// Realistic medical formulas based on research correlations

		// ICU Stay calculation (days)
		// Higher age, higher ASA, extreme BMI increase ICU stay
		const ageImpact = Math.max(0, (filters.age - 40) * 0.05);
		const asaImpact = (filters.asa - 1) * 1.2;
		const bmiImpact = Math.abs(filters.bmi - 25) * 0.08;
		const heightImpact = Math.max(0, (170 - filters.height) * 0.01);
		const icuStay = Math.min(maxICUStay, 1.5 + ageImpact + asaImpact + bmiImpact + heightImpact);

		// Mortality Rate calculation (0-1)
		// Age and ASA are primary risk factors
		const baseMortality = 0.02; // 2% baseline
		const ageMortality = Math.max(0, (filters.age - 50) * 0.003);
		const asaMortality = (filters.asa - 1) * 0.04;
		const bmiMortality = Math.max(0, Math.abs(filters.bmi - 25) - 10) * 0.005;
		const mortality = Math.min(
			maxMortalityRate,
			baseMortality + ageMortality + asaMortality + bmiMortality
		);

		// Blood Loss calculation (mL)
		// Higher ASA, extreme BMI, shorter height can increase blood loss
		const baseBloodLoss = 200;
		const asaBloodLoss = (filters.asa - 1) * 150;
		const bmiBloodLoss = Math.max(0, (filters.bmi - 30) * 20);
		const heightBloodLoss = Math.max(0, (170 - filters.height) * 3);
		const ageBloodLoss = Math.max(0, (filters.age - 60) * 5);
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

	// Reactive calculations
	$: calculatedOutcomes = calculateOutcomes(activeFilters);

	// Metrics for the radar chart
	$: outcomeMetrics = [
		{
			label: 'ICU Stay (days)',
			key: 'icu',
			value: calculatedOutcomes.icuStay,
			max: maxICUStay,
			fmt: (v: number) => v.toFixed(1)
		},
		{
			label: 'Mortality Rate (%)',
			key: 'mort',
			value: calculatedOutcomes.mortality * 100,
			max: maxMortalityRate * 100,
			fmt: (v: number) => v.toFixed(1) + '%'
		},
		{
			label: 'Blood Loss (mL)',
			key: 'blood',
			value: calculatedOutcomes.bloodLoss,
			max: maxBloodLoss,
			fmt: (v: number) => Math.round(v).toLocaleString()
		}
	];

	// SVG dimensions
	const R = 160,
		pad = 60,
		W = R * 2 + pad * 2,
		H = W;
	let svg: SVGSVGElement;

	// Update the chart when the component mounts or when metrics change
	$: if (svg && outcomeMetrics) {
		updateChart();
	}

	// The main function to update/draw the chart
	function updateChart() {
		// Clear any existing chart
		d3.select(svg).selectAll('*').remove();

		const g = d3
			.select(svg)
			.attr('width', W)
			.attr('height', H)
			.append('g')
			.attr('transform', `translate(${W / 2},${H / 2})`)
			.style('font-family', 'Inter, sans-serif');

		// Calculate angles for labels - keep original evenly spaced positioning
		const getLabelAngle = (i: number) => ((Math.PI * 2) / outcomeMetrics.length) * i - Math.PI / 2;

		// Calculate angles for triangle vertices - positioned at specific clock positions
		const getVertexAngle = (i: number) => {
			// Map each metric to specific clock positions
			// Index 0 = ICU Stay, Index 1 = Mortality Rate, Index 2 = Blood Loss
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
			.attr('fill', '#6b7280')
			.attr('font-size', 10)
			.attr('font-weight', '500')
			.text((d) => Math.round(d * 100) + '%');

		/* labels positioned around the perimeter - original evenly spaced layout */
		const labelGroup = g
			.selectAll('.label-group')
			.data(outcomeMetrics)
			.enter()
			.append('g')
			.attr('class', 'label-group');

		// Add labels in their original evenly-spaced positions
		labelGroup
			.append('text')
			.attr('x', (d, i) => {
				const labelAngle = getLabelAngle(i);
				return (R + 25) * Math.cos(labelAngle);
			})
			.attr('y', (d, i) => {
				const labelAngle = getLabelAngle(i);
				return (R + 25) * Math.sin(labelAngle) * -1;
			})
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('fill', '#374151')
			.attr('font-size', 13)
			.attr('font-weight', '600')
			.style('text-shadow', '1px 1px 2px rgba(255,255,255,0.8)')
			.text((d) => d.label);

		/* triangle with vertices at specific clock positions */
		const line = d3
			.lineRadial<any>()
			.radius((d) => radius(d.value, d.max))
			.angle((_d, i) => getVertexAngle(i))
			.curve(d3.curveLinearClosed);

		// Calculate triangle vertices - positioned at specific clock positions
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

		// Add triangle fill by creating a path from the dots
		const trianglePath = `M ${triangleVertices[0].x} ${triangleVertices[0].y} 
							 L ${triangleVertices[1].x} ${triangleVertices[1].y} 
							 L ${triangleVertices[2].x} ${triangleVertices[2].y} Z`;

		g.append('path')
			.attr('d', trianglePath)
			.attr('fill', riskAssessment.triangleFill)
			.attr('stroke', 'none')
			.style('transition', 'all 0.3s ease');

		// Create triangle edges connecting the dots - draw after fill to be on top
		const triangleEdges = [
			{ from: 0, to: 1 }, // ICU Stay to Mortality Rate
			{ from: 1, to: 2 }, // Mortality Rate to Blood Loss
			{ from: 2, to: 0 } // Blood Loss to ICU Stay
		];

		// Draw triangle edges with better error handling
		triangleEdges.forEach((edge, i) => {
			const fromVertex = triangleVertices[edge.from];
			const toVertex = triangleVertices[edge.to];

			// Only draw if coordinates are valid
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

		/* vertex dots positioned at triangle vertices */
		// Clear any existing tooltips first
		d3.select(svg.parentElement).selectAll('.tooltip').remove();

		const tip = d3
			.select(svg.parentElement)
			.append('div')
			.attr(
				'class',
				'tooltip fixed z-30 rounded bg-gray-900 px-2 py-1 text-xs text-white pointer-events-none'
			)
			.style('opacity', '0')
			.style('transition', 'opacity 0.2s ease');

		// Add prominent dots at triangle vertices
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
				// Show tooltip
				tip.style('opacity', '1').html(`${d.data.label}: ${d.data.fmt(d.data.value)}`);

				// Animate dot
				d3.select(this).transition().duration(200).attr('r', 10).attr('stroke-width', 5);
			})
			.on('mousemove', function (e, d) {
				// Update tooltip position
				tip.style('left', e.pageX + 14 + 'px').style('top', e.pageY - 32 + 'px');
			})
			.on('mouseleave', function () {
				// Hide tooltip
				tip.style('opacity', '0');

				// Reset dot
				d3.select(this).transition().duration(200).attr('r', 8).attr('stroke-width', 4);
			});

		// Add inner dots for extra emphasis
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

	// Initialize chart on mount
	onMount(() => {
		updateChart();
	});

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
		if (percentage < 0.3) return { 
			level: 'Low', 
			bgColor: 'bg-green-50', 
			textColor: 'text-green-700',
			borderColor: 'border-green-200'
		};
		if (percentage < 0.7) return { 
			level: 'Medium', 
			bgColor: 'bg-yellow-50', 
			textColor: 'text-yellow-700',
			borderColor: 'border-yellow-200'
		};
		return { 
			level: 'High', 
			bgColor: 'bg-red-50', 
			textColor: 'text-red-700',
			borderColor: 'border-red-200'
		};
	}

	function getMortalityRiskLevel(mortality: number) {
		const percentage = mortality / maxMortalityRate;
		if (percentage < 0.3) return { 
			level: 'Low', 
			bgColor: 'bg-green-50', 
			textColor: 'text-green-700',
			borderColor: 'border-green-200'
		};
		if (percentage < 0.7) return { 
			level: 'Medium', 
			bgColor: 'bg-yellow-50', 
			textColor: 'text-yellow-700',
			borderColor: 'border-yellow-200'
		};
		return { 
			level: 'High', 
			bgColor: 'bg-red-50', 
			textColor: 'text-red-700',
			borderColor: 'border-red-200'
		};
	}

	function getBloodLossRiskLevel(bloodLoss: number) {
		const percentage = bloodLoss / maxBloodLoss;
		if (percentage < 0.3) return { 
			level: 'Low', 
			bgColor: 'bg-green-50', 
			textColor: 'text-green-700',
			borderColor: 'border-green-200'
		};
		if (percentage < 0.7) return { 
			level: 'Medium', 
			bgColor: 'bg-yellow-50', 
			textColor: 'text-yellow-700',
			borderColor: 'border-yellow-200'
		};
		return { 
			level: 'High', 
			bgColor: 'bg-red-50', 
			textColor: 'text-red-700',
			borderColor: 'border-red-200'
		};
	}

	$: riskAssessment = getRiskLevel(calculatedOutcomes);
	$: icuRisk = getICURiskLevel(calculatedOutcomes.icuStay);
	$: mortalityRisk = getMortalityRiskLevel(calculatedOutcomes.mortality);
	$: bloodLossRisk = getBloodLossRiskLevel(calculatedOutcomes.bloodLoss);
</script>

<div class="radar-chart-container">
	<h2 class="text-black!">Patient Outcomes Radar</h2>

	<!-- Filter Sliders -->
	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Age Slider -->
		<div class="filter-group">
			<label class="mb-2 block text-sm font-medium text-gray-700">
				Age: <span class="font-semibold text-blue-600"
					>{activeFilters.age} {filterRanges.age.unit}</span
				>
			</label>
			<input
				type="range"
				bind:value={activeFilters.age}
				min={filterRanges.age.min}
				max={filterRanges.age.max}
				step={filterRanges.age.step}
				class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
			/>
			<div class="mt-1 flex justify-between text-xs text-gray-500">
				<span>{filterRanges.age.min}</span>
				<span>{filterRanges.age.max}</span>
			</div>
		</div>

		<!-- Height Slider -->
		<div class="filter-group">
			<label class="mb-2 block text-sm font-medium text-gray-700">
				Height: <span class="font-semibold text-blue-600"
					>{activeFilters.height} {filterRanges.height.unit}</span
				>
			</label>
			<input
				type="range"
				bind:value={activeFilters.height}
				min={filterRanges.height.min}
				max={filterRanges.height.max}
				step={filterRanges.height.step}
				class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
			/>
			<div class="mt-1 flex justify-between text-xs text-gray-500">
				<span>{filterRanges.height.min}</span>
				<span>{filterRanges.height.max}</span>
			</div>
		</div>

		<!-- BMI Slider -->
		<div class="filter-group">
			<label class="mb-2 block text-sm font-medium text-gray-700">
				BMI: <span class="font-semibold text-blue-600"
					>{activeFilters.bmi.toFixed(1)} {filterRanges.bmi.unit}</span
				>
			</label>
			<input
				type="range"
				bind:value={activeFilters.bmi}
				min={filterRanges.bmi.min}
				max={filterRanges.bmi.max}
				step={filterRanges.bmi.step}
				class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
			/>
			<div class="mt-1 flex justify-between text-xs text-gray-500">
				<span>{filterRanges.bmi.min}</span>
				<span>{filterRanges.bmi.max}</span>
			</div>
		</div>

		<!-- ASA Slider -->
		<div class="filter-group">
			<label class="mb-2 block text-sm font-medium text-gray-700">
				ASA Score: <span class="font-semibold text-blue-600"
					>{activeFilters.asa} {filterRanges.asa.unit}</span
				>
			</label>
			<input
				type="range"
				bind:value={activeFilters.asa}
				min={filterRanges.asa.min}
				max={filterRanges.asa.max}
				step={filterRanges.asa.step}
				class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
			/>
			<div class="mt-1 flex justify-between text-xs text-gray-500">
				<span>{filterRanges.asa.min}</span>
				<span>{filterRanges.asa.max}</span>
			</div>
		</div>
	</div>

	<!-- Risk Assessment -->
	<div class="mb-4 rounded-lg bg-gray-50 p-3">
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium">Overall Risk Level:</span>
			<span class="font-semibold {riskAssessment.color}">{riskAssessment.level}</span>
		</div>
	</div>

	<div class="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Radar Chart -->
		<div class="lg:col-span-2">
			<svg bind:this={svg}></svg>
		</div>

		<!-- Chart Explanation -->
		<div class="space-y-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h4 class="mb-3 font-semibold text-gray-800">How to Read This Chart</h4>
				<div class="space-y-2 text-sm text-gray-600">
					<p>• <strong>Distance from center</strong> = Risk level (0-100%)</p>
					<p>• <strong>Triangle shape</strong> = Overall risk profile</p>
					<p>• <strong>Color</strong> = Risk severity level</p>
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h4 class="mb-3 font-semibold text-gray-800">Scale Ranges</h4>
				<div class="space-y-2 text-sm text-gray-600">
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

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h4 class="mb-3 font-semibold text-gray-800">Risk Levels</h4>
				<div class="space-y-1 text-sm">
					<div class="flex items-center gap-2">
						<span class="h-3 w-3 rounded-full bg-green-500"></span>
						<span class="font-medium text-green-700">Low Risk</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="h-3 w-3 rounded-full bg-yellow-500"></span>
						<span class="font-medium text-yellow-700">Medium Risk</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="h-3 w-3 rounded-full bg-red-500"></span>
						<span class="font-medium text-red-700">High Risk</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Outcome Values Display -->
	<div class="mt-4 grid grid-cols-3 gap-4 text-sm">
		<div class="text-center p-3 {icuRisk.bgColor} {icuRisk.borderColor} border rounded-lg">
			<div class="font-semibold {icuRisk.textColor}">ICU Stay</div>
			<div class="text-lg font-bold {icuRisk.textColor}">{calculatedOutcomes.icuStay.toFixed(1)} days</div>
			<div class="text-xs {icuRisk.textColor} mt-1">{icuRisk.level} Risk</div>
		</div>
		<div class="text-center p-3 {mortalityRisk.bgColor} {mortalityRisk.borderColor} border rounded-lg">
			<div class="font-semibold {mortalityRisk.textColor}">Mortality Rate</div>
			<div class="text-lg font-bold {mortalityRisk.textColor}">{(calculatedOutcomes.mortality * 100).toFixed(1)}%</div>
			<div class="text-xs {mortalityRisk.textColor} mt-1">{mortalityRisk.level} Risk</div>
		</div>
		<div class="text-center p-3 {bloodLossRisk.bgColor} {bloodLossRisk.borderColor} border rounded-lg">
			<div class="font-semibold {bloodLossRisk.textColor}">Blood Loss</div>
			<div class="text-lg font-bold {bloodLossRisk.textColor}">{Math.round(calculatedOutcomes.bloodLoss)} mL</div>
			<div class="text-xs {bloodLossRisk.textColor} mt-1">{bloodLossRisk.level} Risk</div>
		</div>
	</div>

	<div class="mt-4 text-sm">
		<p class="text-center text-gray-600">
			This radar chart shows predicted patient outcomes based on the selected patient
			characteristics
		</p>
	</div>
</div>

<style>
	.radar-chart-container {
		width: 100%;
		padding: 1rem;
		background-color: #f9fafb;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	svg {
		display: block;
		margin: 0 auto;
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #2563eb;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transition: all 0.2s ease;
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.1);
		background: #1d4ed8;
	}

	.slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #2563eb;
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transition: all 0.2s ease;
	}

	.slider::-moz-range-thumb:hover {
		transform: scale(1.1);
		background: #1d4ed8;
	}

	.filter-group {
		transition: all 0.2s ease;
	}

	.filter-group:hover {
		transform: translateY(-1px);
	}
</style>
