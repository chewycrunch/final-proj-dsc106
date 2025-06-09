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
			across our 6,388 cases. Try the filters above, switch between department and surgery type to see how
			<strong>different procedures have their own rhythm</strong>. This pre-incision time matters, as longer anesthesia exposure
			before surgery increases risk of complications. If you're facing surgery, use these filters to see
			typical timing patterns for your procedure, knowledge that can help you understand and prepare for
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
		width: 100vw;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 8vh 2.5rem 4vh 2.5rem;
		box-sizing: border-box;
		overflow: hidden;
		color: #f1f5f9;
		position: fixed;
		top: 0;
		left: 0;
	}

	.content {
		width: min(1200px, 95vw);
		max-width: 1200px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin: 0 auto;
	}

	h2 {
		font-size: 2.2rem;
		text-align: left;
		margin: 0;
		line-height: 1.2;
	}

	.description {
		font-size: 1.1rem;
		line-height: 1.5;
		text-align: left;
		margin: 0;
		width: 100%;
	}

	.timeline-wrapper {
		width: 100%;
		margin: 1vh 0;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		backdrop-filter: blur(10px);
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.timing-note {
		font-size: 1.1rem;
		line-height: 1.5;
		text-align: center;
		margin: 0;
		color: #94a3b8;
		font-style: italic;
	}

	.transition-text {
		font-size: 1.1rem;
		line-height: 1.5;
		text-align: center;
		margin: 2rem 0 0 0;
		color: #94a3b8;
		font-style: italic;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
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

	/* Responsive adjustments */
	@media (max-width: 1200px) {
		.content {
			width: 95vw;
		}
	}

	@media (max-width: 900px) {
		.slide-container {
			padding: 6vh 1.5rem 2vh 1.5rem;
		}
		h2 {
			font-size: 1.8rem;
		}
		.description,
		.timing-note {
			font-size: 1rem;
		}
	}

	@media (max-width: 600px) {
		.slide-container {
			padding: 4vh 1rem 2vh 1rem;
		}
		h2 {
			font-size: 1.5rem;
		}
		.description,
		.timing-note {
			font-size: 0.95rem;
		}
	}
</style>
