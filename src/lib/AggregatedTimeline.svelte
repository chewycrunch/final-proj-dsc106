<!-- File: src/lib/AggregatedTimeline.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import * as d3 from 'd3';

	interface TimelineEvent {
		label: string;
		key: string;
		startMean: number | null;
		endMean: number | null;
	}

	export let cases: SurgeryCase[] = [];
	export let groupBy: 'optype' | 'department' = 'optype';
	export let ageRange: [number, number] = [0, 120];
	export let selectedDepartment: string | null = null;

	let groupValue: string | null = null;
	let timelineDiv: HTMLDivElement;
	let timelineContainer: HTMLDivElement;
	let availableGroups: string[] = [];

	const intervalDefs = [
		{ label: 'Case Duration', startKey: 'casestart', endKey: 'caseend' },
		{ label: 'Anesthesia Duration', startKey: 'anestart', endKey: 'aneend' },
		{ label: 'Operation Duration', startKey: 'opstart', endKey: 'opend' }
	];

	$: filteredCases = cases.filter(c => 
		(!groupValue || c[groupBy] === groupValue) &&
		(!selectedDepartment || c.department === selectedDepartment) &&
		(c.age ?? 0) >= ageRange[0] && (c.age ?? 120) <= ageRange[1]
	);

	$: availableGroups = Array.from(new Set(cases.map(c => c[groupBy] ?? ''))).filter(Boolean) as string[];

	function computeAggregatedIntervals(group: SurgeryCase[]): TimelineEvent[] {
		if (!group.length) {
			return intervalDefs.map(({ label, startKey }) => ({ 
				label, 
				key: startKey, 
				startMean: null,
				endMean: null
			}));
		}

		return intervalDefs.map(({ label, startKey, endKey }) => {
			// Calculate start and end times relative to case start for each case
			const startTimes: number[] = [];
			const endTimes: number[] = [];

			group.forEach(c => {
				const caseStart = c.casestart;
				const startTime = c[startKey as keyof SurgeryCase];
				const endTime = c[endKey as keyof SurgeryCase];

				// Check if all times are valid numbers
				if (typeof caseStart === 'number' && 
					typeof startTime === 'number' && 
					typeof endTime === 'number') {
					startTimes.push(startTime - caseStart);
					endTimes.push(endTime - caseStart);
				}
			});

			// Filter out extreme outliers (more than 1 year)
			const plausibleDurationSeconds = 365 * 24 * 60 * 60;
			const validIndices = startTimes.map((start, i) => {
				const end = endTimes[i];
				return end > start && end - start < plausibleDurationSeconds;
			});

			const filteredStartTimes = startTimes.filter((_, i) => validIndices[i]);
			const filteredEndTimes = endTimes.filter((_, i) => validIndices[i]);

			if (filteredStartTimes.length === 0) {
				return { 
					label, 
					key: startKey, 
					startMean: null,
					endMean: null
				};
			}

			return {
				label,
				key: startKey,
				startMean: d3.mean(filteredStartTimes) as number,
				endMean: d3.mean(filteredEndTimes) as number
			};
		});
	}

	let aggEvents: TimelineEvent[] = [];
	let needsRender = false;

	// Separate data computation from rendering
	$: {
		if (filteredCases) {
			aggEvents = computeAggregatedIntervals(filteredCases);
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
		timelineDiv.innerHTML = '';

		if (!aggEvents.length) return;

		const width = timelineContainer.offsetWidth;
		const height = timelineDiv.clientHeight > 0 ? timelineDiv.clientHeight : 400; // Use available height, fallback to 400px
		const margin = {
			top: 20,
			right: 100,
			bottom: 60,
			left: 200
		};
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const plottableEvents = aggEvents.filter(e => e.startMean !== null && e.endMean !== null);

		const allTimes = plottableEvents.flatMap(e => [
			e.startMean!, e.endMean!
		]);
		const minTime = Math.min(...allTimes);
		const maxTime = Math.max(...allTimes);

		// Convert times to minutes and add padding
		const padding = 10;
		const minMinutes = Math.floor(minTime / 60) - padding;
		const maxMinutes = Math.ceil(maxTime / 60) + padding;

		// Use hours if the range is large enough
		const useHours = maxMinutes - minMinutes > 120;
		const scaleFactor = useHours ? 60 : 1; // Convert to hours if needed

		// Set the domain to match actual data values
		const xDomain = useHours 
			? [minMinutes / 60, maxMinutes / 60]  // Convert to hours
			: [minMinutes, maxMinutes];           // Keep as minutes

		const numTicks = 6; // Fixed number of ticks for consistency
		const tickInterval = (maxMinutes - minMinutes) / (numTicks * scaleFactor);
		const ticks = d3.range(xDomain[0], xDomain[1] + tickInterval, tickInterval);

		// Create a scale that maps our data domain to the display range
		const x = d3.scaleLinear()
			.domain(xDomain)
			.range([0, innerWidth]);

		// Remove the dataScale since we're using actual values now
		const y = d3.scaleBand()
			.domain(plottableEvents.map(e => e.label))
			.range([0, innerHeight])
			.padding(0.4);

		const svg = d3.select(timelineDiv)
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', `0 -20 ${width} ${height + 20}`)
			.attr('preserveAspectRatio', 'xMidYMid meet');

		// Create a group for the main visualization
		const g = svg.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const mutedColors = [
			'#81C784',
			'#FFB74D',
			'#9575CD'
		] as const;

		const colorScale = d3.scaleOrdinal<string>()
			.domain(intervalDefs.map(e => e.label))
			.range(mutedColors);

		const xAxis = d3.axisBottom(x)
			.tickValues(ticks)
			.tickFormat(d => {
				const value = d as number;
				if (useHours) {
					return `${value.toFixed(1)} hr`;
				} else {
					return `${Math.round(value)} min`;
				}
			});

		// Add the x-axis within the translated group
		const axisGroup = g.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(xAxis);

		axisGroup.selectAll<SVGTextElement, number>('text')
			.style('font-size', '12px')
			.style('text-anchor', 'middle')
			.attr('fill', '#CBD5E0')
			.attr('dy', '1em'); // Add some space between ticks and labels

		// Remove default tick lines
		axisGroup.selectAll('.tick line').remove();

		// Add custom grid lines
		axisGroup.selectAll('.tick')
			.append<SVGLineElement>('line')
			.attr('y1', -innerHeight)
			.attr('y2', 0)
			.attr('stroke', '#4A5568')
			.attr('stroke-dasharray', '2,2')
			.attr('opacity', 0.5);

		// Add the main axis line
		g.append('line')
			.attr('x1', 0)
			.attr('y1', innerHeight)
			.attr('x2', innerWidth)
			.attr('y2', innerHeight)
			.attr('stroke', '#4A5568')		
			.attr('stroke-width', 1);

		// Add labels within the translated group
		g.append('g')
			.selectAll<SVGTextElement, TimelineEvent>('text')
			.data(plottableEvents)
			.enter()
			.append('text')
			.attr('x', -10)
			.attr('y', d => (y(d.label) || 0) + y.bandwidth() / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.style('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.text(d => d.label);

		// Create tooltip div with improved styling
		const tooltip = d3.select('body')
			.append('div')
			.attr('class', 'timeline-tooltip')
			.style('position', 'fixed')
			.style('padding', '8px 12px')
			.style('background', 'rgba(45, 55, 72, 0.95)')
			.style('color', 'white')
			.style('border-radius', '4px')
			.style('font-size', '12px')
			.style('pointer-events', 'none')
			.style('opacity', 0)
			.style('box-shadow', '0 2px 4px rgba(0,0,0,0.2)')
			.style('z-index', '1000')
			.style('white-space', 'nowrap')
			.style('transition', 'opacity 0.2s');

		// Update event group positioning
		g.selectAll<SVGGElement, TimelineEvent>('.event-group')
			.data(plottableEvents)
			.enter()
			.append('g')
			.attr('class', 'event-group')
			.each(function(d) {
				const g = d3.select<SVGGElement, TimelineEvent>(this);
				const yPos = (y(d.label) || 0) + y.bandwidth() / 2;

				// Convert times to the same unit as the axis
				const startTime = useHours ? d.startMean! / 3600 : d.startMean! / 60;
				const endTime = useHours ? d.endMean! / 3600 : d.endMean! / 60;

				// Add hover effect to the line
				const line = g.append<SVGLineElement>('line')
					.attr('x1', x(startTime))
					.attr('x2', x(endTime))
					.attr('y1', yPos)
					.attr('y2', yPos)
					.attr('stroke', () => colorScale(d.label))
					.attr('stroke-width', 6)
					.attr('opacity', 0.9)
					.style('cursor', 'pointer')
					.on('mouseenter', function(event: MouseEvent) {
						const rect = timelineDiv.getBoundingClientRect();
						tooltip
							.style('opacity', 1)
							.html(`
								<strong>${d.label}</strong><br>
								Duration: ${useHours 
									? `${((endTime - startTime)).toFixed(1)} hr` 
									: `${((endTime - startTime) * 60).toFixed(1)} min`}
							`);
					})
					.on('mousemove', (event: MouseEvent) => {
						const rect = timelineDiv.getBoundingClientRect();
						const tooltipWidth = 120;
						const tooltipHeight = 40;
						
						// Calculate position relative to the timeline container
						const x = event.clientX - rect.left;
						const y = event.clientY - rect.top;
						
						// Position tooltip relative to the cursor
						let tooltipX = rect.left + x + 10;
						let tooltipY = rect.top + y - tooltipHeight - 10;
						
						// Adjust if tooltip would go off the right edge
						if (tooltipX + tooltipWidth > rect.right) {
							tooltipX = rect.left + x - tooltipWidth - 10;
						}
						
						// Adjust if tooltip would go off the top
						if (tooltipY < rect.top) {
							tooltipY = rect.top + y + 10;
						}
						
						tooltip
							.style('left', `${tooltipX}px`)
							.style('top', `${tooltipY}px`);
					})
					.on('mouseout', () => {
						tooltip.transition()
							.duration(200)
							.style('opacity', 0);
					});

				['start', 'end'].forEach((pos) => {
					const time = pos === 'start' ? startTime : endTime;
					
					const circle = g.append<SVGCircleElement>('circle')
						.attr('cx', x(time))
						.attr('cy', yPos)
						.attr('r', 8)
						.attr('fill', () => colorScale(d.label))
						.attr('stroke', 'white')
						.attr('stroke-width', 2)
						.style('cursor', 'pointer');

					// Add tooltip events directly to the circle element
					circle
						.on('mouseenter', function(event: MouseEvent) {
							const rect = timelineDiv.getBoundingClientRect();
							tooltip
								.style('opacity', 1)
								.html(`
									<strong>${d.label} - ${pos === 'start' ? 'Start' : 'End'}</strong><br>
									Time: ${useHours 
										? `${time.toFixed(1)} hr` 
										: `${(time * 60).toFixed(1)} min`}
								`);
						})
						.on('mousemove', function(event: MouseEvent) {
							const rect = timelineDiv.getBoundingClientRect();
							const tooltipWidth = 120;
							const tooltipHeight = 40;
							
							// Calculate position relative to the timeline container
							const x = event.clientX - rect.left;
							const y = event.clientY - rect.top;
							
							// Position tooltip relative to the cursor
							let tooltipX = rect.left + x + 10;
							let tooltipY = rect.top + y - tooltipHeight - 10;
							
							// Adjust if tooltip would go off the right edge
							if (tooltipX + tooltipWidth > rect.right) {
								tooltipX = rect.left + x - tooltipWidth - 10;
							}
							
							// Adjust if tooltip would go off the top
							if (tooltipY < rect.top) {
								tooltipY = rect.top + y + 10;
							}
							
							tooltip
								.style('left', `${tooltipX}px`)
								.style('top', `${tooltipY}px`);
						})
						.on('mouseleave', function() {
							tooltip
								.transition()
								.duration(200)
								.style('opacity', 0);
						});
				});
			});

		let title = '';
		if (groupValue) title += `${groupBy === 'optype' ? 'Surgery Type' : 'Department'}: ${groupValue}`;
		if (selectedDepartment) title += title ? `, Department: ${selectedDepartment}` : `Department: ${selectedDepartment}`;
		if (ageRange[0] > 0 || ageRange[1] < 120) title += title ? `, Age: ${ageRange[0]}-${ageRange[1]}` : `Age: ${ageRange[0]}-${ageRange[1]}`;
		
		// Update title and case count positioning
		if (title) {
			svg.append<SVGTextElement>('text')
				.attr('x', margin.left)
				.attr('y', margin.top - 25)  // Moved up by increasing offset
				.attr('font-size', '12px')
				.attr('fill', '#CBD5E0')
				.text(title);
		}

		svg.append<SVGTextElement>('text')
			.attr('x', width - margin.right - 10)  // Adjusted to align with graph margin
			.attr('y', margin.top - 25)
			.attr('text-anchor', 'end')
			.attr('font-size', '12px')
			.attr('fill', '#CBD5E0')
			.text(`n = ${filteredCases.length} cases`);
	}

	onMount(() => {
		if (timelineDiv) {
			renderTimeline();
		}
	});
</script>

<div class="timeline-container" bind:this={timelineContainer}>
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
				<div class="age-input-group">
					<input type="number" min="0" max="120" bind:value={ageRange[0]} />
					<input type="range" min="0" max="120" bind:value={ageRange[0]} class="age-slider" />
				</div>
				<span>to</span>
				<div class="age-input-group">
					<input type="number" min="0" max="120" bind:value={ageRange[1]} />
					<input type="range" min="0" max="120" bind:value={ageRange[1]} class="age-slider" />
				</div>
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
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		width: 100%;
		box-sizing: border-box;
		height: 100%; /* Ensure container fills parent height */
		display: flex;
		flex-direction: column; /* Enable flex for vertical distribution */
	}

	.filter-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		margin-bottom: 1rem;
		padding-bottom: 0;
		justify-content: center;
		flex-shrink: 0; /* Prevent filters from shrinking */
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
		text-align: center;
	}

	.filter-group label {
		font-weight: 600;
		font-size: 0.875rem;
		color: #CBD5E0;
	}

	.filter-group select,
	.filter-group input {
		padding: 0.5rem;
		border: 1px solid #4A5568;
		border-radius: 4px;
		font-size: 0.875rem;
		min-width: 120px;
		text-align: center;
		background-color: #2D3748;
		color: #CBD5E0;
	}

	.age-inputs {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.age-input-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.age-inputs input[type="number"] {
		width: 60px;
		text-align: center;
	}

	.age-inputs .age-slider {
		width: 100px;
		margin: 0;
		padding: 0;
		border: none;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
	}

	.age-inputs .age-slider::-webkit-slider-runnable-track {
		width: 100%;
		height: 4px;
		background: #4A5568;
		border-radius: 2px;
		border: none;
		padding: 0;
	}

	.age-inputs .age-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		border: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #0096FF;
		margin-top: -6px;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
	}

	.age-inputs .age-slider::-moz-range-track {
		width: 100%;
		height: 4px;
		background: #4A5568;
		border-radius: 2px;
		border: none;
		padding: 0;
	}

	.age-inputs .age-slider::-moz-range-thumb {
		border: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #FFB74D;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
	}

	.age-inputs .age-slider::-ms-track {
		width: 100%;
		height: 4px;
		background: transparent;
		border-color: transparent;
		color: transparent;
		border: none;
		padding: 0;
	}

	.age-inputs .age-slider::-ms-fill-lower,
	.age-inputs .age-slider::-ms-fill-upper {
		background: #4A5568;
		border-radius: 2px;
	}

	.age-inputs .age-slider::-ms-thumb {
		background: #9575CD;
		border: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
	}

	.timeline-visualization {
		width: 100%;
		overflow: hidden;
		/* min-height: 400px; */ /* Removed fixed min-height */
		height: 100%; /* Take full height of parent */
		position: relative;
		box-sizing: border-box;
	}

	.no-data-message {
		text-align: center;
		padding: 2rem;
		color: #ef4444;
		font-size: 0.875rem;
	}

	:global(.timeline-tooltip) {
		position: fixed !important; /* Change to fixed positioning */
		z-index: 1000;
		background: rgba(45, 55, 72, 0.95);
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		pointer-events: none;
	}

	.timeline-visualization path.domain {
		display: none;
	}

	svg {
		display: block;
		max-width: 100%;
		height: 100%; /* Ensure SVG fills its container */
		width: 100%;
	}

	/* Add hover effects for interactive elements */
	:global(.event-group line),
	:global(.event-group circle) {
		transition: opacity 0.2s;
	}

	:global(.event-group:hover line) {
		opacity: 1;
	}

	:global(.event-group:hover circle) {
		opacity: 1;
	}

	/* Ensure circles are clickable */
	:global(.event-group circle) {
		cursor: pointer;
		pointer-events: all;
	}

	/* Add hover effect for circles */
	:global(.event-group circle:hover) {
		stroke-width: 3;
		stroke: white;
	}
</style> 