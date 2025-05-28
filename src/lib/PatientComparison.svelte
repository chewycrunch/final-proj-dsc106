<script lang="ts">
  import Timeline from './Timeline.svelte';
  export let data: Record<string, any>[] = [];
  let patientA: number | null = null, patientB: number | null = null;
</script>

<div>
  <h2>Compare Two Patients</h2>
  <select bind:value={patientA}>
    <option value={null}>Select Patient A</option>
    {#each data as patient, i}
      <option value={i}>{patient.caseid} - Age {patient.age}</option>
    {/each}
  </select>
  <select bind:value={patientB}>
    <option value={null}>Select Patient B</option>
    {#each data as patient, i}
      <option value={i}>{patient.caseid} - Age {patient.age}</option>
    {/each}
  </select>
  <div style="display: flex; gap: 2rem;">
    {#if patientA !== null}<Timeline selectedPatient={data[patientA]} />{/if}
    {#if patientB !== null}<Timeline selectedPatient={data[patientB]} />{/if}
  </div>
</div> 