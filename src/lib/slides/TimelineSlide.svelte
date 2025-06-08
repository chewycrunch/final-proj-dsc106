<script lang="ts">
	import AggregatedTimeline from '$lib/AggregatedTimeline.svelte';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();
</script>

<h2>Time on the Table</h2>
<p class="max-w-9xl mx-auto mb-4">
	Each dot marks a key moment in surgery. The visualization shows <strong
		>mean, min, and max durations</strong
	>
	across our 6,388 cases. Try the filters above—switch between department and surgery type to see how
	<strong>different procedures have their own rhythm</strong>. For instance, breast surgeries
	average just <strong>34 minutes</strong> from anesthesia to incision, while transplantations take
	nearly twice as long,
	<strong>at 70 minutes</strong>. This pre-incision time matters, as longer anesthesia exposure
	before surgery increases risk of complications. If you're facing surgery, use these filters to see
	typical timing patterns for your procedure—knowledge that can help you understand and prepare for
	your own surgical journey. Hover over dots for exact timing stats.
</p>
<div>
	<AggregatedTimeline {cases} />
</div>
