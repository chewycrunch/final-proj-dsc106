<script lang="ts">
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let patients: SurgeryCase[] = [];

  /* ---------- derive two cohorts ---------------------------------------- */
  /* composite score: deaths dominate, then ICU days, then blood loss  */
  const score = (d: SurgeryCase) =>
    (d.death_inhosp ? 1 : 0) * 1e3 + (d.icu_days || 0) * 4 + (d.intraop_ebl || 0) / 100;

  const sorted = patients
    .filter(d => d.preop_alb != null)                     // keep only complete rows
    .sort((a, b) => score(b) - score(a));

  const high   = sorted.slice(0, Math.max(1, Math.round(patients.length * 0.005)));
  const routine = patients.filter(
    d =>
      Number(d.age) < 50 &&
      Number(d.asa) <= 2 &&
      !d.emop &&
      d.death_inhosp === 0
  );

  /* helper to get median with fallback 0 */
  const med = (arr: SurgeryCase[], k: keyof SurgeryCase) =>
    d3.median(arr, d => Number(d[k]) || NaN) || 0;

  /** outcomes we plot */
  const metrics = [
    {
      key: 'mort',
      label: 'Mortality (%)',
      hi: med(high,   'death_inhosp') * 100,
      lo: med(routine,'death_inhosp') * 100,
      fmt: (v:number)=> v.toFixed(1) + '%'
    },
    {
      key: 'icu',
      label: 'ICU Stay (days)',
      hi: med(high,   'icu_days'),
      lo: med(routine,'icu_days'),
      fmt: (v:number)=> v.toFixed(1)
    },
    {
      key: 'blood',
      label: 'Blood Loss (mL)',
      hi: med(high,   'intraop_ebl'),
      lo: med(routine,'intraop_ebl'),
      fmt: (v:number)=> Math.round(v).toLocaleString()
    }
  ];

  const W = 620, H = 260, M = {t: 30, r: 40, b: 30, l: 160};
  let svg: SVGSVGElement;

  onMount(() => {
    const xMax = d3.max(metrics.flatMap(m => [m.hi, m.lo])) || 1;
    const x = d3.scaleLinear().domain([0, xMax * 1.1]).range([M.l, W - M.r]);

    const g = d3.select(svg)
      .attr('width', W)
      .attr('height', H)
      .append('g');

    /* axis */
    g.append('g')
      .attr('transform', `translate(0,${H - M.b})`)
      .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0))
      .selectAll('text').attr('font-size', 11);

    /* draw one row per metric */
    const row = g.selectAll('.row')
      .data(metrics)
      .enter().append('g')
      .attr('class','row')
      .attr('transform', (_d,i)=>`translate(0,${M.t + i*60})`);

    /* label */
    row.append('text')
      .attr('x', M.l - 10)
      .attr('y', 4)
      .attr('text-anchor','end')
      .attr('font-size', 13)
      .attr('fill','#475569')
      .text(d=>d.label);

    /* line */
    row.append('line')
      .attr('x1', d=>x(d.lo))
      .attr('x2', d=>x(d.hi))
      .attr('y1',0).attr('y2',0)
      .attr('stroke','#a1a1aa')
      .attr('stroke-width',2);

    /* low-risk dot */
    row.append('circle')
      .attr('cx',d=>x(d.lo)).attr('r',6)
      .attr('fill','#2563eb');

    /* high-risk dot */
    row.append('circle')
      .attr('cx',d=>x(d.hi)).attr('r',6)
      .attr('fill','#dc2626');

    /* tooltips */
    const tip = d3.select(svg.parentElement)
      .append('div')
      .attr('class','fixed z-30 rounded bg-gray-900 px-2 py-1 text-xs text-white pointer-events-none opacity-0');

    row.selectAll('circle')
      .on('mousemove',(e,d)=>{
        const val = (e.target as SVGCircleElement).getAttribute('fill') === '#dc2626' ? d.hi : d.lo;
        tip.style('opacity','1')
           .style('left',(e.pageX+14)+'px')
           .style('top',(e.pageY-28)+'px')
           .html(`${d.label}<br><strong>${d.fmt(val)}</strong>`);
      })
      .on('mouseleave',()=> tip.style('opacity','0'));
  });
</script>

<div class="flex flex-col items-center">
  <svg bind:this={svg}></svg>

  <div class="mt-3 flex gap-6 text-sm">
    <span class="flex items-center gap-1">
      <span class="inline-block h-3 w-3 rounded-full bg-[#2563eb]"></span> Routine elective
    </span>
    <span class="flex items-center gap-1">
      <span class="inline-block h-3 w-3 rounded-full bg-[#dc2626]"></span> High-risk cohort
    </span>
  </div>
</div>

<style>
  svg text { font-family: Inter, system-ui, sans-serif; }
</style>
