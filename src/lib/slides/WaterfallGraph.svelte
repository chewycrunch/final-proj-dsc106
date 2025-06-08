<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleLinear, scaleBand } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { format } from 'd3-format';
	import { transition } from 'd3-transition';

	// Reference patient parameters (median values)
	const REFERENCE_PATIENT = {
		asa: 1,
		emergency: false,
		albumin: 4.0,
		age: 55,
		bmi: 26,
		anesthesia_time: 120,
		baseline_risk: 2.8 // 2.8% baseline mortality risk
	};

	// Risk factor contributions (in percentage points)
	let riskFactors = [
		{ 
			name: 'Baseline Risk', 
			value: REFERENCE_PATIENT.baseline_risk, 
			type: 'baseline',
			description: 'ASA=1, elective, albumin≥3.5, age=55, BMI=26',
			rank: null,
			cumulative: REFERENCE_PATIENT.baseline_risk
		},
		{ 
			name: 'ASA ≥ 3', 
			value: 8.2, 
			type: 'major',
			description: 'High-risk ASA classification',
			rank: 1,
			cumulative: 0
		},
		{ 
			name: 'Emergency Case', 
			value: 5.7, 
			type: 'major',
			description: 'Urgent/emergent procedure',
			rank: 2,
			cumulative: 0
		},
		{ 
			name: 'Albumin < 3.5', 
			value: 4.1, 
			type: 'major',
			description: 'Low serum albumin (malnutrition)',
			rank: 3,
			cumulative: 0
		},
		{ 
			name: 'Age > 65', 
			value: 2.3, 
			type: 'minor',
			description: 'Advanced age factor',
			rank: 4,
			cumulative: 0
		},
		{ 
			name: 'BMI > 30', 
			value: 1.8, 
			type: 'minor',
			description: 'Obesity factor',
			rank: 5,
			cumulative: 0
		},
		{ 
			name: 'Anesthesia > 90min', 
			value: 1.4, 
			type: 'minor',
			description: 'Prolonged anesthesia time',
			rank: 6,
			cumulative: 0
		},
		{ 
			name: 'Total Risk', 
			value: 0, 
			type: 'total',
			description: 'Cumulative mortality risk',
			rank: null,
			cumulative: 0
		}
	];

	// Interactive controls
	let showMinorFactors = true;
	let selectedFactors = {
		asa_high: false,
		emergency: false,
		low_albumin: false,
		old_age: false,
		obesity: false,
		long_anesthesia: false
	};

	let svg: SVGSVGElement;

	// Calculate cumulative values and totals
	function updateCalculations() {
		let cumulative = riskFactors[0].value; // Start with baseline
		
		for (let i = 1; i < riskFactors.length - 1; i++) {
			riskFactors[i].cumulative = cumulative;
			cumulative += riskFactors[i].value;
		}
		
		// Set total
		riskFactors[riskFactors.length - 1].value = cumulative;
		riskFactors[riskFactors.length - 1].cumulative = cumulative;
	}

	// Calculate current patient risk based on selected factors
	function getCurrentRisk() {
		let risk = REFERENCE_PATIENT.baseline_risk;
		if (selectedFactors.asa_high) risk += riskFactors.find(f => f.name === 'ASA ≥ 3')?.value || 0;
		if (selectedFactors.emergency) risk += riskFactors.find(f => f.name === 'Emergency Case')?.value || 0;
		if (selectedFactors.low_albumin) risk += riskFactors.find(f => f.name === 'Albumin < 3.5')?.value || 0;
		if (selectedFactors.old_age) risk += riskFactors.find(f => f.name === 'Age > 65')?.value || 0;
		if (selectedFactors.obesity) risk += riskFactors.find(f => f.name === 'BMI > 30')?.value || 0;
		if (selectedFactors.long_anesthesia) risk += riskFactors.find(f => f.name === 'Anesthesia > 90min')?.value || 0;
		return risk;
	}

	function draw() {
		updateCalculations();
		
		if (!svg) return;
		select(svg).selectAll('*').remove();

		const margin = { top: 60, right: 80, bottom: 80, left: 200 };
		const width = 800 - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		// Filter data based on toggle
		const displayData = showMinorFactors 
			? riskFactors 
			: riskFactors.filter(f => f.type === 'baseline' || f.type === 'major' || f.type === 'total');

		const maxRisk = Math.max(...riskFactors.map(f => f.type === 'total' ? f.value : f.cumulative + f.value));

		// Scales
		const xScale = scaleLinear()
			.domain([0, maxRisk * 1.1])
			.range([0, width]);

		const yScale = scaleBand()
			.domain(displayData.map(d => d.name))
			.range([0, height])
			.padding(0.2);

		// Create main group
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
			.style('background-color', 'white')
			.style('border', '1px solid #ddd')
			.style('border-radius', '5px')
			.style('padding', '10px')
			.style('pointer-events', 'none')
			.style('font-size', '12px')
			.style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)')
			.style('z-index', '10');

		// Draw bars
		const bars = g.selectAll('.waterfall-bar')
			.data(displayData)
			.enter()
			.append('g')
			.attr('class', 'waterfall-bar');

		// Bar rectangles
		bars.append('rect')
			.attr('x', d => {
				if (d.type === 'baseline' || d.type === 'total') return 0;
				return xScale(d.cumulative);
			})
			.attr('y', d => yScale(d.name)!)
			.attr('width', d => {
				if (d.type === 'total') return xScale(d.value);
				return xScale(d.value);
			})
			.attr('height', yScale.bandwidth())
			.attr('fill', d => {
				if (d.type === 'baseline') return '#94a3b8'; // Gray for baseline
				if (d.type === 'total') return '#1e40af'; // Dark blue for total
				if (d.type === 'major') return '#dc2626'; // Red for top 3 drivers
				return '#d1d5db'; // Light gray for minor factors
			})
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)
			.style('cursor', 'pointer')
			.on('mouseover', function(event, d) {
				select(this).attr('opacity', 0.8);
				
				tooltip.transition().duration(200).style('opacity', 0.9);
				tooltip.html(`
					<div style="font-weight: bold; margin-bottom: 5px; color: #1e40af;">${d.name}</div>
					<div>${d.description}</div>
					<div style="margin-top: 5px;">
						<strong>Risk Contribution: +${format('.1f')(d.value)}%</strong>
					</div>
					${d.rank ? `<div style="color: #dc2626; font-weight: bold;">#${d.rank} Risk Driver</div>` : ''}
				`)
				.style('left', (event.pageX + 10) + 'px')
				.style('top', (event.pageY - 28) + 'px');
			})
			.on('mouseout', function() {
				select(this).attr('opacity', 1);
				tooltip.transition().duration(500).style('opacity', 0);
			});

		// Add value labels on bars
		bars.append('text')
			.attr('x', d => {
				if (d.type === 'baseline' || d.type === 'total') {
					return xScale(d.value) / 2;
				}
				return xScale(d.cumulative) + xScale(d.value) / 2;
			})
			.attr('y', d => yScale(d.name)! + yScale.bandwidth() / 2)
			.attr('dy', '0.35em')
			.attr('text-anchor', 'middle')
			.attr('fill', 'white')
			.style('font-size', '12px')
			.style('font-weight', 'bold')
			.text(d => d.type === 'baseline' || d.type === 'total' ? 
				`${format('.1f')(d.value)}%` : 
				`+${format('.1f')(d.value)}%`);

		// Add rank callouts for top 3 drivers
		displayData.filter(d => d.rank && d.rank <= 3).forEach(d => {
			const barY = yScale(d.name)!;
			const barX = xScale(d.cumulative) + xScale(d.value);
			
			g.append('text')
				.attr('x', barX + 10)
				.attr('y', barY + yScale.bandwidth() / 2)
				.attr('dy', '0.35em')
				.style('font-size', '11px')
				.style('font-weight', 'bold')
				.style('fill', '#dc2626')
				.text(`#${d.rank} driver`);
		});

		// Add connecting lines for waterfall effect
		for (let i = 1; i < displayData.length - 1; i++) {
			const current = displayData[i];
			const next = displayData[i + 1];
			
			if (current.type !== 'total' && next.type !== 'total') {
				const startX = xScale(current.cumulative + current.value);
				const endX = xScale(next.cumulative);
				const currentY = yScale(current.name)! + yScale.bandwidth();
				const nextY = yScale(next.name)!;
				
				g.append('line')
					.attr('x1', startX)
					.attr('x2', endX)
					.attr('y1', currentY)
					.attr('y2', nextY)
					.attr('stroke', '#9ca3af')
					.attr('stroke-width', 1)
					.attr('stroke-dasharray', '3,3');
			}
		}

		// Add axes
		g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale).tickFormat(d => `${d}%`))
			.style('font-size', '12px');

		g.append('g')
			.call(axisLeft(yScale))
			.style('font-size', '12px');

		// Add axis labels
		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 50)
			.attr('text-anchor', 'middle')
			.style('font-size', '14px')
			.style('font-weight', 'bold')
			.text('Mortality Risk (%)')
			.attr('class', 'fill-text-primary');

		// Add title
		g.append('text')
			.attr('x', width / 2)
			.attr('y', -30)
			.attr('text-anchor', 'middle')
			.style('font-size', '18px')
			.style('font-weight', 'bold')
			.text('Where to Focus: Comparing Every Pre-Op Factor')
			.attr('class', 'fill-text-primary');
	}

	// Reactive updates
	$: if (svg) {
		draw();
	}

	onMount(() => {
		draw();
		
		return () => {
			select('body').selectAll('.waterfall-tooltip').remove();
		};
	});

	afterUpdate(draw);
