<!-- src/lib/RiskRadar.svelte -->
<script lang="ts">
	import * as d3 from 'd3';
	export let patients: SurgeryCase[] = [];

	/* ──────── 1.  pick high- and low-risk cohorts ──────── */
	/** composite score: deaths ▸ ICU days ▸ blood-loss        */
	const score = (c: SurgeryCase) =>
		(c.death_inhosp ? 1 : 0) * 1e6 + // any death → dwarf everything
		(c.icu_days ?? 0) * 100 +
		(c.intraop_ebl ?? 0);

	/* keep only rows with all three metrics present           */
	const valid = patients
		.filter((p) => p.icu_days != null && p.intraop_ebl != null)
		.sort((a, b) => score(b) - score(a));

	const highGrp = valid.slice(0, Math.max(3, Math.floor(valid.length * 0.005))); // top 0.5 %
	const lowGrp = valid
		.filter((p) => !p.death_inhosp)
		.slice(-Math.max(10, Math.floor(valid.length * 0.1))); // best 10 %

	/* ──────── 2.  median metrics for the two groups ──────── */
	type AxisKey = 'mort' | 'icu' | 'blood';
	interface Axis {
		key: AxisKey;
		label: string;
	}

	const axes: Axis[] = [
		{ key: 'mort', label: 'Mortality (%)' },
		{ key: 'icu', label: 'ICU Stay (d)' },
		{ key: 'blood', label: 'Blood Loss (mL)' }
	];

	function median(g: SurgeryCase[], k: AxisKey) {
		switch (k) {
			case 'mort':
				return d3.mean(g, (d) => d.death_inhosp ?? 0)! * 100;
			case 'icu':
				return d3.median(g, (d) => d.icu_days ?? 0)!;
			case 'blood':
				return d3.median(g, (d) => d.intraop_ebl ?? 0)!;
		}
	}

	const hi = Object.fromEntries(axes.map((a) => [a.key, median(highGrp, a.key)])) as Record<
		AxisKey,
		number
	>;
	const lo = Object.fromEntries(axes.map((a) => [a.key, median(lowGrp, a.key)])) as Record<
		AxisKey,
		number
	>;

	/* ──────── 3.  radial-plot helpers ──────── */
	const R = 140; // outer radius
	const maxV = d3.max(axes, (a) => Math.max(hi[a.key], lo[a.key])) || 1;
	const angle = (i: number) => Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
	const scale = (v: number) => (v / maxV) * R;

	const poly = (m: Record<AxisKey, number>) =>
		axes.map((a, i) => {
			const r = scale(m[a.key]);
			return [r * Math.cos(angle(i)), -r * Math.sin(angle(i))];
		});

	/* neat tooltip (pure SVG) */
	let tip: SVGTextElement | null = null;
	let tipBG: SVGRectElement | null = null;
	function showTip(evt: MouseEvent, label: string, v: number) {
		if (!tip || !tipBG) return;
		tip.textContent = `${label}: ${d3.format('.2~s')(v)}`;
		const { x, y } = (evt.target as SVGCircleElement).getBoundingClientRect();
		const pt = tip.ownerSVGElement!.createSVGPoint();
		pt.x = x;
		pt.y = y;
		const svgP = pt.matrixTransform(tip.ownerSVGElement!.getScreenCTM()!.inverse());
		tip.setAttribute('x', String(svgP.x + 12));
		tip.setAttribute('y', String(svgP.y - 12));
		const bbox = tip.getBBox();
		tipBG.setAttribute('x', String(bbox.x - 4));
		tipBG.setAttribute('y', String(bbox.y - 2));
		tipBG.setAttribute('width', String(bbox.width + 8));
		tipBG.setAttribute('height', String(bbox.height + 4));
		tip.style.opacity = tipBG.style.opacity = '1';
	}
	function hideTip() {
		if (tip && tipBG) tip.style.opacity = tipBG.style.opacity = '0';
	}
</script>

<svg viewBox="-180 -180 360 360" class="mx-auto fill-gray-500 font-sans text-[12px] select-none">
	<!-- concentric rings -->
	{#each [0.25, 0.5, 0.75, 1] as f}
		<circle r={R * f} fill="none" stroke="#d4d4d4" stroke-dasharray="4 3" />
	{/each}

	<!-- axis spokes & labels -->
	{#each axes as { key, label }, i}
		<g>
			<line x1="0" y1="0" x2={R * Math.cos(angle(i))} y2={-R * Math.sin(angle(i))} stroke="#999" />
			<text
				x={(R + 18) * Math.cos(angle(i))}
				y={-(R + 18) * Math.sin(angle(i))}
				text-anchor="middle"
				dominant-baseline="middle">{label}</text
			>
		</g>
	{/each}

	<!-- low-risk poly & dots -->
	<polygon
		points={poly(lo).join(' ')}
		fill="rgba(59,130,246,.4)"
		stroke="#2563eb"
		stroke-width="2"
	/>
	{#each axes as a, i}
		<circle
			r="4"
			fill="#2563eb"
			cx={poly(lo)[i][0]}
			cy={poly(lo)[i][1]}
			on:mouseover={(e) => showTip(e, a.label, lo[a.key])}
			on:mouseout={hideTip}
		/>
	{/each}

	<!-- high-risk poly & dots -->
	<polygon
		points={poly(hi).join(' ')}
		fill="rgba(220,38,38,.25)"
		stroke="#dc2626"
		stroke-width="2"
	/>
	{#each axes as a, i}
		<circle
			r="4"
			fill="#dc2626"
			cx={poly(hi)[i][0]}
			cy={poly(hi)[i][1]}
			on:mouseover={(e) => showTip(e, a.label, hi[a.key])}
			on:mouseout={hideTip}
		/>
	{/each}

	<!-- SVG tooltip (hidden by default) -->
	<rect bind:this={tipBG} fill="#111" rx="3" ry="3" opacity="0" />
	<text bind:this={tip} fill="#fff" font-size="11" opacity="0"></text>

	<!-- legend -->
	<g transform={`translate(${-R},${R + 24})`}>
		<rect width="12" height="12" fill="rgba(220,38,38,.6)" /><text x="18" y="10"
			>High-risk (top 0.5 %)</text
		>
		<rect y="20" width="12" height="12" fill="rgba(59,130,246,.6)" /><text x="18" y="30"
			>Low-risk (best 10 %)</text
		>
	</g>
</svg>

<style>
	svg text {
		pointer-events: none;
	}
</style>
