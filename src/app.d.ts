// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	export interface SurgeryCase {
		caseid: string;

		/* demographics */
		age: number;
		sex: 'M' | 'F';
		bmi: number;

		/* surgery meta */
		department: string;
		optype: string;
		asa: number;
		emergency: number; // 0 = elective, 1 = emergency  ← unified name

		/* timeline (seconds from casestart) */
		casestart: number;
		anestart: number;
		opstart: number;
		opend: number;
		aneend: number;
		caseend: number;
		dis: number;

		/* outcomes */
		icu_days: number; // ICU stay (days)
		intraop_ebl: number; // blood loss (mL)
		death_inhosp: number; // 0 / 1

		/* risk flags */
		preop_htn: number; // hypertension 0/1
		preop_dm: number; // diabetes      0/1
	}

	export interface Predictors {
		age: number;
		bmi: number;
		asa: number;
		emergency: number;
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
