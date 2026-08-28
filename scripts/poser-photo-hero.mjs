/**
 * Pose (ou retire) une photo de hero, par le circuit R2 securise.
 *
 * Sert a deux choses :
 *   - verifier le hero AVEC une vraie image avant que la photo definitive
 *     n'arrive ;
 *   - integrer la photo definitive une fois qu'elle est deposee dans le projet.
 *
 * Le circuit est exactement celui de l'application : envoi -> verification
 * SHA-256 sur l'URL publique -> ecriture du reglage -> retrait de l'ancien
 * fichier UNIQUEMENT s'il n'est plus reference ailleurs.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/poser-photo-hero.mjs <chemin-du-fichier>
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/poser-photo-hero.mjs --retirer
 */
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { saveUpload, verifierEcriture, retirerAncienFichier } from '@/server/uploads';

const prisma = new PrismaClient();
const arg = process.argv[2];

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const lire = async () => (await prisma.setting.findUnique({ where: { key: 'hero.imageUrl' } }))?.value ?? '';
async function ecrire(valeur) {
  await prisma.setting.upsert({
    where: { key: 'hero.imageUrl' },
    update: { value: valeur },
    create: {
      key: 'hero.imageUrl',
      value: valeur,
      label: 'Photo du hero (accueil)',
      group: 'IDENTITE',
      type: 'IMAGE',
    },
  });
}

const ancienne = await lire();

if (!arg) {
  console.log('Usage : poser-photo-hero.mjs <chemin-image> | --retirer');
  console.log(`Photo actuelle : ${ancienne || '(aucune)'}`);
} else if (arg === '--retirer') {
  await ecrire('');
  const r = await retirerAncienFichier(ancienne, '');
  console.log(`Photo retiree du reglage. Fichier : ${r.supprime ? 'supprime du stockage' : r.raison}`);
} else {
  const ext = extname(arg).toLowerCase();
  const type = TYPES[ext];
  if (!type) throw new Error(`Format non pris en charge : ${ext} (attendu .jpg, .png ou .webp)`);

  const octets = await readFile(arg);
  console.log(`Fichier lu : ${basename(arg)} — ${(octets.length / 1024).toFixed(0)} Ko`);

  const envoi = await saveUpload(new File([octets], basename(arg), { type }));
  if (!envoi?.ok) throw new Error(envoi?.error ?? 'envoi impossible');
  console.log('Envoye sur le stockage.');

  const controle = await verifierEcriture(envoi.url, envoi.sha256);
  if (!controle.ok) throw new Error(`Verification echouee : ${controle.error}`);
  console.log('Verifie : le fichier est lisible et son empreinte correspond.');

  await ecrire(envoi.url);
  console.log('Reglage mis a jour.');

  const r = await retirerAncienFichier(ancienne, envoi.url);
  console.log(`Ancienne photo : ${r.supprime ? 'retiree du stockage' : r.raison}`);
  console.log(`\nPhoto du hero en place : ${envoi.url}`);
}

await prisma.$disconnect();
