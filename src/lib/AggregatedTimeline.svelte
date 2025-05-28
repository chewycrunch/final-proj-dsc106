<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	// Define the patient data type (using SurgeryCase from parent)
	import type { SurgeryCase } from '../routes/+page.svelte';

	// Define the event type for aggregated data
	interface AggregatedEvent {
		label: string;
		key: string; // Added key property
		mean: number | null; // Mean can be null if no data
		min: number | null; // Min can be null
		max: number | null; // Max can be null
	}

	export let patients: SurgeryCase[] = [];
	export let groupBy: string = 'optype';
	export let ageRange: [number, number] = [0, 120];

	let groupValue: string | null = null;
	let timelineDiv: HTMLDivElement;
	let availableGroups: string[] = [];

	// List of event keys and labels
	const eventDefs = [
		{ label: 'Case Start', key: 'casestart' },
		{ label: 'Anesthesia Start', key: 'anestart' },
		{ label: 'Operation Start', key: 'opstart' },
		{ label: 'Operation End', key: 'opend' },
		{ label: 'Anesthesia End', key: 'aneend' },
		{ label: 'Case End', key: 'caseend' }
	];

	// Filter patients based on all criteria (removed selectedDepartment condition)
	$: filteredPatients = patients.filter(
		(p) =>
			(!groupValue || p[groupBy] === groupValue) &&
			p.age >= ageRange[0] &&
			p.age <= ageRange[1]
	);

	// Get available groups for the current groupBy field
	$: availableGroups = Array.from(new Set(patients.map((p) => p[groupBy]))).filter(Boolean);

	// Helper to get event time (all times are relative to casestart)
	function getEventTime(patient: SurgeryCase, key: string): number | null { // Updated patient type
		// Treat negative values as is, they represent time before casestart
		if (typeof patient[key] === 'number') {
			return patient[key];
		}
		return null;
	}

	// Compute mean and min/max for each event, filtering outliers
	function computeAggregatedEvents(group: SurgeryCase[]): AggregatedEvent[] { // Updated group type
		if (!group.length) {
			// Return all event defs with null aggregated values if no patients in group
			return eventDefs.map(({ label, key }) => ({ label, key, mean: null, min: null, max: null }));
		}

		return eventDefs.map(({ label, key }) => {
			const times = group.map((p) => getEventTime(p, key)).filter((t): t is number => t !== null);

			// If no valid times, return nulls
			if (!times.length) {
				return { label, key, mean: null, min: null, max: null };
			}

			// Outlier filtering: exclude values with absolute values greater than a plausible duration (e.g., 7 days in seconds)
			const plausibleDurationSeconds = 7 * 24 * 60 * 60; // 7 days in seconds
			const filteredTimes = times.filter((time) => Math.abs(time) < plausibleDurationSeconds);

			// If after filtering, no times remain or very few, return nulls
			// Use the original times count for comparison if filteredTimes is empty after filtering
			if (filteredTimes.length === 0 || (filteredTimes.length < (times.length * 0.1) && filteredTimes.length < 5)) { // Require at least 10% of original data or 5 points
				console.warn(`Outlier filtering removed all or most data for ${label}. Original count: ${times.length}, Filtered count: ${filteredTimes.length}`);
				return { label, key, mean: null, min: null, max: null };
			}

			const mean = d3.mean(filteredTimes) as number;
			const min = d3.min(filteredTimes) as number;
			const max = d3.max(filteredTimes) as number;

			return {
				label,
				key, // Include key in aggregated event
				mean,
				min,
				max
			};
		}); // Do not filter here, return all events with aggregated data or nulls
	}

	let aggEvents: AggregatedEvent[] = [];

	// Update aggregated events whenever filtered patients change
	$: {
		aggEvents = computeAggregatedEvents(filteredPatients);
		if (timelineDiv) {
			renderTimeline();
		}
	}

	function renderTimeline() {
		if (!timelineDiv) return;
		timelineDiv.innerHTML = '';
		if (!aggEvents.length) return; // Should not happen with current compute logic, but good safety check

		const width = 800,
			height = 280;
		const legendWidth = 160;

		// Filter for events that actually have a mean to plot
		const plottableEvents = aggEvents.filter((e) => e.mean !== null);

		console.log('Valid Events for Timeline and Legend:', plottableEvents);

		// Determine the overall min and max time across all plottable event means (in seconds)
		const allMeanTimes = plottableEvents.map((e) => e.mean as number);
		// Use a small epsilon if all times are the same to avoid issues with extent
		const overallExtent = d3.extent(allMeanTimes) as [number, number];
		let overallMinMean = overallExtent[0];
		let overallMaxMean = overallExtent[1];

		// If all means are the same, provide a small extent for visualization
		if (overallMinMean === overallMaxMean) {
			overallMinMean -= 60; // 1 minute before
			overallMaxMean += 60; // 1 minute after
		}

		// Set the axis domain based on the overall min/max mean times (in minutes)
		const domainMin = overallMinMean / 60;
		const domainMax = overallMaxMean / 60;

		// Add a small padding to the domain
		const padding = (domainMax - domainMin) * 0.05; // 5% padding on each side
		// Ensure the left padding doesn't push the min axis value too far if the range is small or starts near 0
		const paddedMin = (domainMin >= 0 && domainMin < padding && overallMinMean >= 0) ? 0 : domainMin - padding;
		const paddedMax = domainMax + padding;

		// Set up SVG
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

		// Draw axis
		const x = d3.scaleLinear()
			.domain([paddedMin, paddedMax]) // Use adjusted domain
			.range([legendWidth + 40, width - 60]) // Timeline starts after legend
			.nice();

		// Determine the number of ticks based on the visible range, not event count
		const axis = d3.axisBottom(x);
		// You might want to adjust ticks based on the time duration being shown
		// For simplicity, let's keep a reasonable number of ticks
		const numTicks = Math.min(plottableEvents.length > 0 ? plottableEvents.length + 1 : 5, 10); // Base ticks on plottable events
		axis.ticks(numTicks);

		svg.append('g')
			.attr('transform', `translate(0,${height/2})`)
			.call(axis.tickFormat((d: number) => `${Math.round(d)} min`))
			.selectAll('text')
			.style('font-size', '12px');

		// Draw mean event markers with distinct colors (only for plottable events)
		svg.selectAll('circle.event-marker') // Added class for clarity
			.data(plottableEvents)
			.enter()
			.append('circle')
			.attr('class', 'event-marker') // Added class
			.attr('cx', (d: AggregatedEvent) => x(d.mean as number / 60)) // Cast to number
			.attr('cy', height/2)
			.attr('r', 10)
			.attr('fill', (d: AggregatedEvent) => colorScale(d.label)) // Use color scale
			// No need for mouse events here if we have a tooltip in the legend
			// .on('mouseover', (event: MouseEvent, d: AggregatedEvent) => { // Added type annotations
			//   tooltip.transition().duration(200).style('opacity', 1);
			//   tooltip.html(`<strong>${d.label}</strong><br>${(d.mean! / 60).toFixed(1)} min`);
			// })
			// .on('mousemove', (event: MouseEvent) => { // Added type annotation
			//   tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY - 30}px`);
			// })
			// .on('mouseout', () => {
			//   tooltip.transition().duration(200).style('opacity', 0);
			// });

		// Add a legend above the plot for ALL defined events
		const legend = svg.append('g')
			.attr('class', 'event-legend')
			.attr('transform', `translate(20, 40)`); // Position legend above timeline, closer to left edge

		const legendItems = legend.selectAll<SVGGElement, {label: string, key: string}>('g')
			.data(eventDefs) // Use eventDefs to show all possible events in legend
			.enter()
			.append('g')
			// Arrange legend items vertically
			.attr('transform', (_d: {label: string, key: string}, i: number) => `translate(0, ${i * 25})`); // Arrange vertically with 25px spacing

		legendItems.each(function(this: SVGGElement, d: {label: string, key: string}) {
			const g = d3.select(this);
			// Use the color scale based on the label
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
			g.on('mouseover', (event: MouseEvent) => { // Added type annotation
				tooltip.transition().duration(200).style('opacity', 1);
				tooltip.html(`<strong>${d.label}</strong>`); // Show just label in legend tooltip
			})
			.on('mousemove', (event: MouseEvent) => { // Added type annotation
				tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY - 30}px`);
			})
			.on('mouseout', () => {
				tooltip.transition().duration(200).style('opacity', 0);
			});
		});

		// Add tooltip div (needed for mouse events)
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

		// Add count of patients
		svg.append('text')
			.attr('x', width - 60)
			.attr('y', 20)
			.attr('text-anchor', 'end')
			.attr('font-size', 12)
			.attr('fill', '#666')
			.text(`n = ${filteredPatients.length} patients`);

		// Add title showing current filter
		let title = '';
		if (groupValue) {
			title += `${groupBy === 'optype' ? 'Surgery Type' : 'Department'}: ${groupValue}`;
		}
		if (ageRange[0] > 0 || ageRange[1] < 120) {
			title += title ? `, Age: ${ageRange[0]}-${ageRange[1]}` : `Age: ${ageRange[0]}-${ageRange[1]}`;
		}
		if (title) {
			svg.append('text')
				.attr('x', 100)
				.attr('y', 20)
				.attr('font-size', 12)
				.attr('fill', '#666')
				.text(title);
		}

		// Add duration summary
		// Recalculate duration based on padded values
		const totalDuration = (paddedMax - paddedMin);
		svg.append('text')
			.attr('x', width - 60)
			.attr('y', height - 10)
			.attr('text-anchor', 'end')
			.attr('font-size', 12)
			.attr('fill', '#666')
			.text(`Total duration: ${Math.round(totalDuration)} min`);
	}

	// Initial render
	onMount(() => {
		if (timelineDiv) {
			renderTimeline();
		}
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
			<input
				type="number"
				min="0"
				max="120"
				bind:value={ageRange[0]}
				style="width:60px; margin:0 0.5rem;"
			/>
			<span>to</span>
			<input
				type="number"
				min="0"
				max="120"
				bind:value={ageRange[1]}
				style="width:60px; margin:0 0.5rem;"
			/>
		</div>
	</div>

	<div bind:this={timelineDiv}></div>
	{#if filteredPatients.length === 0}
		<div style="color: #ef4444; padding: 1rem; text-align: center;">
			No patients match the selected criteria.
		</div>
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
	.tooltip {
		pointer-events: none;
	}
</style>
