<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  interface Patient {
    caseid: string;
    age: number;
    department: string;
    casestart: number;
    anestart: number;
    opstart: number;
    opend: number;
    aneend: number;
    caseend: number;
    optype: string;
    [key: string]: any;
  }

  interface AggregatedEvent {
    label: string;
    key: string;
    mean: number | null;
    min: number | null;
    max: number | null;
  }

  export let patients: Patient[] = [];
  export let groupBy: string = 'optype';
  export let ageRange: [number, number] = [0, 120];
  export let selectedDepartment: string | null = null;

  let groupValue: string | null = null;
  let timelineDiv: HTMLDivElement;
  let availableGroups: string[] = [];

  const eventDefs = [
    { label: 'Case Start', key: 'casestart' },
    { label: 'Anesthesia Start', key: 'anestart' },
    { label: 'Operation Start', key: 'opstart' },
    { label: 'Operation End', key: 'opend' },
    { label: 'Anesthesia End', key: 'aneend' },
    { label: 'Case End', key: 'caseend' }
  ];

  $: filteredPatients = patients.filter(p => 
    (!groupValue || p[groupBy] === groupValue) &&
    (!selectedDepartment || p.department === selectedDepartment) &&
    p.age >= ageRange[0] && p.age <= ageRange[1]
  );

  $: availableGroups = Array.from(new Set(patients.map(p => p[groupBy]))).filter(Boolean);

  function getEventTime(patient: Patient, key: string): number | null {
    if (typeof patient[key] === 'number') {
      return patient[key];
    }
    return null;
  }

  function computeAggregatedEvents(group: Patient[]): AggregatedEvent[] {
    if (!group.length) {
      return eventDefs.map(({ label, key }) => ({ label, key, mean: null, min: null, max: null }));
    }

    return eventDefs.map(({ label, key }) => {
      const times = group.map(p => getEventTime(p, key)).filter((t): t is number => t !== null);
      if (!times.length) return { label, key, mean: null, min: null, max: null };

      const plausibleDurationSeconds = 7 * 24 * 60 * 60;
      const filteredTimes = times.filter(time => Math.abs(time) < plausibleDurationSeconds);
      if (filteredTimes.length === 0 || (filteredTimes.length < (times.length * 0.1) && filteredTimes.length < 5)) {
         console.warn(`Outlier filtering removed all or most data for ${label}. Original: ${times.length}, Filtered: ${filteredTimes.length}`);
         return { label, key, mean: null, min: null, max: null };
      }

      const mean = d3.mean(filteredTimes) as number;
      const min = d3.min(filteredTimes) as number;
      const max = d3.max(filteredTimes) as number;

      return { label, key, mean, min, max };
    });
  }

  let aggEvents: AggregatedEvent[] = [];

  $: {
    aggEvents = computeAggregatedEvents(filteredPatients);
    if (timelineDiv) {
      renderTimeline();
    }
  }

  function renderTimeline() {
    if (!timelineDiv) return;
    timelineDiv.innerHTML = '';
    if (!aggEvents.length) return;

    const width = 800, height = 280;
    const legendWidth = 160;

    const plottableEvents = aggEvents.filter(e => e.mean !== null);
    const allMeanTimes = plottableEvents.map(e => e.mean as number);
    const overallExtent = d3.extent(allMeanTimes) as [number, number];
    let [overallMinMean, overallMaxMean] = overallExtent;

    if (overallMinMean === overallMaxMean) {
      overallMinMean -= 60;
      overallMaxMean += 60;
    }

    const domainMin = overallMinMean / 60;
    const domainMax = overallMaxMean / 60;
    const padding = (domainMax - domainMin) * 0.05;
    const paddedMin = (domainMin >= 0 && domainMin < padding && overallMinMean >= 0) ? 0 : domainMin - padding;
    const paddedMax = domainMax + padding;

    const svg = d3.select(timelineDiv)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const allEventLabels = eventDefs.map(e => e.label);

    const mutedDistinctColors = [
  '#52796F', // muted teal-green
  '#B08968', // warm muted ochre
  '#7B6D8D', // muted purple
  '#A3A380', // soft olive green
  '#8C6A57', // muted brown
  '#68829E', // dusty blue
];


const colorScale = d3.scaleOrdinal()
  .domain(allEventLabels)
  .range(mutedDistinctColors);

    const x = d3.scaleLinear()
      .domain([paddedMin, paddedMax])
      .range([legendWidth + 40, width - 60])
      .nice();

    const axis = d3.axisBottom(x).ticks(Math.min(plottableEvents.length + 1, 10));
    svg.append('g')
      .attr('transform', `translate(0,${height / 2})`)
      .call(axis.tickFormat((d: number) => `${Math.round(d)} min`))
      .selectAll('text')
      .style('font-size', '12px');

      const tooltip = d3.select(timelineDiv)
  .append('div')
  .attr('class', 'tooltip')
  .style('position', 'absolute')
  .style('padding', '6px 10px')
  .style('background', '#333')
  .style('color', 'white')
  .style('border-radius', '4px')
  .style('font-size', '12px')
  .style('pointer-events', 'none')
  .style('opacity', 0);

svg.selectAll('circle.event-marker')
  .data(plottableEvents)
  .enter()
  .append('circle')
  .attr('class', 'event-marker')
  .attr('cx', d => x(d.mean as number / 60))
  .attr('cy', height / 2)
  .attr('r', 10)
  .attr('fill', d => colorScale(d.label))
  .on('mouseover', (event, d) => {
    tooltip.transition().duration(200).style('opacity', 1);
    tooltip.html(`<strong>${d.label}</strong><br>${(d.mean! / 60).toFixed(1)} min`);
  })
  .on('mousemove', event => {
    tooltip
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 30}px`);
  })
  .on('mouseout', () => {
    tooltip.transition().duration(200).style('opacity', 0);
  });


    const legend = svg.append('g')
      .attr('class', 'event-legend')
      .attr('transform', `translate(20, 40)`);

    const legendItems = legend.selectAll<SVGGElement, {label: string, key: string}>('g')
      .data(eventDefs)
      .enter()
      .append('g')
      .attr('transform', (_d, i) => `translate(0, ${i * 25})`);

    legendItems.each(function(this: SVGGElement, d) {
      const g = d3.select(this);
      g.append('circle')
        .attr('r', 8)
        .attr('cy', 0)
        .attr('fill', colorScale(d.label));
      g.append('text')
        .attr('x', 16)
        .attr('y', 5)
        .attr('font-size', 13)
        .attr('fill', '#222')
        .text(d.label);
    });

    svg.append('text')
      .attr('x', width - 60)
      .attr('y', 20)
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .attr('fill', '#666')
      .text(`n = ${filteredPatients.length} patients`);

    let title = '';
    if (groupValue) title += `${groupBy === 'optype' ? 'Surgery Type' : 'Department'}: ${groupValue}`;
    if (selectedDepartment) title += title ? `, Department: ${selectedDepartment}` : `Department: ${selectedDepartment}`;
    if (ageRange[0] > 0 || ageRange[1] < 120) title += title ? `, Age: ${ageRange[0]}-${ageRange[1]}` : `Age: ${ageRange[0]}-${ageRange[1]}`;
    if (title) {
      svg.append('text')
        .attr('x', 100)
        .attr('y', 20)
        .attr('font-size', 12)
        .attr('fill', '#666')
        .text(title);
    }

    const totalDuration = (paddedMax - paddedMin);
    svg.append('text')
      .attr('x', width - 60)
      .attr('y', height - 10)
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .attr('fill', '#666')
      .text(`Total duration: ${Math.round(totalDuration)} min`);
  }

  onMount(() => {
    if (timelineDiv) renderTimeline();
  });
</script>

<div>
  <div class="filter-controls" style="margin-bottom: 1.5rem;">
    <label for="group-select" style="font-weight:600;">Group By:</label>
    <select id="group-select" bind:value={groupBy} style="margin:0 1rem 0.5rem 0;">
      <option value="optype">Surgery Type</option>
      <option value="department">Department</option>
    </select>

    <label for="group-value" style="font-weight:600;">Filter Value:</label>
    <select id="group-value" bind:value={groupValue} style="margin:0 1rem 0.5rem 0;">
      <option value={null}>All</option>
      {#each availableGroups as type}
        <option value={type}>{type}</option>
      {/each}
    </select>

    <div style="margin-top: 0.5rem;">
      <label style="font-weight:600;">Age Range:</label>
      <input type="number" min="0" max="120" bind:value={ageRange[0]} style="width:60px; margin:0 0.5rem;" />
      <span>to</span>
      <input type="number" min="0" max="120" bind:value={ageRange[1]} style="width:60px; margin:0 0.5rem;" />
    </div>
  </div>

  <div bind:this={timelineDiv}></div>
  {#if filteredPatients.length === 0}
    <div style="color: #ef4444; padding: 1rem; text-align: center;">No patients match the selected criteria.</div>
  {/if}
</div>

<style>
  :global(.event-label) {
    font-family: 'Work Sans', Arial, sans-serif;
    font-weight: 600;
  }
  .filter-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
</style>