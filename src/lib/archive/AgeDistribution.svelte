<!-- File: src/lib/AgeDistribution.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleLinear } from 'd3-scale';
	import { extent, max, histogram, bin } from 'd3-array';
	import { axisBottom, axisLeft } from 'd3-axis';

	export let data: Array<{ age: number }> = [];
	let svg: SVGSVGElement;

	function draw() {
		if (!data.length) return;
		select(svg).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 40 };
		const width = 600 - margin.left - margin.right;
		const height = 300 - margin.top - margin.bottom;

		const ages = data.map((d) => d.age);
		const x = scaleLinear()
			.domain(extent(ages) as [number, number])
			.nice()
			.range([0, width]);

		const bins = bin()
			.domain(x.domain() as [number, number])
			.thresholds(x.ticks(20))(ages);

		const y = scaleLinear()
			.domain([0, max(bins, (d) => d.length) as number])
			.range([height, 0]);

		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		g.append('g')
			.selectAll('rect')
			.data(bins)
			.enter()
			.append('rect')
			.attr('x', (d) => x(d.x0 as number))
			.attr('y', (d) => y(d.length))
			.attr('width', (d) => x(d.x1 as number) - x(d.x0 as number) - 1)
			.attr('height', (d) => height - y(d.length))
			.attr('fill', 'steelblue');

		g.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));

		g.append('g').call(axisLeft(y));

		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 35)
			.attr('text-anchor', 'middle')
			.text('Age (years)');

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -35)
			.attr('text-anchor', 'middle')
			.text('Count');
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="h-auto w-full"></svg>
