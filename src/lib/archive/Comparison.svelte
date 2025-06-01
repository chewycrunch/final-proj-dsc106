<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { axisLeft, axisBottom } from 'd3-axis';
	import { max } from 'd3-array';

	// full dataset comes in
	export let cases: SurgeryCase[] = [];

	/* ---------- auto‐pick high-risk and low-risk profiles ---------- */
	let high: SurgeryCase | undefined;
	let low: SurgeryCase | undefined;

	$: if (cases.length) {
		high = cases.find((c) => c.age >= 70 && c.preop_htn === 1);
		low = cases.find((c) => c.age <= 40 && c.preop_htn === 0);
	}

	// derived chart data
	const metrics = [
		{ key: 'death_inhosp', label: 'Mortality', color: '#d62728' }, // red
		{ key: 'los_icu', label: 'ICU Stay (days)', color: '#ff7f0e' }, // orange
		// invert EBL so that GREEN = “better”
		{ key: 'intraop_ebl', label: 'Blood-Loss Score', color: '#2ca02c', invert: true }
	];

	let svg: SVGSVGElement;

	function draw() {
		if (!high || !low) return;
		select(svg).selectAll('*').remove();

		const norm = (value: number, key: string) => {
			// Mortality already 0/1 => scale to %
			if (key === 'death_inhosp') return value * 100;
			return value;
		};

		const data = metrics.map((m) => {
			const a = norm((high as any)[m.key], m.key);
			const b = norm((low as any)[m.key], m.key);
			return {
				metric: m.label,
				a: m.invert ? 1 / (a || 1) : a, // invert if needed
				b: m.invert ? 1 / (b || 1) : b,
				color: m.color
			};
		});

		const margin = { top: 20, right: 20, bottom: 40, left: 160 };
		const width = 640 - margin.left - margin.right;
		const height = data.length * 50;

		const xMax = max(data, (d) => Math.max(d.a, d.b))!;
		const x = scaleLinear().domain([0, xMax]).nice().range([0, width]);
		const y = scaleBand<string>()
			.domain(data.map((d) => d.metric))
			.range([0, height])
			.padding(0.35);

		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// bars A (high-risk)
		g.selectAll('.barA')
			.data(data)
			.enter()
			.append('rect')
			.attr('class', 'barA')
			.attr('x', 0)
			.attr('y', (d) => y(d.metric)!)
			.attr('height', y.bandwidth() / 2)
			.attr('width', (d) => x(d.a))
			.attr('fill', (d) => d.color)
			.attr('opacity', 1);

		// bars B (low-risk)
		g.selectAll('.barB')
			.data(data)
			.enter()
			.append('rect')
			.attr('class', 'barB')
			.attr('x', 0)
			.attr('y', (d) => y(d.metric)! + y.bandwidth() / 2)
			.attr('height', y.bandwidth() / 2)
			.attr('width', (d) => x(d.b))
			.attr('fill', (d) => d.color)
			.attr('opacity', 0.5);

		// axes
		g.append('g').call(axisLeft(y));
		g.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));

		/* ---------- Legend & profile details ---------- */
		const legend = g.append('g').attr('transform', `translate(${width + 20},0)`);
		legend.append('rect').attr('width', 12).attr('height', 12).attr('fill', '#000');
		legend.append('text').attr('x', 18).attr('y', 10).text('High-Risk (A)');
		legend
			.append('rect')
			.attr('y', 20)
			.attr('width', 12)
			.attr('height', 12)
			.attr('fill', '#000')
			.attr('opacity', 0.5);
		legend.append('text').attr('x', 18).attr('y', 30).text('Low-Risk (B)');

		const info = g
			.append('g')
			.attr('transform', `translate(0,${height + 30})`)
			.attr('font-size', '12px');
		info
			.append('text')
			.text(`A: age ${high.age}, HTN yes, ASA ${high.asa}, Emerg ${high.emergency ? 'yes' : 'no'}`);
		info
			.append('text')
			.attr('y', 16)
			.text(`B: age ${low.age}, HTN no,  ASA ${low.asa}, Emerg ${low.emergency ? 'yes' : 'no'}`);
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="h-auto w-full"></svg>
