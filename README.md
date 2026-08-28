# S.DESIGN SHOP

Plateforme de gestion pour **S.DESIGN SHOP** — *Beauté • Formation • Élégance*.
Site public (formations, prestations, réservation, galerie, contact), espaces client et élève,
et back-office complet (clientes, élèves, formations, paiements, reçus, certificats, rapports).

---

## 1. Installation

### Prérequis

**Node.js 20 LTS** — à installer une seule fois :

```bash
winget install OpenJS.NodeJS.LTS
```

ou depuis <https://nodejs.org> (installeur `.msi` Windows x64). Refermez puis rouvrez votre terminal.

### Mise en route

```bash
npm install
```

> **npm 11 et les scripts d'installation.** npm ≥ 11 bloque par défaut les scripts
> `postinstall`. Sans eux, Prisma n'a pas ses moteurs et `tsx` pas son binaire esbuild :
> `npm run setup` échouerait. Si l'installation affiche
> `packages have install scripts not yet covered by allowScripts`, exécutez :
>
> ```bash
> npm install-scripts approve @prisma/client @prisma/engines prisma esbuild unrs-resolver
> ```

```bash
npm run setup
```

`npm run setup` génère le client Prisma, crée la base SQLite et installe le catalogue de départ
(11 formations, 9 prestations, paramètres de la boutique).

```bash
npm run dev
```

L'application est disponible sur <http://localhost:3000>.

### Compte administrateur initial

| | |
|---|---|
| Téléphone | `+226 76 51 88 11` |
| Mot de passe | `Admin@2026` |

**Changez ce mot de passe dès la première connexion** (Mon espace → Sécurité), puis mettez à jour
les coordonnées réelles dans *Admin → Paramètres*.

---

## 1 ter. Logo officiel

L'application cherche le logo dans cet ordre :

1. le logo téléversé dans **Admin → Paramètres → Logo** ;
2. le fichier **`public/logo-sdesign.png`** (aussi `.webp`, `.jpg`, `.svg`) ;
3. à défaut, le logotype typographique de secours.

Le logo officiel se téléverse depuis *Admin → Paramètres → Logo de la boutique* : il est
enregistré dans `public/uploads`, le chemin est stocké dans le réglage `shop.logoUrl`, et le
nouveau logo s'applique **partout immédiatement, sans modification de code**. Le logo portant
déjà sa signature « Création | Formation | Élégance », l'interface n'ajoute aucune baseline
sous l'image. Si le fichier ne se charge pas, l'application affiche « S.DESIGN SHOP » en texte
discret — jamais un logo de remplacement.

> **⚠️ Hébergement Cloudflare.** `public/uploads` est un dossier **local** : sur Cloudflare
> Workers/Pages le système de fichiers est en lecture seule et non persistant, donc les
> téléversements (logo, photos de formations, galerie) **seraient perdus au déploiement**.
> Avant la mise en ligne, il faut brancher un stockage objet (Cloudflare **R2**) : le point
> d'extension unique est `src/server/uploads.ts` (`saveUpload`), tout le reste de
> l'application lit simplement l'URL stockée en base et n'a pas à changer.

## 1 bis. Données officielles

### Formations et prix officiels

| Formation | Prix |
|---|---|
| Coiffe simple | 25 000 FCFA |
| Coiffe sénégalais | 25 000 FCFA |
| Coiffe nigérienne | 45 000 FCFA |
| Éventail | 35 000 FCFA |
| Turban marié | 30 000 FCFA |
| Turban à la machine | 60 000 FCFA |
| Voile | 40 000 FCFA |
| Maquillage | 25 000 FCFA |

Ces tarifs sont la **source de vérité** : ils alimentent le catalogue, les fiches détaillées,
les inscriptions, le calcul des soldes et les reçus. Ils sont définis dans `prisma/seed.ts`
(`OFFICIAL_COURSES`) et modifiables à tout moment depuis *Admin → Formations*. Relancer
`npm run db:seed` restaure les valeurs officielles et retire du catalogue toute formation
hors liste (archivée si des élèves y sont inscrits, supprimée sinon).