</script>

<div class="waterfall-container">
	<!-- Control Panel -->
	<div class="controls-panel">
		<h3>Interactive Risk Profile</h3>
		<div class="controls-grid">
			<label class="control-item">
				<input type="checkbox" bind:checked={selectedFactors.asa_high} />
				<span class="risk-major">ASA ≥ 3</span>
			</label>
			<label class="control-item">
				<input type="checkbox" bind:checked={selectedFactors.emergency} />
				<span class="risk-major">Emergency Case</span>
			</label>
			<label class="control-item">
				<input type="checkbox" bind:checked={selectedFactors.low_albumin} />
				<span class="risk-major">Low Albumin</span>
			</label>
			<label class="control-item">
				<input type="checkbox" bind:checked={selectedFactors.old_age} />
				<span class="risk-minor">Age > 65</span>
			</label>
			<label class="control-item">
				<input type="checkbox" bind:checked={selectedFactors.obesity} />
				<span class="risk-minor">BMI > 30</span>
			</label>
			<label class="control-item">
				<input type="checkbox" bind:checked={selectedFactors.long_anesthesia} />
				<span class="risk-minor">Long Anesthesia</span>
			</label>
		</div>
		
		<div class="current-risk">
			<span class="risk-label">Current Patient Risk:</span>
			<span class="risk-value">{getCurrentRisk().toFixed(1)}%</span>
		</div>

		<div class="toggle-section">
			<label class="toggle-item">
				<input type="checkbox" bind:checked={showMinorFactors} />
				Show minor risk factors
			</label>
		</div>
	</div>

	<!-- Chart -->
	<div class="chart-container">
		<svg bind:this={svg} class="waterfall-chart"></svg>
	</div>

	<!-- Insight Box -->
	<div class="insight-box">
		<p class="insight-text">
			<strong>ASA classification, Emergency status, and Albumin levels dominate</strong>—while age, BMI, anesthesia time, and other labs nudge risk only slightly. The top three factors account for over 75% of preventable risk variation.
		</p>
	</div>
