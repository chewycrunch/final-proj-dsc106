<script lang="ts">
    import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
    import { select, pointer } from 'd3-selection';
    import { scaleLinear, scaleOrdinal } from 'd3-scale';
    import { extent, max, median, quantile, bin } from 'd3-array';
    import { axisBottom, axisLeft } from 'd3-axis';
    import { format } from 'd3-format';
    import { line, area } from 'd3-shape';
    import { brushX } from 'd3-brush';
    import { transition } from 'd3-transition';

    export let data: Array<{ age?: number; sex?: string }> = [];
    export let showPercentage = false; // Now this can be controlled externally
    export let showBySex = true; // Now this can also be controlled externally
    let svg: SVGSVGElement;
    let ageRange: [number | null, number | null] = [null, null];
    
    // Set up event dispatcher to communicate with parent components
    const dispatch = createEventDispatcher();
    
    // Filter data based on selected age range
    $: filteredData = ageRange[0] !== null && ageRange[1] !== null
        ? data.filter(d => d.age !== undefined && d.age >= ageRange[0]! && d.age <= ageRange[1]!)
        : data;
        
    // Calculate median age for display in the insights section - uses filtered data
    $: medianAge = filteredData.length ? 
        median(filteredData.filter(d => d.age !== undefined && !isNaN(d.age)).map(d => d.age)) || 0 : 0;
        
    // Notify parent components when filters change
    $: {
        // We specifically want to dispatch the event when ageRange changes
        if (ageRange[0] !== null) {
            dispatch('filter', { 
                ageRange: ageRange,
                data: filteredData
            });
        } else if (filteredData === data && ageRange[0] === null) {
            // Also dispatch when filters are cleared
            dispatch('filter', { 
                ageRange: null,
                data: data
            });
        }
    }
    
    function calculateStats(ages: number[]) {
        const sortedAges = [...ages].sort((a, b) => a - b);
        const med = median(sortedAges) || 0;
        const q1 = quantile(sortedAges, 0.25) || 0;
        const q3 = quantile(sortedAges, 0.75) || 0;
        const iqr = q3 - q1;
        
        return { median: med, q1, q3, iqr };
    }

    function draw() {
        if (!data.length) return;
        select(svg).selectAll('*').remove();

        const margin = { top: 30, right: 30, bottom: 60, left: 60 };
        const width = 600 - margin.left - margin.right;
        const height = 350 - margin.top - margin.bottom;

        // Filter out entries without age - use the filtered data based on brush
        const validData = filteredData.filter(d => d.age !== undefined && !isNaN(d.age));
        
        // Extract ages and calculate statistics - ensure they're all numbers
        const ages = validData.map(d => d.age as number);
        const stats = calculateStats(ages);
        
        // Create scales - use the full data range for consistent axis scale
        // This ensures the brush works consistently even when filtering
        const allAges = data.filter(d => d.age !== undefined && !isNaN(d.age)).map(d => d.age as number);
        
        const x = scaleLinear()
            .domain(extent(allAges) as [number, number])
            .nice()
            .range([0, width]);

        // Create bins for the histogram
        const binner = bin()
            .domain(x.domain() as [number, number])
            .thresholds(x.ticks(20));
        
        // Define types for our bins
        type StackedBin = {
            x0: number | undefined;
            x1: number | undefined;
            male: number;
            female: number;
            total: number;
        };
        
        type SplitBins = {
            male: any[];
            female: any[];
        };
        
        let bins: any[] | SplitBins;
        let maxCount: number;
        
        // Process the data both ways to calculate max count for consistent scale
        const normalBins = binner(ages);
        const totalCount = validData.length;
        
        // Calculate counts or percentages
        const getBinValue = (bin: any) => {
            return showPercentage ? (bin.length / totalCount) * 100 : bin.length;
        };
        
        const normalMaxCount = max(normalBins, d => getBinValue(d)) || 0;
        
        // Split data by sex
        const maleData = validData.filter(d => d.sex === 'M').map(d => d.age as number);
        const femaleData = validData.filter(d => d.sex === 'F').map(d => d.age as number);
        
        const maleBins = binner(maleData);
        const femaleBins = binner(femaleData);
        
        // Calculate max count or percentage for sex split view
        const splitMaxCount = Math.max(
            max(maleBins, d => getBinValue(d)) || 0,
            max(femaleBins, d => getBinValue(d)) || 0
        );
        
        // Use the overall maximum for consistent scale
        const overallMaxCount = Math.max(normalMaxCount, splitMaxCount);
        
        // Set bins based on view mode
        if (showBySex) {
            // For overlay visualization
            bins = {
                male: maleBins,
                female: femaleBins
            } as SplitBins;
        } else {
            // Simple histogram for all data
            bins = normalBins;
        }
        
        // Use the same max count for both views
        maxCount = overallMaxCount;
        
        const y = scaleLinear()
            .domain([0, maxCount * 1.1]) // Add 10% padding at top
            .range([height, 0]);

        // Create tooltip div for detailed information on hover
        select('body')
            .selectAll('.age-tooltip')
            .data([0])
            .enter()
            .append('div')
            .attr('class', 'age-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('border-radius', '3px')
            .style('padding', '8px')
            .style('pointer-events', 'none')
            .style('font-size', '12px')
            .style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)')
            .style('text-align', 'center')
            .style('z-index', '10');
        
        // Create SVG and main group
        const g = select(svg)
            .attr(
                'viewBox',
                `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
            )
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Draw the histogram bars
        if (showBySex) {
            const colorScale = scaleOrdinal<string>()
                .domain(['Male', 'Female'])
                .range(['#4682b4', '#db7093']);
            
            // Type assertion for the split bins
            const typedBins = bins as SplitBins;
                
                // Draw overlaid semitransparent bars
                const t = transition().duration(500);
                
                // Male bars
                const maleBars = g.append('g')
                    .selectAll('.bar-male')
                    .data(typedBins.male)
                    .enter()
                    .append('rect')
                    .attr('class', 'bar-male')
                    .attr('x', (d: any) => x(d.x0 as number))
                    .attr('width', (d: any) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
                    .attr('y', height) // Start from bottom for transition
                    .attr('height', 0)
                    .attr('fill', colorScale('Male'))
                    .attr('opacity', 0.7)
                    .attr('stroke', colorScale('Male'))
                    .attr('stroke-width', 1);
                
                // Apply transition for male bars
                maleBars.transition(t)
                    .attr('y', (d: any) => y(getBinValue(d)))
                    .attr('height', (d: any) => height - y(getBinValue(d)));
                
                // Add tooltip interaction for male bars
                const tooltip = select('body').select('.age-tooltip');
                maleBars.on('mouseover', function(event, d: any) {
                        const count = d.length;
                        const percentage = (count / maleData.length * 100).toFixed(1);
                        const range = `${d.x0}-${d.x1}`;
                        
                        tooltip.transition()
                            .duration(200)
                            .style('opacity', 0.9);
                            
                        tooltip.html(`
                            <strong>Age: ${range}</strong><br/>
                            <strong>Male</strong><br/>
                            Count: ${count}<br/>
                            Percentage: ${percentage}%
                        `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                            
                        select(this).attr('stroke', 'black').attr('stroke-width', 2);
                    })
                    .on('mouseout', function() {
                        tooltip.transition()
                            .duration(500)
                            .style('opacity', 0);
                            
                        select(this).attr('stroke', colorScale('Male')).attr('stroke-width', 1);
                    });
                
                // Female bars
                const femaleBars = g.append('g')
                    .selectAll('.bar-female')
                    .data(typedBins.female)
                    .enter()
                    .append('rect')
                    .attr('class', 'bar-female')
                    .attr('x', (d: any) => x(d.x0 as number))
                    .attr('width', (d: any) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
                    .attr('y', height) // Start from bottom for transition
                    .attr('height', 0)
                    .attr('fill', colorScale('Female'))
                    .attr('opacity', 0.7)
                    .attr('stroke', colorScale('Female'))
                    .attr('stroke-width', 1);
                    
                // Apply transition for female bars
                femaleBars.transition(t)
                    .attr('y', (d: any) => y(getBinValue(d)))
                    .attr('height', (d: any) => height - y(getBinValue(d)));
                    
                // Add tooltip interaction for female bars
                femaleBars.on('mouseover', function(event, d: any) {
                        const count = d.length;
                        const percentage = (count / femaleData.length * 100).toFixed(1);
                        const range = `${d.x0}-${d.x1}`;
                        
                        tooltip.transition()
                            .duration(200)
                            .style('opacity', 0.9);
                            
                        tooltip.html(`
                            <strong>Age: ${range}</strong><br/>
                            <strong>Female</strong><br/>
                            Count: ${count}<br/>
                            Percentage: ${percentage}%
                        `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                            
                        select(this).attr('stroke', 'black').attr('stroke-width', 2);
                    })
                    .on('mouseout', function() {
                        tooltip.transition()
                            .duration(500)
                            .style('opacity', 0);
                            
                        select(this).attr('stroke', colorScale('Female')).attr('stroke-width', 1);
                    });
            
            // Add legend
            const legend = g.append('g')
                .attr('class', 'legend')
                .attr('transform', `translate(${width - 100}, 10)`);
            
            ['Male', 'Female'].forEach((sex, i) => {
                legend.append('rect')
                    .attr('x', 0)
                    .attr('y', i * 20)
                    .attr('width', 15)
                    .attr('height', 15)
                    .attr('fill', colorScale(sex));
                
                legend.append('text')
                    .attr('x', 20)
                    .attr('y', i * 20 + 12)
                    .text(sex)
                    .style('font-size', '12px');
            });
            
        } else {
            // Draw simple histogram with transition
            const t = transition().duration(500);
            
            const bars = g.append('g')
                .selectAll('rect')
                .data(bins as any[])
                .enter()
                .append('rect')
                .attr('x', (d: any) => x(d.x0 as number))
                .attr('width', (d: any) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
                .attr('y', height) // Start from bottom
                .attr('height', 0)
                .attr('fill', 'steelblue')
                .attr('stroke', 'white')
                .attr('stroke-width', 0.5);
            
            // Apply transition
            bars.transition(t)
                .attr('y', (d: any) => y(getBinValue(d)))
                .attr('height', (d: any) => height - y(getBinValue(d)));
                
            // Add tooltip interaction
            const tooltip = select('body').select('.age-tooltip');
            bars.on('mouseover', function(event, d: any) {
                    const count = d.length;
                    const percentage = (count / totalCount * 100).toFixed(1);
                    const range = `${d.x0}-${d.x1}`;
                    
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);
                        
                    tooltip.html(`
                        <strong>Age: ${range}</strong><br/>
                        Count: ${count}<br/>
                        Percentage: ${percentage}%
                    `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
                        
                    select(this).attr('stroke', 'black').attr('stroke-width', 2);
                })
                .on('mouseout', function() {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                    select(this).attr('stroke', 'white').attr('stroke-width', 0.5);
                });
        }

        // Add the axes
        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(axisBottom(x)
                .tickFormat(d => `${d}`))
            .style('font-size', '12px');

        g.append('g')
            .call(axisLeft(y))
            .style('font-size', '12px');

        // Add axis labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 40)
            .attr('text-anchor', 'middle')
            .text('Age (years)') // Always show Age (years) for x-axis
            .style('font-size', '14px');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -35)
            .attr('text-anchor', 'middle')
            .text(showPercentage ? 'Percentage of Cases (%)' : 'Number of Cases')
            .style('font-size', '14px');
            
        // Add title
        g.append('text')
            .attr('x', width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text('Age Distribution of Surgical Cases');

        // Add median line and IQR
        const medianX = x(stats.median);
        
        // Median line
        g.append('line')
            .attr('x1', medianX)
            .attr('x2', medianX)
            .attr('y1', height)
            .attr('y2', 10)
            .attr('stroke', 'red')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
        
        // IQR rectangle
        g.append('rect')
            .attr('x', x(stats.q1))
            .attr('width', x(stats.q3) - x(stats.q1))
            .attr('y', height + 5)
            .attr('height', 10)
            .attr('fill', 'rgba(255,0,0,0.3)');
        
        // Annotation for median
        g.append('text')
            .attr('x', medianX)
            .attr('y', 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(`Median: ${format(".1f")(stats.median)}`);
            
        // Annotation for IQR
        g.append('text')
            .attr('x', (x(stats.q1) + x(stats.q3)) / 2)
            .attr('y', height + 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(`IQR: ${format(".1f")(stats.q1)} - ${format(".1f")(stats.q3)}`);
            
        // Insight annotation
        if (stats.median > 60) {
            g.append('text')
                .attr('x', width * 0.75)
                .attr('y', height * 0.25)
                .attr('text-anchor', 'middle')
                .style('font-size', '13px')
                .style('font-style', 'italic')
                .style('fill', '#555')
                .text("Aging patient population");
        }
        
        // Create a special brush tooltip at the bottom of the chart
        const brushTooltip = select('body')
            .selectAll('.age-brush-tooltip')
            .data([0])
            .enter()
            .append('div')
            .attr('class', 'age-brush-tooltip')
            .style('opacity', 0)
            .style('position', 'fixed') // Changed from 'absolute' to 'fixed' for better positioning
            .style('background-color', 'rgba(70, 130, 180, 0.9)')
            .style('color', 'white')
            .style('border-radius', '4px')
            .style('padding', '6px 12px')
            .style('pointer-events', 'none')
            .style('font-size', '13px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style('z-index', '20')
            .style('transform', 'translateX(-50%)')
            .style('box-shadow', '0 2px 5px rgba(0,0,0,0.3)') // Added shadow for better visibility
            .style('border', '1px solid rgba(255,255,255,0.2)'); // Added subtle border
            
        // Add brush for age selection
        const brush = brushX()
            .extent([[0, 0], [width, height]])
            .on("start brush", (event) => {
                // Show current selection range during brushing
                if (event.selection) {
                    // Display a temporary tooltip showing the current selection
                    const [x0, x1] = event.selection.map((d: number) => Math.round(x.invert(d)));
                    const tooltip = select('body').select('.age-brush-tooltip');
                    
                    // Position the tooltip at the bottom of the chart
                    const chartRect = svg.getBoundingClientRect();
                    const tooltipContent = `Selecting Ages: ${x0} - ${x1} years`;
                    
                    // Calculate position - centered horizontally, fixed at the bottom
                    const tooltipX = chartRect.left + chartRect.width/2;
                    const tooltipY = chartRect.bottom - 20; // Position slightly higher from the bottom
                    
                    tooltip.html(tooltipContent)
                        .style('left', tooltipX + 'px')
                        .style('top', tooltipY + 'px')
                        .style('opacity', 1);
                }
            })
            .on("end", (event) => {
                // Hide the brush tooltip with a slight delay for better UX
                setTimeout(() => {
                    select('body').select('.age-brush-tooltip').style('opacity', 0);
                }, 500);
                
                if (!event.selection) {
                    if (ageRange[0] !== null) {
                        // Reset age range when brush is cleared
                        ageRange = [null, null];
                        // Force a redraw after resetting the range
                        setTimeout(() => draw(), 0);
                    }
                    return;
                }
                
                // Map the pixel coordinates to data values
                const [x0, x1] = event.selection.map((d: number) => x.invert(d));
                
                // Update the age range with rounded values
                const newRange: [number, number] = [Math.round(x0), Math.round(x1)];
                
                // Only update and redraw if the range has changed
                if (ageRange[0] !== newRange[0] || ageRange[1] !== newRange[1]) {
                    ageRange = newRange;
                    // Force a redraw with the new range
                    setTimeout(() => draw(), 0);
                }
            });
        
        // Add the brush to the chart
        const brushG = g.append("g")
            .attr("class", "brush")
            .call(brush);
            
        // If there's already a selection, restore it
        if (ageRange[0] !== null && ageRange[1] !== null) {
            brushG.call(
                brush.move, 
                [x(ageRange[0]), x(ageRange[1])]
            );
        }
    }
    
    // Track changes in props for redraw
    $: if (showPercentage !== undefined || showBySex !== undefined) {
        // Only redraw if we have the SVG element
        if (svg) {
            // Hide any tooltips when changing view mode
            select('body').select('.age-tooltip').style('opacity', 0);
            draw();
        }
    }

    onMount(() => {
        draw();
        
        // Clean up function to run when component is destroyed
        return () => {
            // Remove any tooltips when component is unmounted
            select('body').selectAll('.age-tooltip').remove();
        };
    });
    
    afterUpdate(draw);
    
    // Cleanup function to remove tooltips on unmount
    onMount(() => {
        return () => {
            select('body').selectAll('.age-tooltip').remove();
            select('body').selectAll('.age-brush-tooltip').remove();
        };
    });
</script>

<div class="age-distribution">
    <!-- Hidden input no longer needed since we use two-way binding -->
    <!-- We now use bind:showBySex with the parent component -->
    
    <div class="chart">
        <svg bind:this={svg} class="h-auto w-full"></svg>
    </div>
    
    {#if ageRange[0] !== null}
    <div class="age-range-indicator">
        <span>Age range: {ageRange[0]}–{ageRange[1]}</span>
        <button class="clear-btn" on:click={() => { 
            // Hide any tooltips that might be visible
            select('body').select('.age-tooltip').style('opacity', 0);
            
            ageRange = [null, null]; 
            // Force a timeout to ensure the state updates before redrawing
            setTimeout(() => draw(), 0); 
        }}>
            Clear filter
        </button>
    </div>
    {/if}
    
    <div class="insights">
        <p class="insight-text">
            Our surgical cases span six decades of life. The median age of {medianAge.toFixed(1)}
            suggests an aging population, with implications for surgical risk and recovery considerations.
            {#if showBySex}
            <span class="hint">
                Up through the 40-to-50 age range, female cases slightly outnumber males—likely reflecting a higher volume of elective and gynecologic‐related procedures in middle-aged women. After age 60, male surgical cases begin to exceed female, which may be driven by increased cardiovascular and oncologic interventions in older men.
            </span>
            {/if}
        </p>
    </div>
</div>

<style>
    .age-distribution {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .chart {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    
    .insights {
        margin-top: 0.5rem;
        padding: 0.75rem;
        background-color: #f8f9fa;
        border-radius: 5px;
        border-left: 4px solid steelblue;
        min-height: 80px; /* Consistent height with the department chart */
    }
    
    .insight-text {
        font-size: 0.9rem;
        line-height: 1.4;
        margin: 0;
    }
    
    .hint {
        display: block;
        margin-top: 0.5rem;
        font-style: italic;
        color: #555;
    }
    
    .age-range-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: #f0f4f8;
        border-radius: 4px;
        font-size: 0.9rem;
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .clear-btn {
        padding: 0.125rem 0.5rem;
        background-color: #4682b4;
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .clear-btn:hover {
        background-color: #366a99;
    }
    
    :global(.brush .selection) {
        fill: rgba(70, 130, 180, 0.2);
        stroke: steelblue;
        stroke-width: 1.5px;
    }
    
    :global(.brush .handle) {
        fill: #555;
        stroke: #000;
        stroke-width: 1px;
        opacity: 0.8;
    }
    
    :global(.brush .overlay) {
        cursor: crosshair;
    }
    
    /* Style for the age brush tooltip that appears at the bottom of the chart */
    :global(.age-brush-tooltip) {
        transition: opacity 0.2s ease-in-out;
    }
</style>