<!--  File: src/lib/AlbuminRiskScatter.svelte  -->
<script lang="ts">
	/* Svelte & D3 -------------------------------------------------------------- */
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	/* incoming data from +page.svelte ----------------------------------------- */
	export let patients: SurgeryCase[] = [];

	/* ---------------------------------------------------------------- UI state */
	let filter: 'elective' | 'emergency' | 'all' = 'elective';

	/* ---------------------------------------------------------------- SVG refs */
	let svg: SVGSVGElement;
	const W = 640,
		H = 260,
		pad = 36;

	/* albumin helper (valid > 0 g/dL only) ----------------------------------- */
	const alb = (v: unknown) => {
		const n = +v!;
		return Number.isFinite(n) && n > 0 ? n : null;
	};

	/* ---------------------------------------------------------------- REACTIVE SLICE */
	let slice: SurgeryCase[] = []; // declare first for TS
	let stats: { q1: number; med: number; q3: number } | null = null;

	/* subset + stats recompute whenever patients or filter changes */
	$: {
		slice = patients.filter((p) => {
			const a = alb(p.preop_alb);
			if (a === null) return false; // need albumin
			if (filter === 'elective') return p.emop === 0 && p.ane_type === 'General';
			if (filter === 'emergency') return p.emop === 1;
			return true; // 'all'
		});

		if (slice.length) {
			const xs = slice.map((d) => alb(d.preop_alb)!).sort(d3.ascending);
			stats = {
				q1: d3.quantile(xs, 0.25)!,
				med: d3.quantile(xs, 0.5)!,
				q3: d3.quantile(xs, 0.75)!
			};
		} else stats = null;
	}

	/* ---------------------------------------------------------------- DRAW */
	function draw() {
		if (!svg) return;
		const root = d3.select(svg).attr('viewBox', `0 0 ${W} ${H}`).html('');

		if (!slice.length) {
			root
				.append('text')
				.attr('x', W / 2)
				.attr('y', H / 2)
				.attr('text-anchor', 'middle')
				.attr('fill', '#888')
				.text('No cases with albumin in this view');
			return;
		}

		/* scales ------------------------------------------------------------- */
		const xs = slice.map((d) => alb(d.preop_alb)!);
		const x = d3
			.scaleLinear()
			.domain(d3.extent(xs) as [number, number])
			.nice()
			.range([pad, W - pad]);

		const colour = d3
			.scaleSequential(d3.interpolateRdYlBu) // red = long ICU
			.domain([d3.max(slice, (d) => +d.icu_days || 0) ?? 5, 0]);

		const jitter = d3
			.scaleLinear()
			.domain([0, 1])
			.range([H - pad, pad]);

		/* IQR band ----------------------------------------------------------- */
		if (stats) {
			root
				.append('rect')
				.attr('x', x(stats.q1))
				.attr('y', pad / 2)
				.attr('width', x(stats.q3) - x(stats.q1))
				.attr('height', H - pad)
				.attr('fill', '#aaa')
				.attr('fill-opacity', 0.1);

			root
				.append('line')
				.attr('x1', x(stats.med))
				.attr('x2', x(stats.med))
				.attr('y1', pad / 2)
				.attr('y2', H - pad / 2)
				.attr('stroke', '#555')
				.attr('stroke-width', 1.2)
				.append('title')
				.text(
					`Median ${stats.med.toFixed(2)} g/dL | IQR ${stats.q1.toFixed(2)}-${stats.q3.toFixed(2)}`
				);
		}

		/* dots ---------------------------------------------------------------- */
		root
			.append('g')
			.selectAll('circle')
			.data(slice)
			.enter()
			.append('circle')
			.attr('cx', (d) => x(alb(d.preop_alb)!))
			.attr('cy', () => jitter(Math.random()))
			.attr('r', 4)
			.attr('fill', (d) => colour(+d.icu_days || 0))
			.append('title')
			.text(
				(d) => `Case ${d.caseid}
Albumin: ${alb(d.preop_alb)} g/dL
ICU stay: ${d.icu_days || 0} day(s)`
			);

		/* axis ---------------------------------------------------------------- */
		root
			.append('g')
			.attr('transform', `translate(0,${H - pad})`)
			.call(
				d3
					.axisBottom(x)
					.ticks(6)
					.tickFormat((d) => d + ' g/dL')
			);

		root
			.append('text')
			.attr('x', W / 2)
			.attr('y', H - 6)
			.attr('text-anchor', 'middle')
			.attr('fill', '#475569')
			.style('font-size', '1rem')
			.text('Pre-operative Albumin');
	}

	/* draw on mount and whenever slice OR svg changes */
	onMount(draw);
	$: if (svg) draw();
</script>

<!-- ----------------------------- Filter UI -->
<div class="mb-3 flex gap-4 text-sm">
	<label><input type="radio" bind:group={filter} value="elective" /> Elective</label>
	<label><input type="radio" bind:group={filter} value="emergency" /> Emergency</label>
	<label><input type="radio" bind:group={filter} value="all" /> All</label>
</div>

<svg bind:this={svg} style="max-width:100%"></svg>

<style>
	svg text {
		font-family: system-ui, sans-serif;
	}
	.dots circle {
		transition: r 0.15s ease-out;
	}
	.dots circle:hover {
		r: 6;
		stroke: #333;
		stroke-width: 1.2;
	}
</style>
