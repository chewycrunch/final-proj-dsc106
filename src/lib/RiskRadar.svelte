<!-- File: src/lib/RiskRadar.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	/** full VitalDB rows arrive here  */
	export let patients: SurgeryCase[] = [];

	/* ---------------------------------------------------- *
	 * 1.  cohort selection                                *
	 * ---------------------------------------------------- */
	const score = (d: SurgeryCase) =>
		(d.death_inhosp ? 1 : 0) * 1000 +
		(Number(d.icu_days) || 0) * 4 +
		(Number(d.intraop_ebl) || 0) / 100;

	const ranked = [...patients].sort((a, b) => score(b) - score(a));
	const topN = Math.max(1, Math.round(patients.length * 0.005));
	const high = ranked.slice(0, topN);

	const survivors = patients.filter((p) => p.death_inhosp === 0);
	const p10 = d3.quantileSorted(survivors.map(score).sort(d3.ascending), 0.1)!;
	const low = survivors.filter((p) => score(p) <= p10);

	/* helper: cohort median with safe fallback */
	function med(arr: SurgeryCase[], k: keyof SurgeryCase) {
		return d3.median(arr, (d) => Number(d[k]) || NaN) || 0;
	}

	const metrics = [
		{
			label: 'Mortality (%)',
			key: 'mort',
			hi: med(high, 'death_inhosp') * 100,
			lo: med(low, 'death_inhosp') * 100,
			fmt: (v: number) => v.toFixed(1) + '%'
		},
		{
			label: 'ICU Stay (d)',
			key: 'icu',
			hi: med(high, 'icu_days'),
			lo: med(low, 'icu_days'),
			fmt: (v: number) => v.toFixed(1)
		},
		{
			label: 'Blood Loss (mL)',
			key: 'blood',
			hi: med(high, 'intraop_ebl'),
			lo: med(low, 'intraop_ebl'),
			fmt: (v: number) => Math.round(v).toLocaleString()
		}
	];

	/* pooled max for normalisation */
	const maxVal = d3.max(metrics.flatMap((m) => [m.hi, m.lo])) || 1;

	/* svg dims */
	const R = 170,
		pad = 40,
		W = R * 2 + pad * 2,
		H = W;
	let svg: SVGSVGElement;

	onMount(() => {
		const g = d3
			.select(svg)
			.attr('width', W)
			.attr('height', H)
			.append('g')
			.attr('transform', `translate(${W / 2},${H / 2})`)
			.style('font-family', 'Inter, sans-serif');

		const angle = (i: number) => ((Math.PI * 2) / metrics.length) * i - Math.PI / 2;
		const radius = (v: number) => (v / maxVal) * R;

		/* grid rings */
		g.selectAll('.ring')
			.data([0.25, 0.5, 0.75, 1])
			.enter()
			.append('circle')
			.attr('class', 'ring')
			.attr('r', (d) => d * R)
			.attr('fill', 'none')
			.attr('stroke', '#d4d4d8')
			.attr('stroke-dasharray', '4 4');

		/* spokes + labels */
		const axis = g
			.selectAll('.axis')
			.data(metrics)
			.enter()
			.append('g')
			.attr('class', 'axis')
			.attr('transform', (_d, i) => `rotate(${(angle(i) * 180) / Math.PI})`);

		axis.append('line').attr('y1', 0).attr('y2', -R).attr('stroke', '#6b7280');

		axis
			.append('text')
			.attr('y', -R - 14)
			.attr('text-anchor', 'middle')
			.attr('fill', '#475569')
			.attr('font-size', 14)
			.text((d) => d.label);

		/* radar polygons --------------------------------------------------- */
		const line = d3
			.lineRadial<number>()
			.radius((d) => radius(d))
			.angle((_d, i) => angle(i))
			.curve(d3.curveCardinalClosed);

		const hiVals = metrics.map((m) => m.hi),
			loVals = metrics.map((m) => m.lo);

		g.append('path')
			.attr('d', line(hiVals)!)
			.attr('fill', '#fee2e2')
			.attr('stroke', '#dc2626')
			.attr('stroke-width', 2);

		g.append('path')
			.attr('d', line(loVals)!)
			.attr('fill', '#dbeafe')
			.attr('stroke', '#2563eb')
			.attr('stroke-width', 2)
			.attr('opacity', 0.9);

		/* data points + tooltips ------------------------------------------ */
		const tip = d3
			.select(svg.parentElement)
			.append('div')
			.attr(
				'class',
				'fixed z-30 mt-2 rounded bg-gray-900 px-2 py-1 text-xs text-white pointer-events-none opacity-0'
			);

		function addDots(vals: number[], colour: string, cohort: 'High-risk' | 'Routine') {
			g.selectAll(`.dot-${colour}`)
				.data(vals)
				.enter()
				.append('circle')
				.attr('class', `dot-${colour}`)
				.attr('cx', (_d, i) => radius(vals[i]) * Math.cos(angle(i)))
				.attr('cy', (_d, i) => radius(vals[i]) * Math.sin(angle(i)) * -1)
				.attr('r', 5)
				.attr('fill', colour)
				.on('mousemove', (e, d) => {
					const idx = vals.indexOf(d);
					tip
						.style('opacity', '1')
						.style('left', e.pageX + 14 + 'px')
						.style('top', e.pageY - 32 + 'px')
						.html(`<strong>${cohort}</strong><br/>${metrics[idx].label}: ${metrics[idx].fmt(d)}`);
				})
				.on('mouseleave', () => tip.style('opacity', '0'));
		}
		addDots(hiVals, '#dc2626', 'High-risk');
		addDots(loVals, '#2563eb', 'Routine');
	});
</script>

<svg bind:this={svg}></svg>

<div class="mt-3 flex justify-center gap-6 text-sm">
	<span class="flex items-center gap-1">
		<span class="inline-block h-3 w-3 rounded-full bg-[#2563eb]"></span> Routine elective
	</span>
	<span class="flex items-center gap-1">
		<span class="inline-block h-3 w-3 rounded-full bg-[#dc2626]"></span> High-risk cohort
	</span>
</div>

<style>
	svg text {
		font-weight: 500;
	}
</style>
