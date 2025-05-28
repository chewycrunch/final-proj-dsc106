<!-- File: src/lib/BuildPatient.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleLinear, scaleBand } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';

	export interface Predictors {
		age: number;
		bmi: number;
		asa: number;
		emergency: number;
	}

	export let predictors!: Predictors;
	let svg: SVGSVGElement;

	function draw() {
		select(svg).selectAll('*').remove();

		const riskICU = 0.1 * predictors.age + 0.5 * predictors.asa + 2 * predictors.emergency;
		const riskMort = Math.min(
			1,
			0.005 * predictors.age + 0.1 * predictors.emergency + 0.05 * (predictors.asa - 1)
		);

		const data = [
			{ name: 'Predicted ICU Stay (days)', value: riskICU },
			{ name: 'Predicted Mortality (%)', value: riskMort * 100 }
		];

		const margin = { top: 20, right: 20, bottom: 50, left: 120 };
		const width = 600 - margin.left - margin.right;
		const height = data.length * 30;

		const x = scaleLinear()
			.domain([0, Math.max(...data.map((d) => d.value))])
			.nice()
			.range([0, width]);

		const y = scaleBand<string>()
			.domain(data.map((d) => d.name))
			.range([0, height])
			.padding(0.3);

		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		g.selectAll('rect')
			.data(data)
			.enter()
			.append('rect')
			.attr('x', 0)
			.attr('y', (d) => y(d.name)!)
			.attr('width', (d) => x(d.value))
			.attr('height', y.bandwidth())
			.attr('fill', 'coral');

		g.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));

		g.append('g').call(axisLeft(y));
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="h-auto w-full"></svg>
