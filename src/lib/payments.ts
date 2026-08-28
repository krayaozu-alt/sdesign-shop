import 'server-only';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';

/**
 * ARCHITECTURE DE PAIEMENT
 * ------------------------
 * Aucun paiement n'est simule. Deux modes coexistent :
 *
 *  - mode "MANUEL"  : l'encaissement a lieu hors application (especes, depot
 *    mobile money au comptoir). L'operateur saisit le montant et la reference
 *    operateur ; l'application enregistre l'ecriture comptable et emet le recu.
 *    C'est le mode actif par defaut pour toutes les methodes.
 *
 *  - mode "API"     : integration directe avec l'API de l'operateur. Aucun
 *    fournisseur n'est configure a ce jour (pas de cles marchandes). Le contrat
 *    ci-dessous est le point d'extension : implementer `initiate` et `verify`
 *    dans un adaptateur, l'enregistrer dans PROVIDERS, et le flux applicatif
 *    (server actions, recus, tableau de bord) fonctionne sans autre changement.
 */

export type PaymentIntent = {
  amount: number;
  label: string;
  payerName: string;
  payerPhone?: string | null;
  reference: string;
};

export type PaymentInitResult =
  | { kind: 'MANUAL'; instructions: string }
  | { kind: 'REDIRECT'; url: string }
  | { kind: 'PENDING'; providerRef: string };

export interface PaymentProvider {
  code: PaymentMethod;
  label: string;
  mode: 'MANUEL' | 'API';
  /** true seulement quand les cles marchandes sont presentes dans l'environnement. */
  isConfigured(): boolean;
  initiate(intent: PaymentIntent): Promise<PaymentInitResult>;
  verify?(providerRef: string): Promise<{ status: 'PAYE' | 'EN_ATTENTE' | 'ANNULE' }>;
}

function manualProvider(code: PaymentMethod, instructions: string): PaymentProvider {
  return {
    code,
    label: PAYMENT_METHOD_LABELS[code],
    mode: 'MANUEL',
    isConfigured: () => true,
    async initiate() {
      return { kind: 'MANUAL', instructions };
    },
  };
}

export const PROVIDERS: Record<PaymentMethod, PaymentProvider> = {
  [PAYMENT_METHODS.ESPECES]: manualProvider(
    PAYMENT_METHODS.ESPECES,
    "Règlement en espèces à l'accueil de S.DESIGN SHOP.",
  ),
  [PAYMENT_METHODS.ORANGE_MONEY]: manualProvider(
    PAYMENT_METHODS.ORANGE_MONEY,
    "Effectuez le dépôt Orange Money sur le numéro de la boutique, puis communiquez l'identifiant de transaction.",
  ),
  [PAYMENT_METHODS.MOOV_MONEY]: manualProvider(
    PAYMENT_METHODS.MOOV_MONEY,
    "Effectuez le dépôt Moov Money sur le numéro de la boutique, puis communiquez l'identifiant de transaction.",
  ),
  [PAYMENT_METHODS.WAVE]: manualProvider(
    PAYMENT_METHODS.WAVE,
    "Effectuez le transfert Wave vers le compte de la boutique, puis communiquez l'identifiant de transaction.",
  ),
  [PAYMENT_METHODS.VIREMENT]: manualProvider(
    PAYMENT_METHODS.VIREMENT,
    'Virement bancaire : les coordonnées bancaires sont communiquées par la direction.',
  ),
  [PAYMENT_METHODS.AUTRE]: manualProvider(PAYMENT_METHODS.AUTRE, 'Autre moyen convenu avec la direction.'),
};

export function getProvider(method: string): PaymentProvider | null {
  return PROVIDERS[method as PaymentMethod] ?? null;
}

/** Vrai si au moins un fournisseur en mode API est configure. */
export function hasOnlinePayment(): boolean {
  return Object.values(PROVIDERS).some((p) => p.mode === 'API' && p.isConfigured());
}
