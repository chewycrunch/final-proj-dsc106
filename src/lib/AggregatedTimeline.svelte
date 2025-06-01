<!-- File: src/lib/AggregatedTimeline.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import * as d3 from 'd3';

	interface TimelineEvent {
		label: string;
		key: string;
		mean: number | null;
		min: number | null;
		max: number | null;
	}

	export let cases: SurgeryCase[] = [];
	export let groupBy: 'optype' | 'department' = 'optype';
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

	$: filteredCases = cases.filter(c => 
		(!groupValue || c[groupBy] === groupValue) &&
		(!selectedDepartment || c.department === selectedDepartment) &&
		c.age >= ageRange[0] && c.age <= ageRange[1]
	);

	$: availableGroups = Array.from(new Set(cases.map(c => c[groupBy]))).filter(Boolean);

	function getEventTime(case_: SurgeryCase, key: string): number | null {
		const value = case_[key as keyof SurgeryCase];
		return typeof value === 'number' ? value : null;
	}

	function computeAggregatedEvents(group: SurgeryCase[]): TimelineEvent[] {
		if (!group.length) {
			return eventDefs.map(({ label, key }) => ({ label, key, mean: null, min: null, max: null }));
		}

		return eventDefs.map(({ label, key }) => {
			const eventKey = key as keyof SurgeryCase;

			// Calculate durations from casestart for each case, filtering out invalid data
			const durations: number[] = group.map(c => {
				const eventTime = c[eventKey];
				const caseStartTime = c.casestart;

				// Check if both event time and casestart are valid numbers for this case
				if (typeof eventTime === 'number' && typeof caseStartTime === 'number') {
					return eventTime - caseStartTime;
				}
				return NaN;
			}).filter(d => !isNaN(d));

			// If no valid durations found for this event across all cases, return nulls
			if (!durations.length) {
				return { label, key, mean: null, min: null, max: null };
			}

			// Filter out extreme outliers based on duration from casestart
			const plausibleDurationSeconds = 365 * 24 * 60 * 60; // Approximately 1 year in seconds
			const filteredDurations = durations.filter(duration => Math.abs(duration) < plausibleDurationSeconds);
			
			// Check if sufficient data remains after filtering
			if (filteredDurations.length === 0) {
				return { label, key, mean: null, min: null, max: null };
			}

			const mean = d3.mean(filteredDurations) as number;
			const min = d3.min(filteredDurations) as number;
			const max = d3.max(filteredDurations) as number;

			return { label, key, mean, min, max };
		});
	}

	let aggEvents: TimelineEvent[] = [];
	let needsRender = false;

	// Separate data computation from rendering
	$: {
		if (filteredCases) {
			aggEvents = computeAggregatedEvents(filteredCases);
			needsRender = true;
		}
	}

	// Handle rendering separately
	$: if (needsRender && timelineDiv) {
		renderTimeline();
		needsRender = false;
	}

	function renderTimeline() {
		if (!timelineDiv) return;
		timelineDiv.innerHTML = ''; // Clear previous content

		if (!aggEvents.length) return;

		const width = timelineDiv.clientWidth || 800;
		const height = 280;
		const legendWidthEstimate = 200;
		const horizontalPadding = 30;

		const plottableEvents = aggEvents.filter(e => e.mean !== null);

		// Get the min and max of the mean values for the 6 events
		const meanValues = plottableEvents.map(e => e.mean as number);
		const minMean = Math.min(...meanValues);
		const maxMean = Math.max(...meanValues);

		// Set padding (in minutes)
		const padding = 10;
		const minMinutes = Math.floor(minMean / 60) - padding;
		const maxMinutes = Math.ceil(maxMean / 60) + padding;

		// Define the x scale domain directly
		const xDomain = [minMinutes, maxMinutes];

		// Force exactly 8 ticks, rounded to the nearest 5
		const interval = (maxMinutes - minMinutes) / 7;
		const ticks = Array.from({ length: 8 }, (_, i) =>
		  Math.round((minMinutes + i * interval) / 5) * 5
		);

		const x = d3.scaleLinear()
			.domain(xDomain)
			.range([legendWidthEstimate + horizontalPadding, width - horizontalPadding]);

		const svg = d3.select(timelineDiv)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`);

		const mutedColors = [
			'#52796F', // muted teal-green
			'#B08968', // warm muted ochre
			'#7B6D8D', // muted purple
			'#A3A380', // soft olive green
			'#8C6A57', // muted brown
			'#68829E'  // dusty blue
		] as const;

		const colorScale = d3.scaleOrdinal<string>()
			.domain(eventDefs.map(e => e.label))
			.range(mutedColors);

		// Add grid lines
		const xAxis = d3.axisBottom(x)
			.tickValues(ticks) // Use the fixed set of nice tick values
			.tickFormat(d => `${Math.round(d as number)} min`); // Format the tick labels

		const axisGroup = svg.append('g')
			.attr('transform', `translate(0,${height / 2})`)
			.call(xAxis);

		// Style axis text
		axisGroup.selectAll<SVGTextElement, number>('text') // Add type annotation
			.style('font-size', '12px')
			.attr('transform', null) // Remove rotation
			.style('text-anchor', 'middle'); // Revert text anchor

		// Remove only the default vertical tick lines, keeping the main horizontal domain line
		axisGroup.selectAll('.tick line').remove();

		// Explicitly set the start of the horizontal axis line to be after the legend
		axisGroup.select('.domain')
			.attr('x1', legendWidthEstimate + horizontalPadding);

		// Add vertical grid lines based on tick positions
		axisGroup.selectAll('.tick')
			.append<SVGLineElement>('line') // Add type annotation
			.attr('y1', 0)
			.attr('y2', -height / 2) // Extend lines upwards from the axis position
			.attr('stroke', '#eee')
			.attr('stroke-dasharray', '2,2');

		// Add tooltip
		const tooltip = d3.select(timelineDiv)
			.append('div')
			.attr('class', 'timeline-tooltip')
			.style('position', 'absolute')
			.style('padding', '8px 12px')
			.style('background', 'rgba(0, 0, 0, 0.8)')
			.style('color', 'white')
			.style('border-radius', '4px')	
			.style('font-size', '12px')
			.style('pointer-events', 'none')
			.style('opacity', 0);

		// Add event markers with error bars
		svg.selectAll<SVGGElement, TimelineEvent>('.event-group')
			.data(plottableEvents)
			.enter()
			.append('g')
			.attr('class', 'event-group')
			.each(function(d) { // d has TimelineEvent type from selectAll
				const g = d3.select<SVGGElement, TimelineEvent>(this);
				const xPos = x(d.mean! / 60);
				
				// Error bar
				g.append<SVGLineElement>('line')
					.attr('x1', (): number => xPos)
					.attr('x2', (): number => xPos)
					.attr('y1', (): number => height / 2 - 20)
					.attr('y2', (): number => height / 2 + 20)
					.attr('stroke', (): string => colorScale(d.label))
					.attr('stroke-width', 2);

				// Min-Max range
				g.append<SVGLineElement>('line')
					.attr('x1', (): number => {
						const mappedMinX = x(d.min! / 60);
						// Ensure the line starts at or after the beginning of the graph area
						const graphStartX = legendWidthEstimate + horizontalPadding;
						return Math.max(mappedMinX, graphStartX);
					})
					.attr('x2', (): number => {
						const mappedMaxX = x(d.max! / 60);
						// Ensure the line ends at or before the end of the graph area
						const graphEndX = width - horizontalPadding;
						return Math.min(mappedMaxX, graphEndX);
					})
					.attr('y1', (): number => height / 2)
					.attr('y2', (): number => height / 2)
					.attr('stroke', (): string => '#000') // Black line for range
					.attr('stroke-width', 1);

				// Event marker
				g.append<SVGCircleElement>('circle')
					.attr('cx', (): number => xPos)
					.attr('cy', (): number => height / 2)
					.attr('r', 6)
					.attr('fill', (): string => colorScale(d.label))
					.on('mouseover', (event: MouseEvent) => {
						tooltip.transition()
							.duration(200)
							.style('opacity', 1);
						tooltip.html(`
							<strong>${d.label}</strong><br>
							Mean: ${(d.mean! / 60).toFixed(1)} min<br>
							Range: ${(d.min! / 60).toFixed(1)} - ${(d.max! / 60).toFixed(1)} min
						`);
					})
					.on('mousemove', (event: MouseEvent) => {
						tooltip
							.style('left', `${event.pageX + 10}px`)
							.style('top', `${event.pageY - 30}px`);
					})
					.on('mouseout', () => {
						tooltip.transition()
							.duration(200)
							.style('opacity', 0);
					});
			});

		// Add legend
		const legend = svg.append('g')
			.attr('class', 'event-legend')
			.attr('transform', 'translate(20, 40)');

		const legendItems = legend.selectAll<SVGGElement, typeof eventDefs[0]>('g')
			.data(eventDefs)
			.enter()
			.append('g')
			.attr('transform', (_d, i) => `translate(0, ${i * 25})`); // _d is unused, i is index

		legendItems.each(function(d) { // d has typeof eventDefs[0] type
			const g = d3.select<SVGGElement, typeof eventDefs[0]>(this);
			g.append<SVGCircleElement>('circle')
				.attr('r', 6)
				.attr('cy', 0)
				.attr('fill', (): string => colorScale(d.label));
			g.append<SVGTextElement>('text')
				.attr('x', 16)
				.attr('y', 4)
				.attr('font-size', 13)
				.attr('fill', '#222')
				.text(d.label);
		});

		// Add title and stats
		let title = '';
		if (groupValue) title += `${groupBy === 'optype' ? 'Surgery Type' : 'Department'}: ${groupValue}`;
		if (selectedDepartment) title += title ? `, Department: ${selectedDepartment}` : `Department: ${selectedDepartment}`;
		if (ageRange[0] > 0 || ageRange[1] < 120) title += title ? `, Age: ${ageRange[0]}-${ageRange[1]}` : `Age: ${ageRange[0]}-${ageRange[1]}`;
		
		if (title) {
			svg.append<SVGTextElement>('text') // Add type annotation
				.attr('x', legendWidthEstimate + horizontalPadding)
				.attr('y', 20)
				.attr('font-size', 12)
				.attr('fill', '#666')
				.text(title);
		}

		svg.append<SVGTextElement>('text') // Add type annotation
			.attr('x', width - horizontalPadding)
			.attr('y', 20)
			.attr('text-anchor', 'end')
			.attr('font-size', 12)
			.attr('fill', '#666')
			.text(`n = ${filteredCases.length} cases`);

		const totalDuration = (xDomain[1] - xDomain[0]);
		svg.append<SVGTextElement>('text') // Add type annotation
			.attr('x', width - horizontalPadding)
			.attr('y', height - 10)
			.attr('text-anchor', 'end')
			.attr('font-size', 12)
			.attr('fill', '#666')
			.text(`Total duration: ${Math.round(totalDuration)} min`);
	}

	onMount(() => {
		if (timelineDiv) {
			renderTimeline();
		}
	});
</script>

<div class="timeline-container">
	<div class="filter-controls">
		<div class="filter-group">
			<label for="group-select">Group By:</label>
			<select id="group-select" bind:value={groupBy}>
				<option value="optype">Surgery Type</option>
				<option value="department">Department</option>
			</select>
		</div>

		<div class="filter-group">
			<label for="group-value">Filter Value:</label>
			<select id="group-value" bind:value={groupValue}>
				<option value={null}>All</option>
				{#each availableGroups as type}
					<option value={type}>{type}</option>
				{/each}
			</select>
		</div>

		<div class="filter-group">
			<label>Age Range:</label>
			<div class="age-inputs">
				<input type="number" min="0" max="120" bind:value={ageRange[0]} />
				<span>to</span>
				<input type="number" min="0" max="120" bind:value={ageRange[1]} />
			</div>
		</div>
	</div>

	<div bind:this={timelineDiv} class="timeline-visualization"></div>
	
	{#if filteredCases.length === 0}
		<div class="no-data-message">No cases match the selected criteria.</div>
	{/if}
</div>

<style>
	.timeline-container {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.filter-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #eee;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-weight: 600;
		font-size: 0.875rem;
		color: #374151;
	}

	.filter-group select,
	.filter-group input {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.875rem;
		min-width: 120px;
	}

	.age-inputs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.age-inputs input {
		width: 60px;
	}

	.timeline-visualization {
		width: 100%;
		overflow-x: auto;
	}

	.no-data-message {
		text-align: center;
		padding: 2rem;
		color: #ef4444;
		font-size: 0.875rem;
	}

	:global(.timeline-tooltip) {
		z-index: 1000;
	}

	/* Ensure the main horizontal axis line is hidden */
	.timeline-visualization path.domain {
		display: none;
	}
</style> 