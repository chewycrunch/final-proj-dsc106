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

	// Colour scale (ICU days capped at 5)
	const colour = d3.scaleSequential(d3.interpolateRdYlBu).domain([5, 0]);

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

		// X scale (albumin)
		const x = d3
			.scaleLinear()
			.domain([2, d3.max(groupedData, (d) => d.albumin) || 6])
			.nice()
			.range([pad, W - pad]);

		// Y scale (ICU days)
		const y = d3
			.scaleLinear()
			.domain([0, d3.max(groupedData, (d) => d.icuDays) || 5])
			.nice()
			.range([H - pad, pad]);

		// Add grid lines
		const gridGroup = root.append('g');

		// Horizontal grid lines
		y.ticks(5).forEach((tick) => {
			gridGroup
				.append('line')
				.attr('x1', pad)
				.attr('x2', W - pad)
				.attr('y1', y(tick))
				.attr('y2', y(tick))
				.attr('stroke', '#e5e7eb')
				.attr('stroke-width', 1);
		});

		// Vertical grid lines
		x.ticks(6).forEach((tick) => {
			gridGroup
				.append('line')
				.attr('x1', x(tick))
				.attr('x2', x(tick))
				.attr('y1', pad)
				.attr('y2', H - pad)
				.attr('stroke', '#e5e7eb')
				.attr('stroke-width', 1);
		});

		// Add albumin cliff line
		gridGroup
			.append('line')
			.attr('x1', x(3.5))
			.attr('x2', x(3.5))
			.attr('y1', pad)
			.attr('y2', H - pad)
			.attr('stroke', '#ef4444')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '4,4');

		// Add cliff label
		gridGroup
			.append('text')
			.attr('x', x(3.5))
			.attr('y', pad + 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', '12px')
			.attr('fill', '#ef4444')
			.attr('font-weight', '500')
			.text('Albumin Cliff (3.5 g/dL)');

		// Calculate regression line
		const regression = regressionLinear()
			.x((d) => d.albumin)
			.y((d) => d.icuDays)
			.domain(x.domain() as [number, number])(groupedData);

		// Draw regression line
		const line = d3
			.line<[number, number]>()
			.x((d) => x(d[0]))
			.y((d) => y(d[1]));

		root
			.append('path')
			.datum(regression as unknown as [number, number][])
			.attr('fill', 'none')
			.attr('stroke', '#4b5563')
			.attr('stroke-width', 2)
			.attr('d', (d) => line(d));

		// Plot dots
		root
			.append('g')
			.selectAll('circle')
			.data(groupedData)
			.enter()
			.append('circle')
			.attr('cx', (d) => x(d.albumin))
			.attr('cy', (d) => y(d.icuDays))
			.attr('r', (d) => Math.sqrt(d.count) * 2)
			.attr('fill', (d) => colour(Math.min(d.icuDays, 5)))
			.attr('stroke', '#374151')
			.attr('stroke-opacity', 0.15)
			.append('title')
			.text(
				(d) => `Average Albumin: ${d.albumin.toFixed(2)} g/dL
Average ICU Stay: ${d.icuDays.toFixed(1)} days
Number of Cases: ${d.count}`
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
			.attr('font-size', '13px')
			.attr('fill', '#374151');

		// Y axis
		const yAxis = d3
			.axisLeft(y)
			.ticks(5)
			.tickFormat((d) => d + ' days');

		root
			.append('g')
			.attr('transform', `translate(${pad}, 0)`)
			.call(yAxis)
			.selectAll('text')
			.attr('font-size', '13px')
			.attr('fill', '#374151');

		// X axis label
		root
			.append('text')
			.attr('x', W / 2)
			.attr('y', H - pad + 36)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('fill', '#374151')
			.text('Pre-operative Albumin (g/dL)');

		// Y axis label
		root
			.append('text')
			.attr('transform', `translate(${pad - 36}, ${H / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('fill', '#374151')
			.text('Average ICU Stay (days)');

		// Title
		root
			.append('text')
			.attr('x', W / 2)
			.attr('y', pad - 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', '16px')
			.attr('font-weight', '600')
			.attr('fill', '#1f2937')
			.text('Hidden Risk Factor — The Albumin Cliff');

		// Legend
		const legendX = W - pad - 120;
		const legendY = pad;
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
			.attr('fill', (d) => colour(d));

		legendGroup
			.append('text')
			.attr('x', 0)
			.attr('y', 24)
			.attr('font-size', '12px')
			.attr('fill', '#374151')
			.text('ICU ≥ 5d');

		legendGroup
			.append('text')
			.attr('x', (stopW + 2) * 5 + 4)
			.attr('y', 24)
			.attr('text-anchor', 'end')
			.attr('font-size', '12px')
			.attr('fill', '#374151')
			.text('0–1d');
	}

	onMount(() => {
		if (svg) {
			draw(slice);
		}
	});
</script>

<!-- Filter controls -->
<div class="mb-4 flex gap-6 text-sm">
	<label>
		<input type="radio" bind:group={filter} value="elective" />
		<span class="ml-1">Elective</span>
	</label>
	<label>
		<input type="radio" bind:group={filter} value="emergency" />
		<span class="ml-1">Emergency</span>
	</label>
	<label>
		<input type="radio" bind:group={filter} value="all" />
		<span class="ml-1">All</span>
	</label>
</div>

<svg bind:this={svg} style="width: 100%; height: auto;"></svg>

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
	}
</style>
