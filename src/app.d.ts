// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	export interface SurgeryCase {
		caseid: string;
		age: number;
		department: string;
		casestart: number;
		anestart: number;
		opstart: number;
		opend: number;
		dis: number;
		los_icu: number;
		intraop_ebl: number;
		death_inhosp: number;
		bmi: number;
		asa: number;
		emergency: number;
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
