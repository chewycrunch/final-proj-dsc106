<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { lineRadial } from 'd3-shape';

	/* ---------- prop ---------- */
	export let cases: SurgeryCase[] = [];

	/* ---------- pick high-risk & low-risk ---------- */
	let high: SurgeryCase | null = null;
	let low: SurgeryCase | null = null;

	const riskScore = (c: SurgeryCase) =>
		/* deaths dominate, then ICU days, then blood loss */
		c.death_inhosp * 1e6 + c.icu_days * 1e3 + c.intraop_ebl;

	$: if (cases.length) {
		/* split by mortality status first */
		const survivors = cases.filter((c) => c.death_inhosp === 0);
		const mortalities = cases.filter((c) => c.death_inhosp === 1);

		/* safest survivor = lowest score among survivors */
		survivors.sort((a, b) => riskScore(a) - riskScore(b));
		low = survivors[0] ?? null;

		/* riskiest = highest score overall (ties favour deaths) */
		const all = [...cases].sort((a, b) => riskScore(b) - riskScore(a));
		high = all[0] ?? null;
	}

	/* ---------- chart geometry ---------- */
	const axes = [
		{ key: 'death_inhosp', label: 'Mortality (%)', colour: '#d62728' },
		{ key: 'icu_days', label: 'ICU Stay (days)', colour: '#ff8800' },
		{ key: 'intraop_ebl', label: 'Blood Loss (mL)', colour: '#2ca02c' }
	];
	const R = 140;
	const angle = (i: number) => ((Math.PI * 2) / axes.length) * i;

	let svg: SVGSVGElement;
	let tip: HTMLDivElement;

	/* ---------- draw ---------- */
	function draw() {
		if (!svg) return;
		const s = select(svg).attr('viewBox', '-220 -190 440 380');
		s.selectAll('*').remove();
		if (!high || !low) return;

		/* scale each axis by max(high, low) */
		const rows = axes.map((a) => {
			const hi = (high as any)[a.key] as number;
			const lo = (low as any)[a.key] as number;
			const max = Math.max(hi, lo) || 1;
			return { a, hi, lo, hiN: hi / max, loN: lo / max };
		});

		const g = s.append('g');

		/* grid */
		for (let r = 1; r <= 4; r++)
			g.append('circle')
				.attr('r', (R * r) / 4)
				.attr('fill', 'none')
				.attr('stroke', '#bbb')
				.attr('stroke-dasharray', '4 3');

		/* spokes & labels */
		rows.forEach((d, i) => {
			const x = Math.sin(angle(i)) * R;
			const y = -Math.cos(angle(i)) * R;
			g.append('line')
				.attr('x1', 0)
				.attr('y1', 0)
				.attr('x2', x)
				.attr('y2', y)
				.attr('stroke', d.a.colour)
				.attr('stroke-width', 1.4);
			g.append('text')
				.attr('x', x * 1.15)
				.attr('y', y * 1.15)
				.attr('text-anchor', x >= 0 ? 'start' : 'end')
				.attr('alignment-baseline', 'middle')
				.attr('font-size', 12)
				.text(d.a.label);
		});

		/* polygons */
		const radialLine = lineRadial<number>()
			.radius((d) => d * R)
			.angle((_, i) => angle(i));

		const poly = (f: 'hiN' | 'loN') => rows.map((r) => (r as any)[f]).concat(rows[0][f]);
		const blue = '#1f77b4',
			red = '#d62728';

		g.append('path')
			.attr('d', radialLine(poly('loN')) as any)
			.attr('fill', blue)
			.attr('fill-opacity', 0.35)
			.attr('stroke', blue)
			.attr('stroke-width', 2);

		g.append('path')
			.attr('d', radialLine(poly('hiN')) as any)
			.attr('fill', red)
			.attr('fill-opacity', 0.35)
			.attr('stroke', red)
			.attr('stroke-width', 2);

		/* dots & tooltip */
		function addDots(norm: 'hiN' | 'loN', raw: 'hi' | 'lo', colour: string) {
			g.selectAll('.dot-' + norm)
				.data(rows)
				.enter()
				.append('circle')
				.attr('class', 'dot-' + norm)
				.attr('r', 4)
				.attr('cx', (d, i) => Math.sin(angle(i)) * (d as any)[norm] * R)
				.attr('cy', (d, i) => -Math.cos(angle(i)) * (d as any)[norm] * R)
				.attr('fill', colour)
				.on('mouseover', (_e, d) => {
					tip.style.opacity = '1';
					tip.textContent = `${d.a.label}: ${(d as any)[raw]}`;
				})
				.on(
					'mousemove',
					(e) => (tip.style.transform = `translate(${e.pageX + 12}px,${e.pageY - 24}px)`)
				)
				.on('mouseout', () => (tip.style.opacity = '0'));
		}
		addDots('loN', 'lo', blue);
		addDots('hiN', 'hi', red);

		/* legend */
		g.append('rect')
			.attr('x', -52)
			.attr('y', R + 24)
			.attr('width', 12)
			.attr('height', 12)
			.attr('fill', red);
		g.append('text')
			.attr('x', -34)
			.attr('y', R + 33)
			.text('High-risk')
			.attr('font-size', 12);
		g.append('rect')
			.attr('x', 54)
			.attr('y', R + 24)
			.attr('width', 12)
			.attr('height', 12)
			.attr('fill', blue);
		g.append('text')
			.attr('x', 72)
			.attr('y', R + 33)
			.text('Low-risk')
			.attr('font-size', 12);
	}

	onMount(draw);
	afterUpdate(draw);
</script>

<svg bind:this={svg} class="mx-auto w-full max-w-md"></svg>
<div bind:this={tip} class="radar-tip"></div>

<style>
	.radar-tip {
		position: fixed;
		padding: 4px 8px;
		background: #000;
		color: #fff;
		border-radius: 4px;
		font-size: 12px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s;
		z-index: 1000;
	}
</style>