Les **prestations** de l'institut n'ont pas encore de tarif officiel : leur prix est à 0 et
l'application affiche « Sur demande » jusqu'à saisie dans *Admin → Prestations*.

### Photos des formations

Chaque formation possède une **photothèque** (table `course_images`) : plusieurs photos,
dont une marquée principale. La photo principale est recopiée dans `courses.imageUrl` et
alimente les cartes du catalogue, l'accueil et la fiche détaillée.

Gestion : *Admin → Formations → ouvrir une formation → Photothèque* — ajouter une ou
plusieurs photos, définir la photo principale, supprimer. Les fichiers sont stockés dans
`public/uploads` (JPG/PNG/WEBP, 6 Mo maximum, nom de fichier généré aléatoirement).

Tant qu'aucune photo n'est fournie, le site affiche une **vignette de marque** portant le nom
de la formation et la mention « Photo à venir » : jamais une image empruntée qui pourrait
représenter une autre technique. Le tableau de bord signale les formations sans photo.

**Photos actuelles (provisoires).** Règle appliquée : une photo n'est retenue que si elle
montre **la technique exacte** de la formation. À défaut, la carte reste en « Photo à venir ».
Les images retenues viennent d'**Unsplash** ([licence](https://unsplash.com/fr/licence) :
usage **commercial** autorisé, sans permission ni attribution) et sont téléchargées dans
`public/uploads` (JPEG 1200×900, recadrage 4:3) — aucune URL externe en base.

| Formation | Photo |
|---|---|
| Coiffe simple | Coiffeuse tressant une cliente en salon |
| Coiffe sénégalais | Macro de torsades cordées (twists sénégalais) |
| Coiffe nigérienne | **Photo à venir** — aucune image vérifiable du Niger sur les banques libres |
| Éventail | **Photo à venir** — aucune coiffure en forme d'éventail trouvée |
| Turban marié | Femme en tenue de cérémonie africaine, turban élaboré |
| Turban à la machine | **Photo à venir** — aucune image de confection de turban à la machine |
| Voile | Mariée africaine avec voile en dentelle |
| Maquillage | Maquilleuse appliquant un fard sur une cliente (modèle non africaine) |

### Localisation officielle

| | |
|---|---|
| Adresse affichée | Ouagadougou, Burkina Faso |
| Quartier / zone | Marcoussi |
| Latitude | `12.40567398071289` |
| Longitude | `-1.6069070100784302` |

Ces valeurs sont **stockées dans les paramètres** (groupe `LOCALISATION`, table `settings`) et
modifiables depuis *Admin → Paramètres → Localisation de la boutique*. **Aucune coordonnée
n'est écrite en dur dans un composant** : toutes les URL de carte sont dérivées des réglages
par les fonctions de `src/lib/settings-schema.ts` (`mapEmbedUrl`, `mapLinkUrl`,
`mapDirectionsUrl`). Une latitude ou longitude invalide est **refusée à l'enregistrement**
plutôt que d'afficher un point approximatif.

« Marcoussi » n'apparaît que comme zone sur la page Contact — jamais sous le logo, jamais dans
le hero, jamais comme nom d'entreprise.

### Contact officiel

| | |
|---|---|
| WhatsApp / Appel | **+226 76 51 88 11** |
| Appel uniquement | **+226 62 71 30 19** |
| Localisation | Marcoussi, Burkina Faso |

Le lien WhatsApp pointe vers `https://wa.me/22676518811`. Un bouton WhatsApp flottant est
affiché sur l'accueil, les formations, les prestations, le détail d'une formation, la
réservation et le contact — jamais dans les espaces privés ni le back-office.
« Marcoussi, Burkina Faso » n'apparaît que dans la section Contact, la page Contact et le
pied de page : jamais comme slogan sous le logo.

## 2. Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port 3000) |
| `npm run build` | Build de production |
| `npm start` | Serveur de production |
| `npm run db:push` | Applique le schéma Prisma à la base |
| `npm run db:seed` | (Ré)installe le catalogue de départ — idempotent |
| `npm run db:studio` | Explorateur de base de données Prisma |
| `npm run setup` | `db:push` + `db:seed` + génération du client |

