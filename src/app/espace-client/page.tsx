import { redirect } from 'next/navigation';

/**
 * Alias historique : l'espace personnel des clientes vit sous `/espace`.
 * Cette route conserve les liens et signets pointant vers `/espace-client`.
 */
export default function EspaceClientAlias() {
  redirect('/espace');
}
