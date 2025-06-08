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
	to recover. By highlighting albumin, we remind viewers that a seemingly "routine" lab value—often
	checked before surgery—can quietly predict who sails through the OR and who may end up in the ICU.
	It's the kind of hidden detail that turns "routine" into "unexpected" when no one is watching.
</p>
<br />
<p>
	<strong>x-axis</strong> = pre-operative albumin (g/dL).
	<strong>Dot color</strong> = post-op ICU stay (<span style="color:#a50026">red ≈ ≥ 3 days</span>,
	<span style="color:#3288bd">deep-blue ≈ 0–1 day</span>). Use the radio buttons to flip between
	routine <b>elective</b>, urgent <b>emergency</b>, or <b>all</b> cases. Below a certain threshold, the
	risk of prolonged ICU stay climbs sharply—our so-called "Albumin Cliff."
</p>
<br />

<AlbuminRiskScatter patients={cases} />

<h3>What we actually see</h3>
<ul class="list-inside list-disc space-y-1">
	<li>
		<strong>In elective cases, a pronounced shift appears near 3 g/dL.</strong>
		Patients with albumin just under 3 g/dL begin to light up orange and red, whereas above 3 g/dL most
		stay deep-blue.
		<span class="font-semibold">Median ICU stay below 3 g/dL is about 2.1 days (IQR 1–4),</span>
		compared to
		<span class="font-semibold">0.7 days (IQR 0–1) above 3 g/dL</span>. A few low-albumin blue
		outliers exist, but long-stayers (amber & red) become nearly three times more common once you
		cross that cliff.
	</li>
	<li>
		<strong>In emergencies, the "cliff" shifts upward to around 3.5 g/dL.</strong>
		Because urgent cases already carry extra risk, the median albumin threshold where ICU stays spike
		is higher. Below ~3.5 g/dL,
		<span class="font-semibold">the chance of ≥ 3-day ICU stay more than doubles</span>
		compared to those with albumin above 3.5 g/dL. The spread of dots is wider, but the color gradient
		still tilts toward red as albumin drops.
	</li>
	<li>
		High-albumin (> 4 g/dL) patients rarely linger, anchoring the schedule "clockwork" we saw in the
		opening hook.
	</li>
</ul>

<p>
	<b>Take-away&nbsp;→</b> Albumin isn't a guarantee of trouble, but a
	<em>silent gravity well</em>: the lower it drops, the harder it is to climb off the ICU track.
	Even in apparently routine electives, nutrition can tip the balance from day-case discharge to
	days of critical care.
</p>
