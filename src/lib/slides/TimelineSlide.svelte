<script lang="ts">
	import AggregatedTimeline from '$lib/AggregatedTimeline.svelte';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();
</script>

<div class="slide-container">
	<div class="content">
		<h2>Time on the Table</h2>
		<p class="description">
			Each dot marks a key moment in surgery. The visualization shows <strong>mean, min, and max durations</strong>
			across our 6,388 cases. Try the filters above—switch between department and surgery type to see how
			<strong>different procedures have their own rhythm</strong>. This pre-incision time matters, as longer anesthesia exposure
			before surgery increases risk of complications. If you're facing surgery, use these filters to see
			typical timing patterns for your procedure—knowledge that can help you understand and prepare for
			your own surgical journey. Hover over dots for exact timing stats.
		</p>

		<div class="timeline-wrapper">
			<AggregatedTimeline {cases} />
		</div>

		<p class="timing-note">
			For instance, breast surgeries average just <strong>34 minutes</strong> from anesthesia to incision, 
			while transplantations take nearly twice as long, <strong>at 70 minutes</strong>.
		</p>
	</div>
</div>

<style>
	.slide-container {
		height: 100vh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 8vh 2.5rem 4vh 2.5rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.content {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: clamp(1rem, 2vh, 1.5rem);
	}

	h2 {
		font-size: clamp(1.8rem, 3vh, 2.2rem);
		text-align: left;
		margin: 0;
	}

	.description {
		font-size: clamp(0.95rem, 1.8vh, 1.1rem);
		line-height: 1.5;
		text-align: left;
		margin: 0;
	}

	.timeline-wrapper {
		width: 100%;
		margin: 1vh 0;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.timing-note {
		font-size: clamp(0.95rem, 1.8vh, 1.1rem);
		line-height: 1.5;
		text-align: center;
		margin: 0;
		color: #CBD5E0;
		font-style: italic;
	}

	/* Make sure the timeline component fills the available space */
	:global(.timeline-container) {
		width: 100%;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	:global(.timeline-visualization) {
		width: 100%;
		flex: 1;
		min-height: 0;
	}

	:global(.timeline-visualization svg) {
		height: 100%;
		width: 100%;
	}
</style>
