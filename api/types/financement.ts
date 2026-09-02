export interface EcheanceOutput {
  numero?: number;
  dateEcheance?: string;
  capitalAmorti?: number;
  interets?: number;
  montantTotal?: number;
  capitalRestantDu?: number;
  [key: string]: unknown;
}

export interface FinancementSmartOutput {
  id: string;
  intitule?: string;
  type?: string;
  capital?: number;
  tauxNominal?: number;
  dateEffet?: string;
  dureeMois?: number;
  [key: string]: unknown;
}

export interface FinancementOutput extends FinancementSmartOutput {
  echeancier?: EcheanceOutput[];
}

export interface SimulationQuery {
  capital: number;
  tauxNominal: number;
  dureeMois: number;
  [key: string]: string | number | boolean;
}
