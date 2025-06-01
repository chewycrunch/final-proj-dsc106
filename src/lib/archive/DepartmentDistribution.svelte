<!-- File: src/lib/DepartmentDistribution.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { rollup, max } from 'd3-array';

	export let data: Array<{ department: string }> = [];
	let svg: SVGSVGElement;

	function draw() {
		if (!data.length) return;
		select(svg).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 100, left: 40 };
		const width = 600 - margin.left - margin.right;
		const height = 300 - margin.top - margin.bottom;

		const counts = rollup(
			data,
			(v) => v.length,
			(d) => d.department
		);
		const entries = Array.from(counts, ([key, value]) => ({ key, value }));

		const x = scaleBand<string>()
			.domain(entries.map((d) => d.key))
			.range([0, width])
			.padding(0.2);

		const y = scaleLinear()
			.domain([0, max(entries, (d) => d.value) as number])
			.nice()
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
			.data(entries)
			.enter()
			.append('rect')
			.attr('x', (d) => x(d.key)!)
			.attr('y', (d) => y(d.value))
			.attr('width', x.bandwidth())
			.attr('height', (d) => height - y(d.value))
			.attr('fill', 'teal');

		g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(x))
			.selectAll('text')
			.attr('transform', 'rotate(-45)')
			.attr('text-anchor', 'end');

		g.append('g').call(axisLeft(y));

		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 80)
			.attr('text-anchor', 'middle')
			.text('Surgical Department');

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -35)
			.attr('text-anchor', 'middle')
			.text('Number of Cases');
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="h-auto w-full"></svg>
