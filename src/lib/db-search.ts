/**
 * Recherche textuelle portable entre SQLite et PostgreSQL.
 *
 * SQLite traite `contains` sans tenir compte de la casse pour les caracteres
 * ASCII ; PostgreSQL, non. Sans precaution, une recherche « awa » cesserait de
 * trouver « Awa » le jour de la bascule.
 *
 * L'option `mode: 'insensitive'` corrige cela cote PostgreSQL, mais le
 * connecteur SQLite la refuse. On l'ajoute donc uniquement lorsque la base est
 * reellement PostgreSQL, ce qui rend le meme code correct sur les deux
 * moteurs sans modification au moment du deploiement.
 */

export type FiltreTexte = { contains: string; mode?: 'insensitive' };

/** Vrai lorsque DATABASE_URL designe une base PostgreSQL. */
export function estPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return /^postgres(ql)?:\/\//i.test(url);
}

/** Filtre « contient », insensible a la casse sur PostgreSQL comme sur SQLite. */
export function contient(recherche: string): FiltreTexte {
  return estPostgres() ? { contains: recherche, mode: 'insensitive' } : { contains: recherche };
}
