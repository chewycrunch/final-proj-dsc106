<!-- File: src/lib/AlbuminRiskScatter.svelte -->
<script lang="ts">
	import * as d3 from 'd3';
	import { onMount } from 'svelte';
	import { regressionLinear } from 'd3-regression';

	// Parent passes in full array of SurgeryCase
	export let patients: SurgeryCase[] = [];

	// UI state: 'elective' | 'emergency' | 'all'
	let filter: 'elective' | 'emergency' | 'all' = 'elective';

	// Reactive slice: updates whenever patients or filter change
	let slice: SurgeryCase[] = [];
	$: {
		if (!patients) {
			slice = [];
		} else {
			slice = patients.filter((p) => {
				const a = +p.preop_alb!;
				if (!Number.isFinite(a) || a <= 0) return false;

				if (filter === 'elective') {
					return p.emop === 0 && p.ane_type === 'General';
				}
				if (filter === 'emergency') {
					return p.emop === 1;
				}
				return true;
			});
		}
	}

	// SVG element reference
	let svg: SVGSVGElement;

	// Dimensions
	const W = 640;
	const H = 320;
	const pad = 48;
	const leftPad = 100;  // Increased padding for y-axis

	// color scale (ICU days capped at 5)
	const customInterpolator = (t: number) => {
		// t: 0 (high ICU) to 1 (low ICU) because domain is [5, 0]
		if (t < 0.15) {
			return "#ff0000"; // even brighter red for highest ICU stays
		}
		return d3.interpolateRdYlBu(t);
	};
	const color = d3.scaleSequential(customInterpolator).domain([5, 0]);

	// Whenever `slice` changes, redraw
	$: if (svg) {
		draw(slice);
	}

	function draw(data: SurgeryCase[]) {
		if (!svg) return;
		const root = d3.select(svg).attr('viewBox', `0 0 ${W} ${H}`).html('');

		if (!data.length) {
			root
				.append('text')
				.attr('x', W / 2)
				.attr('y', H / 2)
				.attr('text-anchor', 'middle')
				.attr('fill', '#888')
				.attr('font-size', '16px')
				.text('No cases with albumin in this view');
			return;
		}

		// Sort data by albumin
		const sortedData = [...data].sort((a, b) => +a.preop_alb! - +b.preop_alb!);

		// Group data into sets of 5
		const groupedData = [];
		for (let i = 0; i < sortedData.length; i += 5) {
			const group = sortedData.slice(i, i + 5);
			if (group.length > 0) {
				const avgAlb = group.reduce((sum, d) => sum + +d.preop_alb!, 0) / group.length;
				const avgIcuDays = group.reduce((sum, d) => sum + (d.icu_days || 0), 0) / group.length;
				groupedData.push({
					albumin: avgAlb,
					icuDays: avgIcuDays,
					count: group.length,
					cases: group
				});
			}
		}

		// Remove outlier for 'emergency' and 'all' filters (avg ICU stay >= 20 days)
		let filteredGroupedData = groupedData;
		if (filter === 'emergency' || filter === 'all') {
			filteredGroupedData = groupedData.filter(d => d.icuDays < 20);
		}

		// Remove points with albumin < 2
		filteredGroupedData = filteredGroupedData.filter(d => d.albumin >= 2);

		// X scale (albumin)
		const x = d3
			.scaleLinear()
			.domain([2, d3.max(filteredGroupedData, (d) => d.albumin) || 6])
			.nice()
			.range([leftPad, W - pad]);

		// Y scale (ICU days)
		const y = d3
			.scaleLinear()
			.domain([0, d3.max(filteredGroupedData, (d) => d.icuDays) || 5])
			.nice()
			.range([H - pad, pad]);

		// Add grid lines
		const gridGroup = root.append('g');

		// Horizontal grid lines
		y.ticks(5).forEach((tick) => {
			gridGroup
				.append('line')
				.attr('x1', leftPad)
				.attr('x2', W - pad)
				.attr('y1', y(tick))
				.attr('y2', y(tick))
				.attr('stroke', '#4A5568')
				.attr('stroke-dasharray', '2,2')
				.attr('opacity', 0.5);
		});

		// Vertical grid lines
		x.ticks(6).forEach((tick) => {
			gridGroup
				.append('line')
				.attr('x1', x(tick))
				.attr('x2', x(tick))
				.attr('y1', pad)
				.attr('y2', H - pad)
				.attr('stroke', '#4A5568')
				.attr('stroke-dasharray', '2,2')
				.attr('opacity', 0.5);
		});

		// Add albumin cliff line
		gridGroup
			.append('line')
			.attr('x1', x(3.5))
			.attr('x2', x(3.5))
			.attr('y1', pad)
			.attr('y2', H - pad)
			.attr('stroke', '#ff3b3b')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '4,4');

		// Add cliff label
		gridGroup
			.append('text')
			.attr('x', x(3.5))
			.attr('y', pad - 10)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.attr('font-weight', '500')
			.text('Albumin Cliff (3.5 g/dL)');

		// Calculate regression line
		const regression = regressionLinear()
			.x((d: { albumin: number }) => d.albumin)
			.y((d: { icuDays: number }) => d.icuDays)
			.domain(x.domain() as [number, number])(filteredGroupedData);

		// Draw regression line
		const line = d3
			.line<[number, number]>()
			.x((d) => x(d[0]))
			.y((d) => y(d[1]));

		// Create points for the regression line using actual data range
		const minX = Math.max(2, d3.min(filteredGroupedData, d => d.albumin) || 0);
		const maxX = d3.max(filteredGroupedData, d => d.albumin) || 0;
		
		// Calculate points with y-values capped at 0
		const regressionPoints: [number, number][] = [
			[minX, Math.max(0, regression.predict(minX))],
			[maxX, Math.max(0, regression.predict(maxX))]
		];

		root
			.append('path')
			.datum(regressionPoints)
			.attr('fill', 'none')
			.attr('stroke', '#fbbf24')
			.attr('stroke-width', 2)
			.attr('d', (d) => line(d));

		// Plot dots
		root
			.append('g')
			.selectAll('circle')
			.data(filteredGroupedData)
			.enter()
			.append('circle')
			.attr('cx', (d) => x(d.albumin))
			.attr('cy', (d) => y(d.icuDays))
			.attr('r', (d) => Math.sqrt(d.count) * 2)
			.attr('fill', (d) => color(Math.min(d.icuDays, 5)))
			.attr('stroke', '#374151')
			.attr('stroke-opacity', 0.15)
			.append('title')
			.text(
				(d) => `Average Albumin: ${d.albumin.toFixed(2)} g/dL\nAverage ICU Stay: ${d.icuDays.toFixed(1)} days\nNumber of Cases: ${d.count}`
			);

		// X axis
		const xAxis = d3
			.axisBottom(x)
			.ticks(6)
			.tickFormat((v) => (v as number) + ' g/dL');

		root
			.append('g')
			.attr('transform', `translate(0, ${H - pad})`)
			.call(xAxis)
			.selectAll('text')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.attr('class', 'fill-text-primary');

		// Y axis
		const yAxis = d3
			.axisLeft(y)
			.ticks(5)
			.tickFormat((d) => d + ' days');

		root
			.append('g')
			.attr('transform', `translate(${leftPad}, 0)`)
			.call(yAxis)
			.selectAll('text')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.attr('class', 'fill-text-primary');

		// X axis label
		root
			.append('text')
			.attr('x', W / 2)
			.attr('y', H - pad + 36)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.text('Pre-operative Albumin (g/dL)')
			.attr('class', 'fill-text-primary');

		// Y axis label
		root
			.append('text')
			.attr('transform', `translate(${leftPad - 60}, ${H / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.text('Average ICU Stay (days)')
			.attr('class', 'fill-text-primary');

		// Title
		root
			.append('text')
			.attr('x', W / 2)
			.attr('y', pad - 32)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('font-weight', '600')
			.attr('fill', '#CBD5E0')
			.text('Hidden Risk Factor — The Albumin Cliff')
			.attr('class', 'fill-text-primary');

		// Legend
		const legendX = W - pad - 80;
		const legendY = pad - 40;
		const legendGroup = root.append('g').attr('transform', `translate(${legendX}, ${legendY})`);

		const stops = [0, 1, 2, 3, 4, 5];
		const stopW = 15;
		legendGroup
			.selectAll('rect')
			.data(stops)
			.enter()
			.append('rect')
			.attr('x', (_d, i) => i * (stopW + 2))
			.attr('y', 0)
			.attr('width', stopW)
			.attr('height', 10)
			.attr('fill', (d) => color(d));

		legendGroup
			.append('text')
			.attr('x', 0)
			.attr('y', 24)
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.text('0–1d')
			.attr('class', 'fill-text-primary');

		legendGroup
			.append('text')
			.attr('x', (stopW + 2) * 5 + 4)
			.attr('y', 24)
			.attr('text-anchor', 'end')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.text('ICU ≥ 5d')
			.attr('class', 'fill-text-primary');
	}

	onMount(() => {
		if (svg) {
			draw(slice);
		}
	});
</script>

<div class="rounded-xl p-6 shadow-lg border border-[#4A5568]">
	<!-- Filter controls -->
	<div class="mb-4 flex gap-8 text-sm text-gray-200">
		<label class="flex items-center cursor-pointer">
			<input 
				type="radio" 
				bind:group={filter} 
				value="elective" 
				class="w-5 h-5 mr-3 accent-[#0096FF] cursor-pointer"
			/>
			<span class="select-none text-base">Elective</span>
		</label>
		<label class="flex items-center cursor-pointer">
			<input 
				type="radio" 
				bind:group={filter} 
				value="emergency" 
				class="w-5 h-5 mr-3 accent-[#0096FF] cursor-pointer"
			/>
			<span class="select-none text-base">Emergency</span>
		</label>
		<label class="flex items-center cursor-pointer">
			<input 
				type="radio" 
				bind:group={filter} 
				value="all" 
				class="w-5 h-5 mr-3 accent-[#0096FF] cursor-pointer"
			/>
			<span class="select-none text-base">All</span>
		</label>
	</div>
	<svg bind:this={svg} style="width: 100%; height: auto;"></svg>
</div>

<style>
	svg {
		font-family: 'Inter', sans-serif;
	}
	circle {
		transition: r 0.15s ease-out;
		cursor: pointer;
	}
	circle:hover {
		r: 7;
		stroke-width: 2;
		stroke: white;
	}
	input[type="radio"] {
		accent-color: #0096FF;
		appearance: none;
		-webkit-appearance: none;
		width: 20px;
		height: 20px;
		border: 2px solid #4A5568;
		border-radius: 50%;
		background-color: transparent;
		transition: all 0.2s ease;
	}
	input[type="radio"]:checked {
		border-color: #0096FF;
		background-color: #0096FF;
		box-shadow: inset 0 0 0 4px transparent;
	}
	input[type="radio"]:hover {
		border-color: #0096FF;
		transform: scale(1.05);
	}
</style>
