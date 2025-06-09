<script lang="ts">
	import AlbuminRiskScatter from '$lib/AlbuminRiskScatter.svelte';

	interface Props {
		cases: SurgeryCase[];
	}
	let { cases }: Props = $props();
</script>

<h2>Hidden Risk Factor: The Albumin Cliff</h2>
<p>
	Albumin is a blood protein that reflects nutritional reserve and overall physiological resilience.
	In the pre-operative setting, low albumin levels often signal that a patient's body may struggle
	to recover. By highlighting albumin, we remind viewers that a seemingly "routine" lab value
	can quietly predict who may end up in the ICU.
	It's the kind of hidden detail that turns "routine" into "unexpected" when no one is watching.
</p>
<br />
<p>
	Use the radio buttons to flip between
	routine <b>elective</b>, urgent <b>emergency</b>, or <b>all</b> cases. Below a certain threshold, the
	risk of prolonged ICU stay climbs sharply, our so-called "Albumin Cliff."
</p>
<br />

<AlbuminRiskScatter patients={cases} />

<div class="h-7"></div>

<p class="insight">
	Albumin acts as a <em>silent gravity well</em>: lower levels make it harder to avoid
	extended ICU stays. Even in routine cases, poor nutrition can shift outcomes from same-day discharge to
	prolonged critical care.
</p>

<div class="h-16"></div>

<style>
	.insight {
		margin-top: 1.5rem;
		color: #CBD5E0;
		font-size: 1.46rem;
		line-height: 1.5;
	}
</style>
