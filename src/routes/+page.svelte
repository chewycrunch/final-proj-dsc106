<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import Timeline from '../lib/Timeline.svelte';
	import PatientComparison from '../lib/PatientComparison.svelte';
	import BuildAPatient from '../lib/BuildAPatient.svelte';

	type Patient = Record<string, any>; // You can refine this type if you want
	let data: Patient[] = [];
	let selectedPatient: Patient | null = null;

	onMount(async () => {
		data = await d3.csv('/cases.csv', d3.autoType);
		selectedPatient = data[0];
	});
</script>

<div class="container">
	<!-- Hero Section -->
	<section class="hero-section">
		<div class="content">
			<h1>
				The Effect of <span class="highlight-purple">Surgical Risk Factors</span> on Patient Outcomes
				<span class="blinking-cursor">|</span>
			</h1>
			<p class="subtitle">
				Investigating how preoperative and intraoperative factors shape recovery, ICU stay, and survival—visualized through real patient data.
			</p>
			<div class="button-container">
				<button class="btn btn-primary" on:click={() => window.open('https://your-dataset-link.com', '_blank')}>Data</button>
				<button class="btn btn-secondary" on:click={() => window.open('https://www.facs.org/quality-programs/acs-nsqip/', '_blank')}>Explore more</button>
			</div>
		</div>
		<div class="product-display">
			<div class="star star-1">✧</div>
			<div class="star star-2">✧</div>
			<div class="rectangle-decoration"></div>
			<div class="product-image">
				<img src="https://cdn.pixabay.com/photo/2017/01/31/13/14/surgery-2027767_1280.png" alt="Surgery illustration">
			</div>
			<div class="badge badge-top"><i class="fas fa-procedures"></i></div>
			<div class="badge badge-bottom"><i class="fas fa-heartbeat"></i></div>
		</div>
	</section>

	<!-- Team Section -->
	<div class="features">
		<div class="feature">
			<h3 class="feature-title">[Your Name] <span class="highlight-orange">Lead</span></h3>
			<p class="feature-desc">Data Science</p>
		</div>
		<div class="feature">
			<h3 class="feature-title">[Collaborator]</h3>
			<p class="feature-desc">Visualization</p>
		</div>
		<div class="feature">
			<h3 class="feature-title">[Advisor]</h3>
			<p class="feature-desc">Clinical Advisor</p>
		</div>
		<div class="feature">
			<h3 class="feature-title">[Designer]</h3>
			<p class="feature-desc">UI/UX</p>
		</div>
	</div>

	<!-- Key Statistics Section -->
	<section class="stats-and-histo-container">
		<div class="stats-section">
			<div class="stats-card">
				<h3>Key <span class="highlight-orange">Statistics</span></h3>
				<p class="stats-description">Brief overview of surgical risk and our dataset.</p>
				<div class="stats-grid">
					<div class="stat-item">
						<span class="stat-value">300,000+</span>
						<span class="stat-label">surgeries analyzed</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">15%</span>
						<span class="stat-label">required ICU admission post-op</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">7%</span>
						<span class="stat-label">experienced major complications</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">3.2 days</span>
						<span class="stat-label">average ICU stay for high-risk patients</span>
					</div>
				</div>
			</div>
		</div>
		<div class="histo-section">
			<h2><span class="highlight-orange">ICU Stay</span> Comparison</h2>
			<p class="histo-description">
				Not all surgeries are equal. Explore how ICU stay varies by risk factors and patient profiles.
			</p>
			<div class="density-plot-container">
				<!-- D3 ICU stay histogram goes here -->
				<svg id="icu-histogram"></svg>
			</div>
		</div>
	</section>

	<!-- Risk Factor Scatterplot Section -->
	<section class="scatter-section">
		<div class="text-content">
			<h2>How Do <span class="highlight-purple">Risk Factors</span> Affect Outcomes?</h2>
			<p>
				Age, BMI, ASA score, and emergency status are key predictors of poor outcomes. The scatterplot below shows how these factors relate to ICU stay and survival.
			</p>
		</div>
		<div class="scatter-container">
			<!-- D3 scatterplot goes here -->
			<svg id="risk-scatterplot"></svg>
		</div>
	</section>

	<!-- Quote Section -->
	<div class="quote-container">
		<blockquote class="featured-quote">
			<p>
				"If we understand these risks better, we can prepare better—and maybe even save lives."
			</p>
			<cite>— Surgical Outcomes Team</cite>
		</blockquote>
	</div>

	<!-- Timeline & Comparison Section -->
	<section class="timeline-section">
		<h2>Timeline of a <span class="highlight-orange">Surgical Journey</span></h2>
		<p>
			Every patient's journey is unique. Follow a patient's timeline from surgery start, through ICU stay, to discharge.
		</p>
		{#if selectedPatient}
			<Timeline selectedPatient={selectedPatient} />
		{/if}
	</section>

	<section class="comparison-section">
		<h2>Dynamic <span class="highlight-purple">Comparison</span></h2>
		<p>
			Compare two patient profiles side-by-side. See how risk factors translate into real differences in recovery and survival.
		</p>
		<PatientComparison {data} />
	</section>

	<!-- Build-a-Patient Section -->
	<section class="build-patient-section">
		<h2>Build-a-<span class="highlight-orange">Patient</span></h2>
		<p>
			Curious how different factors combine? Input age, BMI, ASA score, and emergency status to see predicted ICU stay, blood loss, and survival probability.
		</p>
		<BuildAPatient />
	</section>

	<!-- Color Legend Section -->
	<section class="color-legend-section">
		<h2>Color <span class="highlight-purple">Gradient</span> Visuals</h2>
		<p>
			We use color to make risk visible: <span style="color:red">Red</span> for high mortality, <span style="color:orange">Orange</span> for long ICU stay, <span style="color:green">Green</span> for fast recovery.
		</p>
		<!-- Color legend or demo here -->
	</section>

	<!-- Conclusion Section -->
	<section class="conclusion-section">
		<div class="ending-image">
			<img src="https://cdn.pixabay.com/photo/2017/01/31/13/14/surgery-2027767_1280.png" alt="Surgery illustration">
		</div>
		<div class="ending-text">
			<h1>Conclusion</h1>
			<p>
				Our analysis shows that preoperative and intraoperative decisions shape outcomes more than we expect—especially for vulnerable patients. Personalized risk awareness isn't just helpful, it's necessary.
			</p>
		</div>
	</section>
</div>
