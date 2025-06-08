<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	// Inputs from BuildPatient - now using numeric ranges instead of booleans
	export let activeFilters = {
		age: 65,        // years (20-90)
		height: 170,    // cm (140-200)
		bmi: 25,        // kg/m² (15-45)
		asa: 2          // ASA score (1-5)
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
		const mortality = Math.min(maxMortalityRate, baseMortality + ageMortality + asaMortality + bmiMortality);

		// Blood Loss calculation (mL)
		// Higher ASA, extreme BMI, shorter height can increase blood loss
		const baseBloodLoss = 200;
		const asaBloodLoss = (filters.asa - 1) * 150;
		const bmiBloodLoss = Math.max(0, (filters.bmi - 30) * 20);
		const heightBloodLoss = Math.max(0, (170 - filters.height) * 3);
		const ageBloodLoss = Math.max(0, (filters.age - 60) * 5);
		const bloodLoss = Math.min(maxBloodLoss, baseBloodLoss + asaBloodLoss + bmiBloodLoss + heightBloodLoss + ageBloodLoss);

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
	const R = 170,
		pad = 40,
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
		d3.select(svg).selectAll("*").remove();

		const g = d3
			.select(svg)
			.attr('width', W)
			.attr('height', H)
			.append('g')
			.attr('transform', `translate(${W / 2},${H / 2})`)
			.style('font-family', 'Inter, sans-serif');

		// Calculate angles for each metric
		const angle = (i: number) => ((Math.PI * 2) / outcomeMetrics.length) * i - Math.PI / 2;

		// Normalize value to the radius scale
		const radius = (value: number, max: number) => (value / max) * R;

		/* grid rings */
		g.selectAll('.ring')
			.data([0.25, 0.5, 0.75, 1])
			.enter()
			.append('circle')
			.attr('class', 'ring')
			.attr('r', (d) => d * R)
			.attr('fill', 'none')
			.attr('stroke', '#d4d4d8')
			.attr('stroke-dasharray', '4 4');

		/* spokes + labels */
		const axis = g
			.selectAll('.axis')
			.data(outcomeMetrics)
			.enter()
			.append('g')
			.attr('class', 'axis')
			.attr('transform', (_d, i) => `rotate(${(angle(i) * 180) / Math.PI})`);

		axis.append('line')
			.attr('y1', 0)
			.attr('y2', -R)
			.attr('stroke', '#6b7280')
			.attr('stroke-width', 1);

		axis.append('text')
			.attr('y', -R - 14)
			.attr('text-anchor', 'middle')
			.attr('fill', '#475569')
			.attr('font-size', 14)
			.attr('font-weight', 'bold')
			.text((d) => d.label);

		// Calculate triangle vertices (dot positions)
		const triangleVertices = outcomeMetrics.map((d, i) => ({
			x: radius(d.value, d.max) * Math.cos(angle(i)),
			y: radius(d.value, d.max) * Math.sin(angle(i)) * -1,
			data: d,
			index: i
		}));

		/* single triangle with enhanced styling */
		const line = d3
			.lineRadial<any>()
			.radius((d) => radius(d.value, d.max))
			.angle((_d, i) => angle(i))
			.curve(d3.curveLinearClosed);

		// Add subtle glow effect definition
		const defs = g.append('defs');
		const filter = defs.append('filter')
			.attr('id', 'glow')
			.attr('x', '-50%')
			.attr('y', '-50%')
			.attr('width', '200%')
			.attr('height', '200%');

		filter.append('feGaussianBlur')
			.attr('stdDeviation', '2')
			.attr('result', 'coloredBlur');

		const feMerge = filter.append('feMerge');
		feMerge.append('feMergeNode').attr('in', 'coloredBlur');
		feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

		// Create the single triangle with fill and stroke
		const triangle = g.append('path')
			.attr('d', line(outcomeMetrics)!)
			.attr('fill', 'rgba(37, 99, 235, 0.15)')
			.attr('stroke', '#2563eb')
			.attr('stroke-width', 3)
			.attr('stroke-linejoin', 'round')
			.style('filter', 'url(#glow)');

		/* data points positioned exactly on triangle vertices */
		const tip = d3
			.select(svg.parentElement)
			.append('div')
			.attr(
				'class',
				'fixed z-30 mt-2 rounded bg-gray-900 px-2 py-1 text-xs text-white pointer-events-none opacity-0'
			);

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
			.attr('stroke', '#2563eb')
			.attr('stroke-width', 4)
			.style('filter', 'drop-shadow(0px 2px 6px rgba(37, 99, 235, 0.4))')
			.style('cursor', 'pointer')
			.on('mousemove', (e, d) => {
				tip.style('opacity', '1')
					.style('left', e.pageX + 14 + 'px')
					.style('top', e.pageY - 32 + 'px')
					.html(`${d.data.label}: ${d.data.fmt(d.data.value)}`);
			})
			.on('mouseleave', () => tip.style('opacity', '0'))
			.on('mouseenter', function() {
				d3.select(this)
					.transition()
					.duration(200)
					.attr('r', 10)
					.attr('stroke-width', 5);
			})
			.on('mouseleave', function() {
				d3.select(this)
					.transition()
					.duration(200)
					.attr('r', 8)
					.attr('stroke-width', 4);
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
			.attr('fill', '#2563eb')
			.style('pointer-events', 'none');
	}

	// Initialize chart on mount
	onMount(() => {
		updateChart();
	});

	// Risk level calculation for color coding
	function getRiskLevel(outcomes: any) {
		const riskScore = (outcomes.mortality * 100) + (outcomes.icuStay / maxICUStay * 30) + (outcomes.bloodLoss / maxBloodLoss * 20);
		if (riskScore < 15) return { level: 'Low', color: 'text-green-600' };
		if (riskScore < 35) return { level: 'Medium', color: 'text-yellow-600' };
		return { level: 'High', color: 'text-red-600' };
	}

	$: riskAssessment = getRiskLevel(calculatedOutcomes);
</script>

<div class="radar-chart-container">
	<h3 class="text-lg font-semibold mb-4">Patient Outcomes Radar</h3>
	
	<!-- Filter Sliders -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
		<!-- Age Slider -->
		<div class="filter-group">
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Age: <span class="font-semibold text-blue-600">{activeFilters.age} {filterRanges.age.unit}</span>
			</label>
			<input
				type="range"
				bind:value={activeFilters.age}
				min={filterRanges.age.min}
				max={filterRanges.age.max}
				step={filterRanges.age.step}
				class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			/>
			<div class="flex justify-between text-xs text-gray-500 mt-1">
				<span>{filterRanges.age.min}</span>
				<span>{filterRanges.age.max}</span>
			</div>
		</div>

		<!-- Height Slider -->
		<div class="filter-group">
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Height: <span class="font-semibold text-blue-600">{activeFilters.height} {filterRanges.height.unit}</span>
			</label>
			<input
				type="range"
				bind:value={activeFilters.height}
				min={filterRanges.height.min}
				max={filterRanges.height.max}
				step={filterRanges.height.step}
				class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			/>
			<div class="flex justify-between text-xs text-gray-500 mt-1">
				<span>{filterRanges.height.min}</span>
				<span>{filterRanges.height.max}</span>
			</div>
		</div>

		<!-- BMI Slider -->
		<div class="filter-group">
			<label class="block text-sm font-medium text-gray-700 mb-2">
				BMI: <span class="font-semibold text-blue-600">{activeFilters.bmi.toFixed(1)} {filterRanges.bmi.unit}</span>
			</label>
			<input
				type="range"
				bind:value={activeFilters.bmi}
				min={filterRanges.bmi.min}
				max={filterRanges.bmi.max}
				step={filterRanges.bmi.step}
				class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			/>
			<div class="flex justify-between text-xs text-gray-500 mt-1">
				<span>{filterRanges.bmi.min}</span>
				<span>{filterRanges.bmi.max}</span>
			</div>
		</div>

		<!-- ASA Slider -->
		<div class="filter-group">
			<label class="block text-sm font-medium text-gray-700 mb-2">
				ASA Score: <span class="font-semibold text-blue-600">{activeFilters.asa} {filterRanges.asa.unit}</span>
			</label>
			<input
				type="range"
				bind:value={activeFilters.asa}
				min={filterRanges.asa.min}
				max={filterRanges.asa.max}
				step={filterRanges.asa.step}
				class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			/>
			<div class="flex justify-between text-xs text-gray-500 mt-1">
				<span>{filterRanges.asa.min}</span>
				<span>{filterRanges.asa.max}</span>
			</div>
		</div>
	</div>

	<!-- Risk Assessment -->
	<div class="mb-4 p-3 bg-gray-50 rounded-lg">
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium">Overall Risk Level:</span>
			<span class="font-semibold {riskAssessment.color}">{riskAssessment.level}</span>
		</div>
	</div>
	
	<svg bind:this={svg}></svg>
	
	<!-- Outcome Values Display -->
	<div class="mt-4 grid grid-cols-3 gap-4 text-sm">
		<div class="text-center p-2 bg-blue-50 rounded">
			<div class="font-semibold text-blue-700">ICU Stay</div>
			<div class="text-lg font-bold text-blue-600">{calculatedOutcomes.icuStay.toFixed(1)} days</div>
		</div>
		<div class="text-center p-2 bg-blue-50 rounded">
			<div class="font-semibold text-blue-700">Mortality Rate</div>
			<div class="text-lg font-bold text-blue-600">{(calculatedOutcomes.mortality * 100).toFixed(1)}%</div>
		</div>
		<div class="text-center p-2 bg-blue-50 rounded">
			<div class="font-semibold text-blue-700">Blood Loss</div>
			<div class="text-lg font-bold text-blue-600">{Math.round(calculatedOutcomes.bloodLoss)} mL</div>
		</div>
	</div>
	
	<div class="mt-4 text-sm">
		<p class="text-center text-gray-600">This radar chart shows predicted patient outcomes based on the selected patient characteristics</p>
	</div>
	
	<div class="mt-3 flex justify-center gap-6 text-sm">
		<span class="flex items-center gap-1">
			<span class="inline-block h-3 w-3 rounded-full bg-[#2563eb]"></span> Patient Outcomes
		</span>
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