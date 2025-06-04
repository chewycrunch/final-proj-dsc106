<script lang="ts">
	import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
	import { select } from 'd3-selection';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { axisBottom, axisLeft } from 'd3-axis';
	import { rollup, max, sum, descending, median, quantile } from 'd3-array';
	import { format } from 'd3-format';

	export let data: Array<SurgeryCase> = [];
	export let filteredDepartment: string | null = null;
	export let showPercentage = false; // Now this can be controlled externally

	let svg: SVGSVGElement;
	let title = 'Department Distribution of Surgical Cases';

	// Set up event dispatcher to communicate with parent components
	const dispatch = createEventDispatcher();

	function draw() {
		if (!data.length) return;
		select(svg).selectAll('*').remove();

		// Match dimensions with AgeDistribution component - slightly taller to match
		const margin = { top: 30, right: 30, bottom: 60, left: 60 };
		const width = 600 - margin.left - margin.right;
		const height = 350 - margin.top - margin.bottom;

		const counts = rollup(
			data,
			(v) => v.length,
			(d) => d.department
		);

		// Sort departments by case count (descending)
		const entries = Array.from(counts, ([key, value]) => ({ key, value })).sort((a, b) =>
			descending(a.value, b.value)
		);

		// Calculate total cases and percentage distribution
		const totalCases = sum(entries, (d) => d.value);
		const entriesWithPercent = entries.map((d) => ({
			...d,
			percent: (d.value / totalCases) * 100
		}));

		// Calculate cumulative percentage for top departments
		const topTwoDepts = entriesWithPercent.slice(0, 2);
		const topTwoPercent = topTwoDepts.reduce((acc, curr) => acc + curr.percent, 0);

		const x = scaleBand<string>()
			.domain(entries.map((d) => d.key!))
			.range([0, width])
			.padding(0.2);

		const y = scaleLinear()
			.domain([
				0,
				showPercentage
					? (max(entriesWithPercent, (d) => d.percent) as number)
					: (max(entries, (d) => d.value) as number)
			])
			.nice()
			.range([height, 0]);

		const g = select(svg)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Add title
		g.append('text')
			.attr('x', width / 2)
			.attr('y', -15)
			.attr('text-anchor', 'middle')
			.attr('class', 'chart-title')
			.style('font-size', '16px')
			.style('font-weight', 'bold')
			.text(title);

		// Calculate department-specific statistics for tooltips
		const deptStats = new Map();
		entries.forEach((entry) => {
			const deptData = data.filter((d) => d.department === entry.key);
			const maleCount = deptData.filter((d) => d.sex === 'M').length;
			const femaleCount = deptData.filter((d) => d.sex === 'F').length;
			const malePercent = (maleCount / entry.value) * 100;
			const femalePercent = (femaleCount / entry.value) * 100;

			const ages = deptData
				.filter((d) => d.age !== undefined && !isNaN(d.age))
				.map((d) => d.age as number);
			const medianAge = ages.length ? median(ages) || 0 : 0;
			const q1 = ages.length ? quantile(ages, 0.25) || 0 : 0;
			const q3 = ages.length ? quantile(ages, 0.75) || 0 : 0;

			deptStats.set(entry.key, {
				maleCount,
				femaleCount,
				malePercent,
				femalePercent,
				medianAge,
				q1,
				q3
			});
		});

		// Create tooltip div for detailed hover information
		const tooltip = select('body')
			.selectAll('.dept-tooltip')
			.data([0])
			.enter()
			.append('div')
			.attr('class', 'dept-tooltip')
			.style('position', 'absolute')
			.style('visibility', 'hidden')
			.style('background-color', 'white')
			.style('border', '1px solid #ddd')
			.style('border-radius', '5px')
			.style('padding', '10px')
			.style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)')
			.style('pointer-events', 'none')
			.style('font-size', '12px')
			.style('z-index', '10');

		// Create bars with enhanced interactions
		const bars = g
			.append('g')
			.selectAll('rect')
			.data(entriesWithPercent)
			.enter()
			.append('rect')
			.attr('x', (d) => x(d.key!)!)
			.attr('y', (d) => (showPercentage ? y(d.percent) : y(d.value)))
			.attr('width', x.bandwidth())
			.attr('height', (d) => (showPercentage ? height - y(d.percent) : height - y(d.value)))
			.attr('fill', (d) => {
				// Highlight the selected department or top two if none selected
				if (filteredDepartment === d.key) return '#ff7f50';
				return topTwoDepts.includes(d) ? '#2a6d7c' : '#5eb1c6';
			})
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)
			.attr('class', 'dept-bar')
			.style('cursor', 'pointer')
			.on('mouseover', function (event, d) {
				// Highlight bar
				select(this).transition().duration(200).attr('fill', '#ff7f50'); // Coral highlight

				// Get department stats
				const stats = deptStats.get(d.key);

				// Show enhanced tooltip with mini-stats
				tooltip
					.html(
						`
					<div style="font-weight: bold; margin-bottom: 5px; color: #2a6d7c;">${d.key}</div>
					<div>Total cases: <b>${d.value}</b> (${format('.1f')(d.percent)}% of all)</div>
					${
						showPercentage
							? `<div style="font-weight: bold; color: #2a6d7c; margin-top: 3px;">
							Showing as percentage: ${format('.1f')(d.percent)}%
						</div>`
							: ''
					}
					<div style="margin-top: 5px;">
						<div>Sex ratio: <b>${format('.0f')(stats.malePercent)}% M / ${format('.0f')(stats.femalePercent)}% F</b></div>
						<div>Median age: <b>${format('.1f')(stats.medianAge)}</b> years</div>
						<div>IQR: <b>${format('.1f')(stats.q1)} - ${format('.1f')(stats.q3)}</b></div>
					</div>
					<div style="margin-top: 5px; font-size: 10px; color: #666;">Click to filter dashboard by department</div>
				`
					)
					.style('visibility', 'visible')
					.style('left', event.pageX + 15 + 'px')
					.style('top', event.pageY - 10 + 'px');
			})
			.on('mousemove', function (event) {
				// Move tooltip with cursor
				tooltip.style('left', event.pageX + 15 + 'px').style('top', event.pageY - 10 + 'px');
			})
			.on('mouseout', function () {
				const d = select(this).datum() as any;
				// Return to normal color unless it's the filtered department
				select(this)
					.transition()
					.duration(200)
					.attr(
						'fill',
						filteredDepartment === d.key
							? '#ff7f50'
							: topTwoDepts.includes(d)
								? '#2a6d7c'
								: '#5eb1c6'
					);

				// Hide tooltip
				tooltip.style('visibility', 'hidden');
			})
			.on('click', function (event, d) {
				event.stopPropagation(); // Prevent click from propagating

				// If clicking the already filtered department, clear the filter
				const newFilter = filteredDepartment === d.key ? null : d.key;

				// Dispatch filter event to parent component
				dispatch('filter', {
					department: newFilter,
					name: d.key
				});

				// Update highlight
				select(svg)
					.selectAll('.dept-bar')
					.transition()
					.duration(300)
					.attr('fill', (b: any) =>
						b.key === newFilter ? '#ff7f50' : topTwoDepts.includes(b) ? '#2a6d7c' : '#5eb1c6'
					);

				// Update local state
				filteredDepartment = newFilter!;
			});

		// Add x and y axes
		g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(x))
			.selectAll('text')
			.attr('transform', 'rotate(-45)')
			.attr('text-anchor', 'end')
			.style('font-size', '12px');

		g.append('g')
			.call(
				axisLeft(y).tickFormat((d) =>
					showPercentage ? format('.1f')(d as number) + '%' : format(',.0f')(d as number)
				)
			)
			.style('font-size', '12px');

		// Add axis labels
		g.append('text')
			.attr('x', width / 2)
			.attr('y', height + 75)
			.attr('text-anchor', 'middle')
			.style('font-size', '14px')
			.text('Surgical Department');

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -50)
			.attr('text-anchor', 'middle')
			.style('font-size', '14px')
			.text(showPercentage ? 'Percentage of Cases' : 'Number of Cases');

		// Insight annotation removed as requested
	}

	// Function to handle clearing filters when clicking outside the bars
	function handleBackgroundClick() {
		if (filteredDepartment) {
			filteredDepartment = null;
			dispatch('filter', { department: null });
			draw(); // Redraw the chart
		}
	}

	onMount(() => {
		draw();

		// Add event listener to clear filters when clicking the background/chart area
		const svgElement = svg;
		if (svgElement) {
			svgElement.addEventListener('click', handleBackgroundClick);
		}

		return () => {
			// Clean up event listeners
			if (svgElement) {
				svgElement.removeEventListener('click', handleBackgroundClick);
			}
			// Remove tooltips when unmounting
			select('body').selectAll('.dept-tooltip').remove();
		};
	});

	// Reactive statement to respond to showPercentage changes
	$: if (svg) {
		// Redraw the chart when showPercentage changes
		draw();
	}
	
	// Reactive statement to respond to data changes (when age filtering is applied)
	$: if (svg && data) {
		// Redraw the chart when data changes due to filtering
		draw();
	}

	afterUpdate(draw);
