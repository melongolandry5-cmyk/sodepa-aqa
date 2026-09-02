export interface BudgetPlanOutput {
  id: string;
  libelle?: string;
  intitule?: string;
  annee?: number;
  exercice?: number;
  statut?: string;
  items?: BudgetItemOutput[];
  [key: string]: unknown;
}

export interface BudgetItemOutput {
  id?: string;
  compteCode?: string;
  sectionId?: string;
  montant?: number;
  [key: string]: unknown;
}

export interface EngagementOutput {
  numero?: string;
  numeroEngagement?: string;
  objet?: string;
  description?: string;
  montant?: number;
  statut?: string;
  [key: string]: unknown;
}
