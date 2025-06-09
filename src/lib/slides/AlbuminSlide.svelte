<script lang="ts">
	import AlbuminRiskScatter from '$lib/AlbuminRiskScatter.svelte';

	interface Props {
		cases: SurgeryCase[];
	}
	let { cases }: Props = $props();
</script>

<h2>Hidden Risk Factor — The Albumin Cliff</h2>
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
	risk of prolonged ICU stay climbs sharply—our so-called "Albumin Cliff."
</p>
<br />

<AlbuminRiskScatter patients={cases} />

<div class="h-7"></div>

<h3>What we actually see</h3>
<ul class="list-inside list-disc space-y-1">
	<li>
		<strong>Elective cases show a clear threshold at 3 g/dL.</strong>
		Below 3 g/dL, median ICU stay jumps to 2.1 days (IQR 1–4) from 0.7 days (IQR 0–1) above the threshold.
		Long stays (amber & red) become three times more common below this level.
	</li>
	<li>
		<strong>Emergency cases have a higher threshold at 3.5 g/dL.</strong>
		Below this level, the chance of ≥ 3-day ICU stay doubles. The pattern remains consistent: lower albumin
		correlates with longer stays.
	</li>
	<li>
		Patients with albumin > 4 g/dL rarely require extended ICU care.
	</li>
</ul>

<p>
	<b>Take-away&nbsp;→</b> Albumin acts as a <em>silent gravity well</em>: lower levels make it harder to avoid
	extended ICU stays. Even in routine cases, poor nutrition can shift outcomes from same-day discharge to
	prolonged critical care.
</p>

<div class="h-16"></div>
