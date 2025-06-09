<div class="slide-container">
	<div class="content">
		<h1 class="title text-text-accent">The Takeaway</h1>
		<p class="description">
			Our journey through Seoul National University's VitalDB reveals four critical insights that could transform surgical care.

			1. Demographics matter more than we thought since 95% of our 6,388 cases cluster in just two departments, creating distinct risk profiles. This concentration means that the results from our analysis are more applicable to a select few departments.

			2. Timing is everything. From anesthesia to incision, different procedures have their own rhythm as breast surgeries average 34 minutes while transplantations take 70 minutes. This pre-incision time can significantly impacts outcomes, so it is important to be aware of.

			3. Pre-op albumin levels, easily measured and often correctable, strongly predict ICU stays. This simple blood test could be our early warning system, allowing us to intervene before complications arise.

			4. Our interactive risk builder and prediction test revealed that while we can't change age, we can optimize care through better risk assessment. The interaction between emergency status and ASA score reveals patterns that standard checklists miss.

			By understanding these relationships, we can better prepare blood products, adjust recovery expectations, and potentially prevent complications, all before the knife ever touches skin.
		</p>
	</div>
</div>

<style>
	.slide-container {
		height: 100vh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 15vh 4vw 4vh 4vw;
		box-sizing: border-box;
	}

	.content {
		max-width: 90ch;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: clamp(1.5rem, 3vh, 2.5rem);
		margin-top: 5vh;
	}

	.title {
		font-size: clamp(2rem, 5vh, 3.5rem);
		line-height: 1.2;
		font-weight: 600;
		text-align: center;
	}

	.description {
		font-size: clamp(1rem, 2vh, 1.25rem);
		line-height: 1.6;
		text-align: center;
		margin: 0;
		white-space: pre-line;
	}
</style>
