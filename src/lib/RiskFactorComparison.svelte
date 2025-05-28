<!-- File: src/lib/RiskFactorComparison.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { max } from 'd3-array';

	// we expect each case to have these preop fields:
	export interface SurgeryCase {
		caseid: string;
		los_icu: number;
		death_inhosp: number; // 0 or 1
		preop_alb: number; // Albumin
		preop_htn: number; // 0/1
		preop_dm: number; // 0/1
	}

	export let data: SurgeryCase[] = [];

	// Factor definitions:
	const factors = [
		{ key: 'preop_alb', label: 'Albumin (g/dL)', type: 'numeric' },
		{ key: 'preop_htn', label: 'Hypertension', type: 'binary' },
		{ key: 'preop_dm', label: 'Diabetes', type: 'binary' }
	] as const;

	type FactorKey = (typeof factors)[number]['key'];

	let chosen: FactorKey = 'preop_alb';
	let threshold = 0; // for numeric
	let minVal = 0,
		maxVal = 1;

	// Compute slider bounds when data or chosen changes
	$: if (chosen === 'preop_alb') {
		const vals = data.map((d) => d.preop_alb).filter((v) => !isNaN(v));
		minVal = Math.min(...vals);
		maxVal = Math.max(...vals);
		threshold = (minVal + maxVal) / 2;
	}

	// Grouping:
	function groupData() {
		const groups: Record<string, SurgeryCase[]> = {};

		if (chosen === 'preop_alb') {
			groups[`≤ ${threshold.toFixed(1)}`] = data.filter((d) => d.preop_alb <= threshold);
			groups[`> ${threshold.toFixed(1)}`] = data.filter((d) => d.preop_alb > threshold);
		} else {
			groups['No'] = data.filter((d) => (d as any)[chosen] === 0);
			groups['Yes'] = data.filter((d) => (d as any)[chosen] === 1);
		}

		return Object.entries(groups).map(([group, cases]) => {
			const n = cases.length;
			const avgICU = cases.reduce((sum, d) => sum + d.los_icu, 0) / Math.max(1, n);
			const mort = (cases.reduce((sum, d) => sum + d.death_inhosp, 0) / Math.max(1, n)) * 100;
			return { group, avgICU, mort };
		});
	}

	let svg: SVGSVGElement;

	function draw() {
		const chart = groupData();
		if (!chart.length) return;
		select(svg).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 40, left: 100 };
		const width = 600 - margin.left - margin.right;
		const height = 300 - margin.top - margin.bottom;

		const x0 = scaleBand<string>()
			.domain(chart.map((d) => d.group))
			.range([0, width])
			.padding(0.3);

		const metrics = ['avgICU', 'mort'] as const;
		const x1 = scaleBand<string>()
			.domain(metrics.map((m) => m))
			.range([0, x0.bandwidth()])
			.padding(0.1);

		const yMax = max(chart, (d) => Math.max(d.avgICU, d.mort))!;
		const y = scaleLinear().domain([0, yMax]).nice().range([height, 0]);

		const colors = { avgICU: '#1f77b4', mort: '#d62728' };

		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Bars
		chart.forEach((d) => {
			const gx = g.append('g').attr('transform', `translate(${x0(d.group)},0)`);
			metrics.forEach((m) => {
				gx.append('rect')
					.attr('x', x1(m as string)!)
					.attr('y', y(d[m]))
					.attr('width', x1.bandwidth())
					.attr('height', height - y(d[m]))
					.attr('fill', colors[m]);
			});
		});

		// Axes
		g.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x0));

		g.append('g')
			.call(axisLeft(y))
			.append('text')
			.attr('fill', '#000')
			.attr('x', -margin.left + 10)
			.attr('y', -10)
			.text('Value');

		// Legend
		const legend = g.append('g').attr('transform', `translate(${width - 120},0)`);
		[
			['avgICU', 'ICU Stay (days)'],
			['mort', 'Mortality (%)']
		].forEach(([m, label], i) => {
			legend
				.append('rect')
				.attr('x', 0)
				.attr('y', i * 20)
				.attr('width', 12)
				.attr('height', 12)
				.attr('fill', colors[m as 'avgICU' | 'mort']);
			legend
				.append('text')
				.attr('x', 18)
				.attr('y', i * 20 + 10)
				.text(label)
				.attr('font-size', '12px')
				.attr('alignment-baseline', 'middle');
		});
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<div class="space-y-4">
	<div class="flex items-center space-x-4">
		<label>Factor:</label>
		<select bind:value={chosen} class="rounded border p-1">
			{#each factors as f}
				<option value={f.key}>{f.label}</option>
			{/each}
		</select>

		{#if chosen === 'preop_alb'}
			<label class="ml-4">Threshold: {threshold.toFixed(1)}</label>
			<input
				type="range"
				min={minVal}
				max={maxVal}
				step="0.1"
				bind:value={threshold}
				class="w-48"
			/>
		{/if}
	</div>

	<svg bind:this={svg} class="h-auto w-full"></svg>
</div>
