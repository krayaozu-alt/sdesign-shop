/**
 * Lit l'en-tete d'un PNG : dimensions, presence d'un canal de transparence,
 * et couleur des quatre coins. Sert a savoir comment integrer une photo dans
 * le hero (fond transparent, fond noir, ou fond a estomper).
 *
 *   node scripts/inspecter-png.mjs <fichier>
 */
import { readFile } from 'node:fs/promises';

const chemin = process.argv[2];
const octets = await readFile(chemin);

if (octets.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  console.log('Ce fichier n’est pas un PNG.');
  process.exit(1);
}

// Le bloc IHDR suit immediatement la signature.
const largeur = octets.readUInt32BE(16);
const hauteur = octets.readUInt32BE(20);
const profondeur = octets[24];
const typeCouleur = octets[25];

const TYPES = {
  0: 'niveaux de gris',
  2: 'RVB (sans transparence)',
  3: 'palette',
  4: 'niveaux de gris + transparence',
  6: 'RVB + transparence (RGBA)',
};

console.log(`Fichier      : ${chemin.split(/[\/]/).pop()}`);
console.log(`Dimensions   : ${largeur} x ${hauteur} px`);
console.log(`Rapport      : ${(largeur / hauteur).toFixed(3)} (${largeur > hauteur ? 'paysage' : 'portrait'})`);
console.log(`Profondeur   : ${profondeur} bits par canal`);
console.log(`Type         : ${TYPES[typeCouleur] ?? typeCouleur}`);
console.log(`Transparence : ${typeCouleur === 6 || typeCouleur === 4 ? 'OUI' : 'non'}`);
console.log(`Poids        : ${(octets.length / 1024).toFixed(0)} Ko`);
