<script lang="ts">
	import { onMount } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleLinear, scaleBand } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { transition } from 'd3-transition';

	export let cases: Array<any> = [];

	let svg: SVGSVGElement;
	let riskFactors: Array<any> = [];
	let totalCases = 0;
	let validCases = 0;

	// Interactive controls
	let selectedFactors = {
		asa_high: false,
		emergency: false,
		low_albumin: false,
		old_age: false
	};
	let showMinorFactors = true;

	// Calculate actual risk factors from the data
	function calculateRiskFactors() {
		if (!cases || cases.length === 0) return;
		
		console.log('=== WATERFALL GRAPH DEBUG ===');
		console.log('Total cases:', cases.length);
		console.log('Sample case:', cases[0]);
		
		// Clean the data - only include cases with the fields we need
		const cleanCases = cases.filter(d => 
			typeof d.death_inhosp === 'number' &&
			typeof d.asa === 'number' &&
			typeof d.emop === 'number' &&
			typeof d.age === 'number'
		);
		
		totalCases = cases.length;
		validCases = cleanCases.length;
		
		console.log('Clean cases:', cleanCases.length);
		
		if (cleanCases.length === 0) {
			console.error('No valid cases found!');
			return;
		}

		// Calculate baseline mortality (low-risk patients)
		const lowRiskCases = cleanCases.filter(d => 
			d.asa <= 2 && 
			d.emop === 0 && 
			d.age < 65
		);
		
		const baselineMortality = lowRiskCases.length > 0 
			? (lowRiskCases.filter(d => d.death_inhosp === 1).length / lowRiskCases.length) * 100
			: 2.0;
			
		console.log(`Baseline: ${lowRiskCases.length} cases, ${baselineMortality.toFixed(1)}% mortality`);

		// Calculate risk for each factor
		const factors = [
			{
				name: 'ASA ≥ 3',
				key: 'asa_high',
				filter: (d: any) => d.asa >= 3,
				color: '#ef4444'
			},
			{
				name: 'Emergency',
				key: 'emergency',
				filter: (d: any) => d.emop === 1,
				color: '#f97316'
			},
			{
				name: 'Low Albumin',
				key: 'low_albumin',
				filter: (d: any) => d.preop_alb && d.preop_alb < 3.5,
				color: '#eab308'
			},
			{
				name: 'Age > 65',
				key: 'old_age',
				filter: (d: any) => d.age > 65,
				color: '#64748b'
			}
		];

		// Calculate actual risk contributions
		const results = factors.map(factor => {
			const withFactor = cleanCases.filter(factor.filter);
			const withoutFactor = cleanCases.filter(d => !factor.filter(d));
			
			if (withFactor.length === 0 || withoutFactor.length === 0) {
				return {
					...factor,
					contribution: 0,
					withCount: withFactor.length,
					withoutCount: withoutFactor.length,
					riskWith: 0,
					riskWithout: 0
				};
			}
			
			const riskWith = (withFactor.filter(d => d.death_inhosp === 1).length / withFactor.length) * 100;
			const riskWithout = (withoutFactor.filter(d => d.death_inhosp === 1).length / withoutFactor.length) * 100;
			const contribution = Math.max(0, riskWith - riskWithout);
			
			console.log(`${factor.name}: ${withFactor.length} cases, ${riskWith.toFixed(1)}% vs ${riskWithout.toFixed(1)}% = +${contribution.toFixed(1)}%`);
			
			return {
				...factor,
				contribution,
				withCount: withFactor.length,
				withoutCount: withoutFactor.length,
				riskWith,
				riskWithout
			};
		});

		// Sort by contribution (highest first)
		const sortedResults = results.sort((a, b) => b.contribution - a.contribution);
		
		// Build the waterfall data
		riskFactors = [
			{
				name: 'Baseline',
				key: 'baseline',
				value: baselineMortality,
				cumulative: baselineMortality,
				type: 'baseline',
				color: '#475569',
				description: `Low-risk patients (ASA≤2, elective, age<65): ${lowRiskCases.length} cases`
			}
		];

		// Add sorted factors with rankings
		sortedResults.forEach((result, index) => {
			riskFactors.push({
				name: result.name,
				key: result.key,
				value: result.contribution,
				cumulative: 0, // Will be calculated in updateCalculations
				type: index < 3 ? 'major' : 'minor',
				color: result.color,
				description: result.contribution > 0 
					? `${result.withCount} cases with factor, adds +${result.contribution.toFixed(1)}% risk`
					: `${result.withCount} cases with factor, no significant impact`
			});
		});

		// Add total
		riskFactors.push({
			name: 'Total Risk',
			key: 'total',
			value: 0, // Will be calculated in updateCalculations
			cumulative: 0,
			type: 'total',
			color: '#1e40af',
			description: 'Combined mortality risk based on selected factors'
		});

		console.log('Final risk factors:', riskFactors);
		updateCalculations();
	}

	// Update cumulative calculations based on selected factors
	function updateCalculations() {
		if (riskFactors.length === 0) return;
		
		let cumulative = riskFactors[0].value; // Start with baseline
		
		// Calculate cumulative values for each factor
		for (let i = 1; i < riskFactors.length - 1; i++) {
			const factor = riskFactors[i];
			const isSelected = selectedFactors[factor.key as keyof typeof selectedFactors];
			
			factor.cumulative = cumulative;
			if (isSelected) {
				cumulative += factor.value;
			}
		}
		
		// Set total
		const totalIndex = riskFactors.length - 1;
		riskFactors[totalIndex].value = cumulative;
		riskFactors[totalIndex].cumulative = cumulative;
	}

	// Calculate current patient risk based on selected factors
	function getCurrentRisk() {
		if (riskFactors.length === 0) return 0;
		
		let risk = riskFactors[0].value; // baseline
		
		for (let i = 1; i < riskFactors.length - 1; i++) {
			const factor = riskFactors[i];
			const isSelected = selectedFactors[factor.key as keyof typeof selectedFactors];
			if (isSelected) {
				risk += factor.value;
			}
		}
		
		return risk;
	}

	function drawChart() {
		if (!svg || riskFactors.length === 0) return;

		// Clear previous chart
		select(svg).selectAll('*').remove();

		const margin = { top: 50, right: 80, bottom: 60, left: 120 };
		const width = Math.min(800, window.innerWidth - margin.left - margin.right - 40);
		const height = Math.min(400, window.innerHeight * 0.6);

		// Filter data based on toggles and selections
		const displayData = riskFactors.filter(d => {
			if (d.type === 'baseline' || d.type === 'total') return true;
			if (d.key && d.key !== 'baseline' && d.key !== 'total') {
				return selectedFactors[d.key as keyof typeof selectedFactors];
			}
			return false;
		});

		// Ensure we have at least baseline and total
		if (displayData.length < 2) {
			displayData.push(riskFactors[0]); // Add baseline
			displayData.push(riskFactors[riskFactors.length - 1]); // Add total
		}

		const maxValue = Math.max(...riskFactors.map(d => d.type === 'total' ? d.value : d.cumulative + d.value));

		// Scales
		const xScale = scaleLinear()
			.domain([0, maxValue * 1.1])
			.range([0, width]);

		const yScale = scaleBand()
			.domain(displayData.map(d => d.name))
			.range([0, height])
			.padding(0.3);

		// Main SVG group
		const g = select(svg)
			.attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create tooltip
		const tooltip = select('body')
			.selectAll('.waterfall-tooltip')
			.data([0])
			.enter()
			.append('div')
			.attr('class', 'waterfall-tooltip')
			.style('opacity', 0)
			.style('position', 'absolute')
			.style('background-color', 'rgba(15, 23, 42, 0.95)')
			.style('color', 'white')
			.style('border', '1px solid #334155')
			.style('border-radius', '8px')
			.style('padding', '12px')
			.style('pointer-events', 'none')
			.style('font-size', '13px')
			.style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
			.style('z-index', '1000');

		// Draw bars with animation
		const bars = g.selectAll('.bar')
			.data(displayData)
			.enter()
			.append('g')
			.attr('class', 'bar');

		// Bar rectangles
		bars.append('rect')
			.attr('x', d => d.type === 'baseline' || d.type === 'total' ? 0 : xScale(d.cumulative))
			.attr('y', d => yScale(d.name)!)
			.attr('width', 0) // Start with 0 width for animation
			.attr('height', yScale.bandwidth())
			.attr('fill', d => d.color)
			.attr('stroke', '#1e293b')
			.attr('stroke-width', 2)
			.attr('rx', 4)
			.style('cursor', 'pointer')
			.transition()
			.duration(800)
			.delay((d, i) => i * 100)
			.attr('width', d => xScale(d.value))
			.on('end', function() {
				select(this.parentNode as SVGGElement).select('text').transition().duration(200).attr('opacity', 1);
			});

		// Bar labels
		bars.append('text')
			.attr('x', d => {
				const barStart = d.type === 'baseline' || d.type === 'total' ? 0 : xScale(d.cumulative);
				return barStart + xScale(d.value) / 2;
			})
			.attr('y', d => yScale(d.name)! + yScale.bandwidth() / 2)
			.attr('dy', '0.35em')
			.attr('text-anchor', 'middle')
			.attr('fill', '#ffffff')
			.attr('opacity', 0)
			.style('font-weight', '600')
			.style('font-size', '12px')
			.style('text-shadow', '0 1px 2px rgba(0,0,0,0.3)')
			.text(d => `${d.value.toFixed(1)}%`);

		// Add hover effects
		bars.on('mouseover', function(event, d) {
			select(this).select('rect').transition().duration(200).attr('opacity', 0.8);
			
			tooltip.transition().duration(200).style('opacity', 1);
			tooltip.html(`
				<div style="font-weight: bold; margin-bottom: 6px; color: #f1f5f9;">${d.name}</div>
				<div style="margin-bottom: 4px;">${d.description}</div>
				<div style="font-weight: bold; color: #60a5fa;">Risk: +${d.value.toFixed(1)}%</div>
			`)
			.style('left', (event.pageX + 10) + 'px')
			.style('top', (event.pageY - 28) + 'px');
		})
		.on('mouseout', function() {
			select(this).select('rect').transition().duration(200).attr('opacity', 1);
			tooltip.transition().duration(300).style('opacity', 0);
		});

		// Connecting lines for waterfall effect
		for (let i = 1; i < displayData.length - 1; i++) {
			const current = displayData[i];
			const next = displayData[i + 1];
			
			if (current.type !== 'total' && next.type !== 'total') {
				g.append('line')
					.attr('x1', xScale(current.cumulative + current.value))
					.attr('y1', yScale(current.name)! + yScale.bandwidth())
					.attr('x2', xScale(next.cumulative))
					.attr('y2', yScale(next.name)!)
					.attr('stroke', '#475569')
					.attr('stroke-width', 1.5)
					.attr('stroke-dasharray', '4,4')
					.attr('opacity', 0)
					.transition()
					.duration(1000)
					.delay(800)
					.attr('opacity', 0.6);
			}
		}

		// Axes
		g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale).tickFormat(d => `${d}%`))
			.style('color', '#ffffff');

		g.append('g')
			.call(axisLeft(yScale))
			.style('color', '#ffffff');

		// Title
		g.append('text')
			.attr('x', width / 2)
			.attr('y', -35)
			.attr('text-anchor', 'middle')
			.style('font-size', '24px')
			.style('font-weight', 'bold')
			.style('fill', '#3b82f6')
			.style('dominant-baseline', 'text-before-edge')
			.text('Interactive Risk Calculator - Real Data');

		// X-axis label
		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 45)
			.attr('text-anchor', 'middle')
			.style('font-size', '14px')
			.style('fill', '#ffffff')
			.text('Mortality Risk (%)');

		// Add grid lines
		g.append('g')
			.attr('class', 'grid')
			.selectAll('line')
			.data(xScale.ticks())
			.enter()
			.append('line')
			.attr('x1', d => xScale(d))
			.attr('x2', d => xScale(d))
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#334155')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,4')
			.attr('opacity', 0.3);
	}

	// Reactive updates
	$: if (cases && cases.length > 0) {
		calculateRiskFactors();
	}

	$: if (svg && riskFactors.length > 0) {
		updateCalculations();
		drawChart();
	}

	// Update when selections change
	$: if (selectedFactors || showMinorFactors) {
		if (riskFactors.length > 0) {
			updateCalculations();
			drawChart();
		}
	}

	onMount(() => {
		if (cases && cases.length > 0) {
			calculateRiskFactors();
		}
		
		return () => {
			select('body').selectAll('.waterfall-tooltip').remove();
		};
	});
