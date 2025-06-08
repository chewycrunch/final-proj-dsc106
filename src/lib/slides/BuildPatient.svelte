<script lang="ts">
	import BuildPatient from '$lib/BuildPatient.svelte';

	interface Props {
		cases: SurgeryCase[];
	}

	let { cases }: Props = $props();

	let predictors = $state({ age: 60, bmi: 25, asa: 2, emergency: 0, height: 170 });
</script>

<h2>Interactive Risk Builder</h2>
<p class="mb-4">
	Now it's your turn. Build a patient profile using the sliders below. Watch how tiny shifts—a
	single ASA notch or clicking 'Emergency'—can triple the mortality risk instantly. We'll show you
	how many similar historical cases we found, so you can trust the predictions. Try the "Make a
	Guess" mode to test your intuition against the data.

	<br />
	<br />
	Once you are finished with your patient profile, you can move to the next slide to make your predictions
</p>
<BuildPatient {cases} bind:predictors />
