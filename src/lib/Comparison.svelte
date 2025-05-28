<!-- File: src/lib/Comparison.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleLinear, scaleBand } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { max } from 'd3-array';

	export interface SurgeryCase {
		los_icu: number;
		intraop_ebl: number;
		death_inhosp: number;
	}

	export let profileA!: SurgeryCase;
	export let profileB!: SurgeryCase;
	let svg: SVGSVGElement;

	function draw() {
		if (!profileA || !profileB) return;
		select(svg).selectAll('*').remove();

		const metrics = ['los_icu', 'intraop_ebl', 'death_inhosp'];
		const names = ['ICU Stay (days)', 'Blood Loss (mL)', 'Mortality'];
		const data = metrics.map((m, i) => ({ metric: names[i], a: profileA[m], b: profileB[m] }));

		const margin = { top: 20, right: 20, bottom: 50, left: 120 };
		const width = 600 - margin.left - margin.right;
		const height = data.length * 30;

		const xMax = max(data, (d) => Math.max(d.a, d.b))!;
		const x = scaleLinear().domain([0, xMax]).range([0, width]);
		const y = scaleBand<string>()
			.domain(data.map((d) => d.metric))
			.range([0, height])
			.padding(0.2);

		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// dumbbell lines
		g.selectAll('line')
			.data(data)
			.enter()
			.append('line')
			.attr('x1', (d) => x(d.a))
			.attr('x2', (d) => x(d.b))
			.attr('y1', (d) => y(d.metric)! + y.bandwidth() / 2)
			.attr('y2', (d) => y(d.metric)! + y.bandwidth() / 2)
			.attr('stroke', '#888');

		// circles
		['a', 'b'].forEach((key, i) => {
			g.selectAll(`circle.${key}`)
				.data(data)
				.enter()
				.append('circle')
				.attr('cx', (d) => x(d[key as 'a' | 'b']))
				.attr('cy', (d) => y(d.metric)! + y.bandwidth() / 2)
				.attr('r', 6)
				.attr('fill', i === 0 ? '#1f77b4' : '#ff7f0e');
		});

		g.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));

		g.append('g').call(axisLeft(y));
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="h-auto w-full"></svg>
