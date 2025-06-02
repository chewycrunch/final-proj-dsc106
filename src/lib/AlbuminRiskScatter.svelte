<!-- File: src/lib/AlbuminRiskScatter.svelte -->
<script lang="ts">
	import * as d3 from 'd3';
	import { onMount } from 'svelte';

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
	const H = 240;
	const pad = 48;

	// Colour scale (ICU days capped at 3)
	const colour = d3.scaleSequential(d3.interpolateRdYlBu).domain([3, 0]);

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

		// Parse albumin and ICU days
		const albValues = data.map((d) => +d.preop_alb!);
		const icuDays = data.map((d) => d.icu_days || 0);

		// X scale
		const x = d3
			.scaleLinear()
			.domain(d3.extent(albValues) as [number, number])
			.nice()
			.range([pad, W - pad]);

		// Vertical jitter
		const jitter = d3
			.scaleLinear()
			.domain([0, 1])
			.range([H - pad, pad]);

		// Plot dots
		root
			.append('g')
			.selectAll('circle')
			.data(data)
			.enter()
			.append('circle')
			.attr('cx', (d) => x(+d.preop_alb!))
			.attr('cy', () => jitter(Math.random()))
			.attr('r', 5)
			.attr('fill', (d) => colour(Math.min(d.icu_days || 0, 3)))
			.attr('stroke', '#374151')
			.attr('stroke-opacity', 0.15)
			.append('title')
			.text(
				(d) => `Case #${d.caseid}
Albumin: ${(+d.preop_alb!).toFixed(1)} g/dL
ICU Stay: ${d.icu_days || 0} day${(d.icu_days || 0) === 1 ? '' : 's'}`
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

		// X axis label
		root
			.append('text')
			.attr('x', W / 2)
			.attr('y', H - pad + 36)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('fill', '#374151')
			.text('Pre-operative Albumin (g/dL)');

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

		const stops = [0, 1, 2, 3];
		const stopW = 20;
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
			.text('ICU ≥ 3d');

		legendGroup
			.append('text')
			.attr('x', (stopW + 2) * 3 + 4)
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
