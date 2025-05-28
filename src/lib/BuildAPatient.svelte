<script lang="ts">
  let age: number = 60, bmi: number = 25, asa: number = 2, emergency: boolean = false;
  let prediction: { icu: number; ebl: number; survival: number } | null = null;

  function predictRisk({ age, bmi, asa, emergency }: { age: number; bmi: number; asa: number; emergency: boolean }) {
    // Dummy logic for demonstration
    let icu = 1 + (asa - 2) + (emergency ? 2 : 0) + (age > 70 ? 1 : 0);
    let ebl = 200 + (bmi - 25) * 5 + (asa - 2) * 50;
    let survival = 0.98 - (asa - 2) * 0.05 - (emergency ? 0.1 : 0) - (age > 70 ? 0.05 : 0);
    return { icu, ebl, survival: Math.max(0, Math.min(1, survival)) };
  }

  function handleSubmit() {
    prediction = predictRisk({ age, bmi, asa, emergency });
  }
</script>

<div>
  <h2>Build-a-Patient</h2>
  <form on:submit|preventDefault={handleSubmit}>
    <label>Age: <input type="number" bind:value={age} /></label>
    <label>BMI: <input type="number" bind:value={bmi} /></label>
    <label>ASA: <input type="number" bind:value={asa} min="1" max="5" /></label>
    <label>Emergency: <input type="checkbox" bind:checked={emergency} /></label>
    <button type="submit">Predict</button>
  </form>
  {#if prediction}
    <div>
      <p>Predicted ICU Stay: {prediction.icu} days</p>
      <p>Predicted EBL: {prediction.ebl} mL</p>
      <p>Survival Probability: {Math.round(prediction.survival * 100)}%</p>
    </div>
  {/if}
</div> 