</script>

<div class="department-distribution">
	<div class="chart">
		<svg bind:this={svg} class="h-auto w-full"></svg>
	</div>

	{#if filteredDepartment}
		<div class="filter-notice">
			<p>
				<span class="filter-badge">Filtered</span>
				Viewing <strong>{filteredDepartment}</strong> cases only
				<button class="clear-filter" on:click={handleBackgroundClick}> Clear filter × </button>
			</p>
		</div>
	{:else}
		<div class="insight-box">
			<p class="insight-text">
				Our patients span six decades, but <strong
					>95% of them cluster in just two surgical departments</strong
				>, setting the stage for wildly different baseline risks.
			</p>
		</div>
	{/if}

	<!-- Percentage toggle removed - now controlled by AgeDistribution -->
</div>

<style>
	.department-distribution {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.chart {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.insight-box {
		margin-top: 0.5rem;
		padding: 0.75rem;
		background-color: #f8f9fa;
		border-radius: 5px;
		border-left: 4px solid #2a6d7c;
	}

	.insight-text {
		font-size: 0.9rem;
		line-height: 1.4;
		margin: 0;
		color: #333;
	}

	.filter-notice {
		margin-top: 0.5rem;
		padding: 0.75rem;
		background-color: #fff9f7;
		border-radius: 5px;
		border-left: 4px solid #ff7f50;
		display: flex;
		align-items: center;
	}

	.filter-notice p {
		margin: 0;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.filter-badge {
		background-color: #ff7f50;
		color: white;
		font-size: 0.7rem;
		font-weight: bold;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.clear-filter {
		background-color: #eee;
		border: none;
		border-radius: 3px;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		cursor: pointer;
		margin-left: auto;
	}

	.clear-filter:hover {
		background-color: #ddd;
	}

	:global(.chart-title) {
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	:global(.dept-tooltip) {
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
	}
</style>
