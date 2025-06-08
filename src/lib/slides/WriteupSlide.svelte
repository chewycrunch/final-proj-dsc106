<h2>Writeup</h2>
<p>
	1. What have you done so far? So far, we’ve built a comprehensive exploratory analysis of our
	surgical patient population to lay the groundwork for outcome-based modeling. We began by
	visualizing age distribution, revealing a wide range of patients from their twenties to their
	eighties. This range emphasizes the variation in baseline risk and physiological resilience across
	the cohort. We then created a department-wise breakdown of surgical cases, showing that general
	surgery dominates in volume, with notable contributions from thoracic surgery and urology.
	<br />In addition to demographic insights, we constructed a line chart to compare the average
	duration of each surgical phase (anesthesia, surgery, and recovery) across departments. This helps
	contextualize how time and resource demands vary by specialty. We also explored risk
	stratification through a radar chart comparing median outcomes for high- and low-risk cohorts.
	Metrics like mortality, ICU stay, and blood loss were visualized, clearly showing that
	pre-operative risk factors correlate with worse outcomes. Finally, we built an interactive tool
	that allows users to manipulate variables like age, ASA status, and emergency status to simulate
	predicted risks, making the data both accessible and actionable.
	<br /><br />2. What will be the most challenging part of your project to design and why? The most
	challenging component of the project will likely be the design and refinement of the “Build Your
	Own Patient” predictive interface. While the tool currently visualizes model output based on
	user-selected inputs, accurately modeling risk for ICU stay and in-hospital mortality from such a
	small set of parameters introduces complexity. Capturing the nuances of surgical risk—especially
	interactions between variables like age and ASA score—requires both careful feature engineering
	and robust validation against clinical outcomes.
	<br />Additionally, designing an interface that is intuitive yet scientifically accurate presents
	a UI/UX challenge. Users must understand the sensitivity of predictions without misinterpreting
	them as deterministic. Balancing simplicity with explanatory power, and ensuring the tool reflects
	real-world risk distributions without bias, will require tight integration between the front-end
	experience and the underlying model logic. Finally, scaling the model for more granular or
	department-specific predictions while maintaining speed and clarity will require thoughtful
	architectural decisions as the project evolves.
</p>
