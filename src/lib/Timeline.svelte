<!-- File: src/lib/Timeline.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scalePoint, scaleLinear } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { line, curveMonotoneX } from 'd3-shape';
	import { rollup, max } from 'd3-array';

	export interface SurgeryCase {
		department: string;
		anestart: number; // anesthesia start (sec)
		opstart: number; // operation start
		opend: number; // operation end
		dis: number; // discharge time
	}

	export let data: SurgeryCase[] = [];
	let svg: SVGSVGElement;

	function draw() {
		if (!data.length) return;
		select(svg).selectAll('*').remove();

		// 1) group by department, compute correct phase durations in MINUTES
		const grouped = rollup(
			data,
			(cases) => {
				const avg = (fn: (d: SurgeryCase) => number) =>
					cases.reduce((s, d) => s + fn(d), 0) / cases.length;
				return {
					Anesthesia: avg((d) => d.opstart - d.anestart) / 60,
					Surgery: avg((d) => d.opend - d.opstart) / 60,
					Recovery: avg((d) => d.dis - d.opend) / 60
				};
			},
			(d) => d.department
		);

		const entries = Array.from(grouped, ([dept, vals]) => ({ dept, ...vals }));
		const phases = ['Anesthesia', 'Surgery', 'Recovery'] as const;

		// 2) scales
		const margin = { top: 30, right: 120, bottom: 60, left: 60 };
		const width = 700 - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const x = scalePoint<string>().domain(phases).range([0, width]).padding(0.5);

		const yMax = max(entries, (e) => Math.max(e.Anesthesia, e.Surgery, e.Recovery)) as number;

		const y = scaleLinear().domain([0, yMax]).nice().range([height, 0]);

		const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];

		// 3) draw
		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// axes
		g.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));

		g.append('g')
			.call(axisLeft(y).ticks(6))
			.append('text')
			.attr('fill', '#000')
			.attr('x', -margin.left + 10)
			.attr('y', -10)
			.attr('text-anchor', 'start')
			.text('Duration (min)');

		// line generator
		const lineGen = line<[string, number]>()
			.x((d) => x(d[0])!)
			.y((d) => y(d[1]))
			.curve(curveMonotoneX);

		// draw one line per department
		entries.forEach((entry, i) => {
			const pts: [string, number][] = phases.map((p) => [p, (entry as any)[p]]);
			g.append('path')
				.datum(pts)
				.attr('fill', 'none')
				.attr('stroke', colors[i % colors.length])
				.attr('stroke-width', 2)
				.attr('d', lineGen);

			// dots
			g.selectAll(`.dot-${i}`)
				.data(pts)
				.enter()
				.append('circle')
				.attr('class', `dot-${i}`)
				.attr('cx', (d) => x(d[0])!)
				.attr('cy', (d) => y(d[1]))
				.attr('r', 4)
				.attr('fill', colors[i % colors.length]);
		});

		// legend
		const legend = g.append('g').attr('transform', `translate(${width + 20},0)`);
		entries.forEach((entry, i) => {
			legend
				.append('rect')
				.attr('x', 0)
				.attr('y', i * 20)
				.attr('width', 12)
				.attr('height', 12)
				.attr('fill', colors[i % colors.length]);
			legend
				.append('text')
				.attr('x', 18)
				.attr('y', i * 20 + 10)
				.text(entry.dept)
				.attr('font-size', '12px')
				.attr('alignment-baseline', 'middle');
		});
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="h-auto w-full"></svg>