</script>

<div class="container">
	{#if cases && cases.length > 0}
		<!-- Context Description -->
		<div class="context-panel">
			<h2>Interactive Risk Calculator</h2>
			<p class="context-description">
				This interactive waterfall chart visualizes how different risk factors contribute to surgical mortality risk. 
				The graph shows the cumulative effect of multiple risk factors, starting from a baseline risk for low-risk patients 
				and building up as additional factors are added. Toggle the risk factors below to see how they combine and affect 
				overall mortality risk. Each bar represents the additional risk contribution of that factor, with connecting lines 
				demonstrating how factors build upon each other. Hover over bars for detailed information. Based on real surgical 
				data from VitalDB, showing actual mortality rates for patients with different risk factor combinations.
			</p>
		</div>

		<!-- Interactive Controls -->
		<div class="controls-panel">
			<div class="controls-content">
				<h3> ⚠️ Risk Factors</h3>
				<p class="subtitle">Toggle risk factors to see how they combine and affect patient mortality</p>
				
				<div class="controls-grid">
					<label class="control-item major">
						<input type="checkbox" bind:checked={selectedFactors.asa_high} />
						<span class="factor-name">ASA ≥ 3</span>
						<span class="factor-impact">High Impact</span>
					</label>
					<label class="control-item major">
						<input type="checkbox" bind:checked={selectedFactors.emergency} />
						<span class="factor-name">Emergency</span>
						<span class="factor-impact">High Impact</span>
					</label>
					<label class="control-item major">
						<input type="checkbox" bind:checked={selectedFactors.low_albumin} />
						<span class="factor-name">Low Albumin</span>
						<span class="factor-impact">High Impact</span>
					</label>
					<label class="control-item minor">
						<input type="checkbox" bind:checked={selectedFactors.old_age} />
						<span class="factor-name">Age > 65</span>
						<span class="factor-impact">Minor Impact</span>
					</label>
				</div>
				
				<div class="current-risk">
					<span class="risk-label">Current Patient Risk:</span>
					<span class="risk-value">{getCurrentRisk().toFixed(1)}%</span>
				</div>

				<div class="toggle-section">
					<label class="toggle-item">
						<input type="checkbox" bind:checked={showMinorFactors} />
						Show minor risk factors in chart
					</label>
				</div>
			</div>
		</div>

		<!-- Chart -->
		<div class="chart-wrapper">
			<div class="data-stats">
				<span><strong>Total Cases:</strong> {totalCases.toLocaleString()}</span>
				<span><strong>Valid Cases:</strong> {validCases.toLocaleString()}</span>
				<span><strong>Active Factors:</strong> {Object.values(selectedFactors).filter(Boolean).length}</span>
			</div>
			<svg bind:this={svg} class="chart"></svg>
		</div>

		<!-- Key Insights -->
		{#if riskFactors.length > 3}
			<div class="insights">
				<h4>🔍 Key Clinical Insights</h4>
				<div class="insights-grid">
					<div class="insight-card">
						<strong>Baseline Risk</strong>
						<span>{riskFactors[0]?.value.toFixed(1)}%</span>
						<small>Low-risk patients</small>
					</div>
					<div class="insight-card">
						<strong>Top Risk Factor</strong>
						<span>{riskFactors[1]?.name}</span>
						<small>+{riskFactors[1]?.value.toFixed(1)}% mortality</small>
					</div>
					<div class="insight-card">
						<strong>Maximum Risk</strong>
						<span>{riskFactors[riskFactors.length - 1]?.value.toFixed(1)}%</span>
						<small>All factors combined</small>
					</div>
					<div class="insight-card">
						<strong>Data Source</strong>
						<span>{validCases.toLocaleString()}</span>
						<small>VitalDB surgical cases</small>
					</div>
				</div>
			</div>
		{/if}
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

	.controls-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin: 0;
	}

	.control-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		border-radius: 8px;
		background: rgba(51, 65, 85, 0.5);
		border: 1px solid #475569;
		transition: all 0.2s ease;
		cursor: pointer;
		text-align: center;
	}

	.control-item:hover {
		background: rgba(71, 85, 105, 0.6);
		border-color: #64748b;
		transform: translateY(-1px);
	}

	.control-item.major {
		border-left: 4px solid #ef4444;
	}

	.control-item.minor {
		border-left: 4px solid #64748b;
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
		font-size: 0.85rem;
	}

	.factor-impact {
		font-size: 0.7rem;
		color: #94a3b8;
		background: rgba(71, 85, 105, 0.6);
		padding: 0.15rem 0.35rem;
		border-radius: 12px;
		white-space: nowrap;
	}

	.current-risk {
		background: #1e40af;
		color: white;
		padding: 1rem;
		border-radius: 8px;
		text-align: center;
		margin: 0;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.risk-label {
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.risk-value {
		font-size: 1.5rem;
		font-weight: 700;
		margin-left: 0.5rem;
	}

	.toggle-section {
		border-top: 1px solid #475569;
		padding-top: 1rem;
		margin: 0;
	}

	.toggle-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.toggle-item input[type="checkbox"] {
		appearance: none;
		width: 1rem;
		height: 1rem;
		border: 1px solid #64748b;
		border-radius: 3px;
		background: transparent;
		position: relative;
		transition: all 0.2s ease;
	}

	.toggle-item input[type="checkbox"]:checked {
		background: #3b82f6;
		border-color: #3b82f6;
	}

	.toggle-item input[type="checkbox"]:checked::after {
		content: '✓';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white;
		font-size: 0.7rem;
	}

	.data-stats {
		position: absolute;
		top: 3rem;
		right: 5rem;
		background: rgba(51, 65, 85, 0.8);
		border: 1px solid #475569;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		text-align: right;
		z-index: 10;
	}

	.data-stats span {
		display: block;
		font-size: 0.75rem;
		color: #94a3b8;
		margin-bottom: 0.25rem;
	}

	.data-stats span:last-child {
		margin-bottom: 0;
	}

	.context-panel {
		margin-bottom: 1rem;
	}

	.context-panel h2 {
		margin: 0 0 1rem 0;
		color: var(--color-text-accent);
		font-size: 2.2rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.context-description {
		font-size: 1.1rem;
		line-height: 1.5;
		text-align: left;
		margin: 0;
		color: #e2e8f0;
	}

	.chart-wrapper {
		background: rgba(30, 41, 59, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		width: 100%;
		overflow-x: auto;
		position: relative;
	}

	.chart {
		width: 100%;
		height: auto;
		min-width: 600px;
	}

	.insights {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1rem;
		backdrop-filter: blur(10px);
	}

	.insights h4 {
		margin: 0 0 1rem 0;
		color: #f1f5f9;
		font-size: 1.1rem;
	}

	.insights-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.insight-card {
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid #475569;
		border-radius: 8px;
		padding: 0.75rem;
		text-align: center;
		transition: transform 0.2s ease;
	}

	.insight-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		background: rgba(51, 65, 85, 0.5);
	}

	.insight-card strong {
		display: block;
		font-size: 0.8rem;
		color: #94a3b8;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.insight-card span {
		display: block;
		font-size: 1.25rem;
		font-weight: 700;
		color: #f1f5f9;
		margin-bottom: 0.25rem;
	}

	.insight-card small {
		font-size: 0.75rem;
		color: #64748b;
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

	@media (max-width: 1200px) {
		.controls-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.controls-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Style for axis lines */
	:global(.chart .domain) {
		stroke: #475569;
	}

	/* Style for grid lines */
	:global(.chart .grid line) {
		stroke: #334155;
		stroke-opacity: 0.3;
	}

	/* Style for axis text */
	:global(.chart text) {
		fill: #ffffff;
	}

	/* Style for axis ticks */
	:global(.chart .tick line) {
		stroke: #475569;
	}
</style>
