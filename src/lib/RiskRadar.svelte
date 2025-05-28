<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { select } from 'd3-selection';
	import { lineRadial } from 'd3-shape';

	export let high!: SurgeryCase; // summary of high-risk cohort
	export let low!: SurgeryCase; // summary of low-risk cohort

	const axes = [
		{ key: 'death_inhosp', label: 'Mortality (%)' },
		{ key: 'icu_days', label: 'ICU Stay (days)' },
		{ key: 'intraop_ebl', label: 'Blood Loss (mL)' }
	];

	let svg: SVGSVGElement;
	let tip: HTMLDivElement;
	const R = 140; // outer radius
	const angle = (i: number) => ((Math.PI * 2) / axes.length) * i;

	function draw() {
		if (!high || !low) return;
		const s = select(svg).attr('viewBox', '-240 -180 470 360').selectAll('*').remove();

		/* ---- scale each axis by max(high,low) ---- */
		const rows = axes.map((a, i) => {
			const hi = +(high as any)[a.key] || 0;
			const lo = +(low as any)[a.key] || 0;
			const denom = Math.max(hi, lo) || 1;
			return { a, hi, lo, hiN: hi / denom, loN: lo / denom };
		});

		const line = lineRadial<number>()
			.radius((d) => d * R)
			.angle((_, i) => angle(i));

		const g = select(svg).append('g');

		// grid
		for (let t = 1; t <= 4; t++)
			g.append('circle')
				.attr('r', (R * t) / 4)
				.attr('fill', 'none')
				.attr('stroke', '#bbb')
				.attr('stroke-dasharray', '3 3');

		// spokes + axis labels
		rows.forEach((d, i) => {
			const x = Math.sin(angle(i)) * R,
				y = -Math.cos(angle(i)) * R;
			g.append('line')
				.attr('x1', 0)
				.attr('y1', 0)
				.attr('x2', x)
				.attr('y2', y)
				.attr('stroke', '#888');
			g.append('text')
				.attr('x', x * 1.13)
				.attr('y', y * 1.13)
				.attr('text-anchor', x >= 0 ? 'start' : 'end')
				.attr('alignment-baseline', 'middle')
				.attr('font-size', 12)
				.text(d.a.label);
		});

		// polygons
		const blue = '#1f77b4',
			red = '#d62728';
		const hiPoly = rows.map((r) => r.hiN).concat(rows[0].hiN);
		const loPoly = rows.map((r) => r.loN).concat(rows[0].loN);

		g.append('path')
			.datum(loPoly)
			.attr('d', line as any)
			.attr('fill', blue)
			.attr('fill-opacity', 0.35)
			.attr('stroke', blue)
			.attr('stroke-width', 2);
		g.append('path')
			.datum(hiPoly)
			.attr('d', line as any)
			.attr('fill', red)
			.attr('fill-opacity', 0.35)
			.attr('stroke', red)
			.attr('stroke-width', 2);

		// data points with tooltip
		const showDots = (field: 'hiN' | 'loN', raw: 'hi' | 'lo', clr: string) => {
			g.selectAll('.dot-' + field)
				.data(rows)
				.enter()
				.append('circle')
				.attr('class', 'dot-' + field)
				.attr('r', 4)
				.attr('cx', (d, i) => Math.sin(angle(i)) * (d as any)[field] * R)
				.attr('cy', (d, i) => -Math.cos(angle(i)) * (d as any)[field] * R)
				.attr('fill', clr)
				.on('mouseover', (e, d) => {
					tip.style.opacity = '1';
					tip.textContent = `${d.a.label}: ${(d as any)[raw]}`;
				})
				.on(
					'mousemove',
					(e) => (tip.style.transform = `translate(${e.pageX + 12}px,${e.pageY - 24}px)`)
				)
				.on('mouseout', () => (tip.style.opacity = '0'));
		};
		showDots('hiN', 'hi', red);
		showDots('loN', 'lo', blue);

		// legend
		g.append('rect')
			.attr('x', -50)
			.attr('y', R + 22)
			.attr('width', 12)
			.attr('height', 12)
			.attr('fill', red);
		g.append('text')
			.attr('x', -30)
			.attr('y', R + 32)
			.text('High-risk')
			.attr('font-size', 12);
		g.append('rect')
			.attr('x', 60)
			.attr('y', R + 22)
			.attr('width', 12)
			.attr('height', 12)
			.attr('fill', blue);
		g.append('text')
			.attr('x', 80)
			.attr('y', R + 32)
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