---

## 3. Architecture

```
prisma/schema.prisma      Schéma de la base (18 tables + module_progress, testimonials)
prisma/seed.ts            Catalogue initial, paramètres, compte admin

src/app/(site)/           Site public + espaces client & élève
src/app/admin/            Back-office (rôles ADMIN / FORMATEUR / EMPLOYE)
src/app/certificat/[n]/   Certificat imprimable (QR de vérification)
src/app/recu/[n]/         Reçu imprimable
src/app/api/              Déconnexion, export CSV
src/middleware.ts         Barrière de session sur /admin et /espace

src/components/           UI (primitives, formulaires, layout, graphiques)
src/lib/                  Auth, RBAC, constantes, validation Zod, formats,
                          paiements, notifications, QR, paramètres
src/server/actions/       Server actions (toute écriture passe par ici)
src/server/reports.ts     Calculs du tableau de bord et des rapports
src/server/guard.ts       Contrôle de permission des server actions
src/server/uploads.ts     Téléversement de fichiers (public/uploads)
```

### Technologies

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Prisma · SQLite · Zod · Recharts · jose · bcryptjs

### Rôles et permissions

| Rôle | Accès |
|---|---|
| **ADMINISTRATEUR** | Tout, y compris paramètres, utilisateurs, journal, rapports |
| **FORMATEUR** | Élèves, formations, présences, progression, certificats |
| **EMPLOYÉ** | Clientes, réservations, prestations, encaissements, reçus |
| **ÉLÈVE** | Espace élève : progression, modules, présences, paiements, certificats |
| **CLIENTE** | Espace personnel : rendez-vous, paiements, notifications |

La matrice se trouve dans `src/lib/rbac.ts`. Elle est appliquée à **deux niveaux** :
`requirePermission()` (`src/lib/auth.ts`) à l'ouverture de chaque écran du back-office — masquer un
lien de menu ne protège pas la donnée — et `guard()` (`src/server/guard.ts`) avant chaque écriture.

---

## 4. Points importants

### Paiements — aucune simulation

Aucun paiement n'est prélevé en ligne. Les règlements (espèces, Orange Money, Moov Money, Wave)
sont encaissés par la boutique puis **saisis en caisse**, ce qui génère automatiquement le reçu et
recalcule les soldes. `src/lib/payments.ts` définit l'interface `PaymentProvider` : pour brancher
une API opérateur, implémentez `initiate` / `verify` dans un adaptateur et enregistrez-le dans
`PROVIDERS` — le reste de l'application est inchangé.

### Notifications

Le canal **APP** est opérationnel (centre de notifications in-app). Les canaux **WhatsApp / SMS /
Email** suivent le même contrat `Channel` dans `src/lib/notifications.ts` ; sans fournisseur
configuré, les messages sont enregistrés en file d'attente, visibles dans *Admin → Notifications*,
et renvoyables dès qu'un adaptateur est branché.

### Certificats

Génération à la fin d'une formation (statut « Terminée ») : numéro unique `CERT-AAAA-00001`, code
de vérification, QR code pointant vers la page publique `/verifier/{code}`, mise en page A4
imprimable (impression navigateur → PDF).

### Données de départ

Le seed installe un catalogue **réaliste et entièrement modifiable** depuis le back-office. Aucune
statistique, aucun élève, aucune réservation ni paiement fictif n'est créé : tous les chiffres
affichés proviennent de l'usage réel.

---

## 5. Passage en production

1. **Base PostgreSQL** — dans `prisma/schema.prisma`, remplacez `provider = "sqlite"` par
   `provider = "postgresql"`, renseignez `DATABASE_URL`, puis `npx prisma migrate deploy`.
2. **Secret de session** — remplacez `AUTH_SECRET` par une valeur aléatoire longue.
3. **URL publique** — renseignez `NEXT_PUBLIC_APP_URL` (utilisée par les QR codes des certificats).
4. `npm run build && npm start`, derrière HTTPS.

Les fichiers téléversés sont stockés dans `public/uploads` : prévoyez une sauvegarde de ce dossier
et du fichier `prisma/sdesign.db`.
