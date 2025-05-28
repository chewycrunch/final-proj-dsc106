<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  export let selectedPatient: Record<string, any>;
  let timelineDiv: HTMLDivElement;

  onMount(() => {
    if (!selectedPatient) return;
    timelineDiv.innerHTML = '';
    const width = 600, height = 80;
    const svg = d3.select(timelineDiv)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Parse dates
    const events = [
      { label: 'Case Start', time: new Date(selectedPatient.casestart) },
      { label: 'Op Start', time: new Date(selectedPatient.opstart) },
      { label: 'Op End', time: new Date(selectedPatient.opend) },
      { label: 'Discharge', time: new Date(selectedPatient.dis) }
    ];
    const x = d3.scaleTime()
      .domain(d3.extent(events, (d: { time: Date }) => d.time) as [Date, Date])
      .range([50, width - 50]);

    // Draw axis
    svg.append('g')
      .attr('transform', `translate(0,${height/2})`)
      .call(d3.axisBottom(x).ticks(events.length).tickFormat(d3.timeFormat('%b %d')));

    // Draw event markers
    svg.selectAll('circle')
      .data(events)
      .enter()
      .append('circle')
      .attr('cx', (d: { time: Date }) => x(d.time))
      .attr('cy', height/2)
      .attr('r', 8)
      .attr('fill', (_d: { time: Date }, i: number) => i === 3 && selectedPatient.death_inhosp ? 'red' : 'steelblue');

    // Draw ICU stay as a bar (if icu_days > 0)
    if (selectedPatient.icu_days > 0) {
      svg.append('rect')
        .attr('x', x(new Date(selectedPatient.opend)))
        .attr('y', height/2 - 15)
        .attr('width', x(new Date(selectedPatient.dis)) - x(new Date(selectedPatient.opend)))
        .attr('height', 30)
        .attr('fill', 'orange')
        .attr('opacity', 0.5);
    }
  });
</script>
<div bind:this={timelineDiv}></div> 