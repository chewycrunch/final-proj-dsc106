<script lang="ts">
	import * as d3 from 'd3';
	// @ts-ignore — if the project hasn’t installed @types/d3-regression yet
	import { regressionLoess } from 'd3-regression';
	import { onMount } from 'svelte';

	/***********************  props  *****************************/
	export let patients: SurgeryCase[] = [];

	/***********************  dims & refs  ***********************/
	const W = 720,
		H = 440,
		M = { t: 32, r: 32, b: 50, l: 54 };
	let canvas: HTMLCanvasElement;
	let svg: SVGSVGElement;
	let ctx: CanvasRenderingContext2D;
	let tip: HTMLDivElement;

	/***********************  state  *****************************/
	let mode: 'median' | 'loess' = 'median'; // trend mode

	/***********************  scales  ****************************/
	// guard empty data
	const ages = patients.map((p) => Number(p.age) || 0);
	const albs = patients.map((p) => Number(p.preop_alb) || 0);
	const icus = patients.map((p) => Number(p.icu_days) || 0);

	const x = d3
		.scaleLinear()
		.domain([0, 95])
		.range([M.l, W - M.r]);
	const y = d3
		.scaleLinear()
		.domain([2, 5])
		.range([H - M.b, M.t]);
	const colour = d3
		.scaleSequential(d3.interpolatePlasma)
		.domain(d3.extent(icus) as [number, number]);

	const shape = (p: SurgeryCase) => (p.emop === 1 ? 'triangle' : 'circle');

	/**********************  drawing points **********************/
	function drawPoints() {
		ctx.clearRect(0, 0, W, H);
		patients.forEach((p) => {
			const age = Number(p.age);
			const alb = Number(p.preop_alb);
			if (!age || !alb) return;

			ctx.fillStyle = colour(Number(p.icu_days) || 0);
			const px = x(age),
				py = y(alb);

			if (shape(p) === 'triangle') {
				ctx.beginPath();
				ctx.moveTo(px, py - 4); // ▲
				ctx.lineTo(px + 4, py + 4);
				ctx.lineTo(px - 4, py + 4);
				ctx.closePath();
				ctx.fill();
			} else {
				ctx.beginPath();
				ctx.arc(px, py, 3.5, 0, Math.PI * 2);
				ctx.fill();
			}
		});
	}

	/**********************  trend helpers  **********************/
	function medianTrend(): [number, number][] {
		const bins = d3
			.bin<SurgeryCase, number>()
			.value((d) => Number(d.age) || 0)
			.domain([0, 95])
			.thresholds(10)(patients);

		return bins
			.map((b) => {
				const alb = d3.median(b, (d) => Number(d.preop_alb) || NaN);
				const age = d3.median(b, (d) => Number(d.age) || NaN);
				return alb && age ? [x(age), y(alb)] : null;
			})
			.filter(Boolean) as [number, number][];
	}

	function loessTrend(): [number, number][] {
		try {
			const good = patients.filter((p) => p.preop_alb && p.age);
			const loess = regressionLoess<SurgeryCase>()
				.x((d) => Number(d.age))
				.y((d) => Number(d.preop_alb))
				.bandwidth(0.4)(good);

			return loess.map(([a, b]) => [x(a), y(b)]);
		} catch {
			// fallback → just return median trend
			return medianTrend();
		}
	}

	let trendPath = '';

	/***********************  tooltip logic  **********************/
	function nearest(e: MouseEvent) {
		const mx = e.offsetX,
			my = e.offsetY;
		const r = 8,
			r2 = r * r;
		let hit: SurgeryCase | null = null;

		for (const p of patients) {
			const age = Number(p.age),
				alb = Number(p.preop_alb);
			if (!age || !alb) continue;
			const dx = x(age) - mx,
				dy = y(alb) - my;
			if (dx * dx + dy * dy < r2) {
				hit = p;
				break;
			}
		}

		if (hit) {
			tip.style.opacity = '1';
			tip.style.left = e.pageX + 14 + 'px';
			tip.style.top = e.pageY - 28 + 'px';
			tip.innerHTML = `
        <strong>Case ${hit.caseid}</strong><br>
        Age ${hit.age} yr<br>
        Alb ${Number(hit.preop_alb).toFixed(1)} g/dL<br>
        ICU ${hit.icu_days || 0} d<br>
        ${hit.emop ? 'Emergency' : 'Elective'}
      `;
		} else {
			tip.style.opacity = '0';
		}
	}

	/***********************  lifecycle  *************************/
	onMount(() => {
		ctx = canvas.getContext('2d')!;
		drawPoints();

		// axes
		const gx = d3
			.select(svg)
			.append('g')
			.attr('transform', `translate(0,${H - M.b})`)
			.call(d3.axisBottom(x).ticks(10));
		const gy = d3
			.select(svg)
			.append('g')
			.attr('transform', `translate(${M.l},0)`)
			.call(d3.axisLeft(y).ticks(6));

		// axis labels
		d3.select(svg)
			.append('text')
			.attr('x', W / 2)
			.attr('y', H - 10)
			.attr('text-anchor', 'middle')
			.attr('fill', '#475569')
			.attr('font-size', 12)
			.text('Age (years)');
		d3.select(svg)
			.append('text')
			.attr('x', -H / 2)
			.attr('y', 14)
			.attr('transform', 'rotate(-90)')
			.attr('text-anchor', 'middle')
			.attr('fill', '#475569')
			.attr('font-size', 12)
			.text('Albumin (g/dL)');
	});

	// recompute trend & redraw on state change
	$: {
		trendPath =
			d3.line()((mode === 'median' ? medianTrend() : loessTrend()) as [number, number][]) || '';
	}
</script>

<div class="relative" on:mousemove={nearest} on:mouseleave={() => (tip.style.opacity = '0')}>
	<canvas bind:this={canvas} width={W} height={H} style="display:block;"></canvas>

	<svg
		bind:this={svg}
		width={W}
		height={H}
		style="position:absolute;top:0;left:0;pointer-events:none;"
	>
		{#if trendPath}
			<path d={trendPath} fill="none" stroke="#0ea5e9" stroke-width="2" />
		{/if}
	</svg>

	<!-- toggle -->
	<div class="absolute top-2 right-2 flex rounded-full bg-slate-200 text-sm">
		{#each ['median', 'loess'] as m}
			<button
				type="button"
				aria-label={`show ${m} trend`}
				on:click={() => (mode = m)}
				class="rounded-full px-3 py-1 transition hover:bg-white focus-visible:outline
                     {mode === m ? 'bg-white font-semibold' : ''}"
			>
				{m}
			</button>
		{/each}
	</div>

	<!-- tooltip -->
	<div
		bind:this={tip}
		class="pointer-events-none fixed z-30 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0"
	></div>
</div>

<style>
	canvas {
		width: 100%;
		height: auto;
	}
	svg text {
		font:
			12px/1.3 'Inter',
			system-ui,
			sans-serif;
	}
</style>