</div>

<style>
	.waterfall-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 1000px;
		margin: 0 auto;
	}

	.controls-panel {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
	}

	.controls-panel h3 {
		margin: 0 0 1rem 0;
		color: #1e40af;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.controls-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.control-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.control-item:hover {
		background-color: #e2e8f0;
	}

	.control-item input[type="checkbox"] {
		width: 16px;
		height: 16px;
	}

	.risk-major {
		color: #dc2626;
		font-weight: 600;
	}

	.risk-minor {
		color: #6b7280;
		font-weight: 500;
	}

	.current-risk {
		background: #1e40af;
		color: white;
		padding: 0.75rem;
		border-radius: 4px;
		text-align: center;
		margin-bottom: 1rem;
	}

	.risk-label {
		font-size: 0.9rem;
		margin-right: 0.5rem;
	}

	.risk-value {
		font-size: 1.2rem;
		font-weight: bold;
	}

	.toggle-section {
		border-top: 1px solid #e2e8f0;
		padding-top: 1rem;
	}

	.toggle-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.chart-container {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
	}

	.waterfall-chart {
		width: 100%;
		height: auto;
	}

	.insight-box {
		margin-top: 0.5rem;
		padding: 0.75rem;
		background-color: #f8f9fa;
		border-radius: 5px;
		border-left: 4px solid #dc2626;
	}

	.insight-text {
		font-size: 0.9rem;
		line-height: 1.4;
		margin: 0;
		color: #333;
	}

	@media (max-width: 768px) {
		.controls-grid {
			grid-template-columns: 1fr;
		}
		
		.waterfall-container {
			padding: 0 1rem;
		}
	}
</style>
