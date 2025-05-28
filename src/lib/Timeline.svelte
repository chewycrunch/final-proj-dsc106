<script lang="ts">
    import { onMount } from 'svelte';
    import * as d3 from 'd3';
    // Test patient for debugging
    const testPatient = {
      adm: '2023-01-01T08:00:00Z',
      casestart: 0,
      anestart: 600, // 10 minutes after casestart
      opstart: 1200, // 20 minutes after casestart
      opend: 3600,   // 1 hour after casestart
      caseend: 4000,
      dis: '2023-01-05T10:00:00Z'
    };
    // Use testPatient for debugging
    let patientToPlot = testPatient;
    let timelineDiv: HTMLDivElement;
    let hasRendered = false;
  
    // Helper to get absolute event date
    function getEventDate(patient: Record<string, any>, key: string): Date | null {
      let refDate: Date;
      if (patient.adm && !isNaN(new Date(patient.adm).getTime())) {
        refDate = new Date(patient.adm);
      } else {
        refDate = new Date('2000-01-01T00:00:00Z');
      }
      if (key === 'adm') return refDate;
      if (key === 'dis' && patient.dis) return new Date(patient.dis);
      // All other keys are offsets in seconds from casestart
      if (typeof patient[key] === 'number') {
        return new Date(refDate.getTime() + patient[key] * 1000);
      }
      return null;
    }
  
    onMount(() => {
      if (!patientToPlot) {
        hasRendered = false;
        return;
      }
      console.log('Timeline patientToPlot:', patientToPlot);
      timelineDiv.innerHTML = '';
      const width = 800, height = 140;
      const svg = d3.select(timelineDiv)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
  
      // Collect all relevant events, skipping missing ones
      const events = [
        { label: 'Hospital Admission', key: 'adm' },
        { label: 'Case Start', key: 'casestart' },
        { label: 'Anesthesia Start', key: 'anestart' },
        { label: 'Operation Start', key: 'opstart' },
        { label: 'Operation End', key: 'opend' },
        { label: 'Anesthesia End', key: 'aneend' },
        { label: 'Case End', key: 'caseend' },
        { label: 'Hospital Discharge', key: 'dis' }
      ].map(e => ({
        label: e.label,
        time: getEventDate(patientToPlot, e.key)
      })).filter((e: { time: Date | null }) => e.time && !isNaN(e.time.getTime()));

      console.log('Timeline events:', events.map(e => ({ label: e.label, time: e.time?.toISOString() })));
  
      if (events.length < 2) {
        hasRendered = false;
        return;
      }
      hasRendered = true;
  
      // Time scale
      const x = d3.scaleTime()
        .domain(d3.extent(events, (d: { time: Date }) => d.time) as [Date, Date])
        .range([100, width - 60]);
  
      // Draw axis
      svg.append('g')
        .attr('transform', `translate(0,${height/2})`)
        .call(d3.axisBottom(x).ticks(events.length).tickFormat(d3.timeFormat('%b %d %H:%M')));
  
      // Draw event markers and labels
      svg.selectAll('circle')
        .data(events)
        .enter()
        .append('circle')
        .attr('cx', (d: { time: Date }) => x(d.time))
        .attr('cy', height/2)
        .attr('r', 10)
        .attr('fill', (_d: { time: Date }, i: number) => i === 0 ? '#14b8a6' : (i === events.length-1 ? '#facc15' : '#1e293b'));
  
      svg.selectAll('text.event-label')
        .data(events)
        .enter()
        .append('text')
        .attr('class', 'event-label')
        .attr('x', (d: { time: Date }) => x(d.time))
        .attr('y', height/2 - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', 13)
        .attr('fill', '#222')
        .text((d: { label: string }) => d.label);
  
      // Draw operation period as a bar
      if (patientToPlot.opstart !== undefined && patientToPlot.opend !== undefined) {
        const opStart = getEventDate(patientToPlot, 'opstart');
        const opEnd = getEventDate(patientToPlot, 'opend');
        if (opStart && opEnd && !isNaN(opStart.getTime()) && !isNaN(opEnd.getTime())) {
          svg.append('rect')
            .attr('x', x(opStart))
            .attr('y', height/2 + 18)
            .attr('width', x(opEnd) - x(opStart))
            .attr('height', 14)
            .attr('fill', '#14b8a6')
            .attr('opacity', 0.7);
          svg.append('text')
            .attr('x', (x(opStart) + x(opEnd)) / 2)
            .attr('y', height/2 + 34)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('fill', '#14b8a6')
            .text('Operation');
        }
      }
  
      // Draw ICU period as a bar if available
      if (patientToPlot.opend !== undefined && patientToPlot.dis && patientToPlot.icu_days > 0) {
        const icuStart = getEventDate(patientToPlot, 'opend');
        const icuEnd = getEventDate(patientToPlot, 'dis');
        if (icuStart && icuEnd && !isNaN(icuStart.getTime()) && !isNaN(icuEnd.getTime())) {
          svg.append('rect')
            .attr('x', x(icuStart))
            .attr('y', height/2 + 38)
            .attr('width', x(icuEnd) - x(icuStart))
            .attr('height', 14)
            .attr('fill', '#facc15')
            .attr('opacity', 0.7);
          svg.append('text')
            .attr('x', (x(icuStart) + x(icuEnd)) / 2)
            .attr('y', height/2 + 54)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('fill', '#facc15')
            .text('ICU');
        }
      }
    });
  </script>
  
  {#if !hasRendered}
    <div style="color: #ef4444; padding: 1rem; text-align: center;">No timeline data available for this surgery.</div>
  {/if}
  <div bind:this={timelineDiv}></div>
  <style>
    :global(.event-label) {
      font-family: 'Work Sans', Arial, sans-serif;
      font-weight: 600;
    }
  </style>