// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	export interface SurgeryCase {
		/* identifiers & times */
		caseid?: string;
		subjectid?: string;
		casestart?: number;
		caseend?: number;
		anestart?: number;
		aneend?: number;
		opstart?: number;
		opend?: number;
		adm?: number;
		dis?: number;

		/* outcomes */
		icu_days?: number;
		death_inhosp?: number;

		/* demographics */
		age?: number;
		sex?: 'M' | 'F';
		height?: number;
		weight?: number;
		bmi?: number;
		asa?: number;
		emop?: number;

		/* surgery meta */
		department?: string;
		optype?: string;
		dx?: string;
		opname?: string;
		approach?: string;
		position?: string;
		ane_type?: string;

		/* pre-op comorbidities & labs */
		preop_htn?: number;
		preop_dm?: number;
		preop_ecg?: string;
		preop_pft?: string;
		preop_hb?: number;
		preop_plt?: number;
		preop_pt?: number;
		preop_aptt?: number;
		preop_na?: number;
		preop_k?: number;
		preop_gluc?: number;
		preop_alb?: number;
		preop_ast?: number;
		preop_alt?: number;
		preop_bun?: number;
		preop_cr?: number;
		preop_ph?: number;
		preop_hco3?: number;
		preop_be?: number;
		preop_pao2?: number;
		preop_paco2?: number;
		preop_sao2?: number;

		/* airway & lines */
		cormack?: number;
		airway?: string;
		tubesize?: string;
		dltubesize?: string;
		lmasize?: string;
		iv1?: string;
		iv2?: string;
		aline1?: string;
		aline2?: string;
		cline1?: string;
		cline2?: string;

		/* intra-op volumes / drugs */
		intraop_ebl?: number;
		intraop_uo?: number;
		intraop_rbc?: number;
		intraop_ffp?: number;
		intraop_crystalloid?: number;
		intraop_colloid?: number;
		intraop_ppf?: number;
		intraop_mdz?: number;
		intraop_ftn?: number;
		intraop_rocu?: number;
		intraop_vecu?: number;
		intraop_eph?: number;
		intraop_phe?: number;
		intraop_epi?: number;
		intraop_ca?: number;

		/* fallback – lets TS accept any new column without errors */
		[extra: string]: number | string | undefined;
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
