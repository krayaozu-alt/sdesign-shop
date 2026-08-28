# Mise en production — S.DESIGN SHOP

Architecture retenue : **Cloudflare en frontal, application Next.js 14 sur serveur Node.js.**
Aucune migration de framework. Priorité : stabilité.

```
Utilisateur
    │
    ▼
Cloudflare  ──  DNS · TLS · proxy · CDN · WAF
    │
    ▼  (HTTPS, port 443 → origine)
Serveur Node.js  ──  Next.js 14.2.35 (mode standalone)
    │
    ├──▶  PostgreSQL managé   (données métier)
    ├──▶  Cloudflare R2       (logo, photos, téléversements)
    └──▶  Brevo (API HTTP)    (codes OTP par e-mail)
```

R2 n'est pas traversé par le serveur pour la lecture : les navigateurs récupèrent
les images **directement** depuis le domaine public du bucket.

---

## 1. Serveur d'application

### 1.1 Version de Node.js

Next.js 14.2.35 exige `>=18.17.0`. Pour la production, utilisez **Node 20 LTS ou
22 LTS** : ce sont les versions éprouvées avec Next 14. Node 24 fonctionne pour
le développement local mais est postérieur à Next 14 et n'a pas été validé par
son éditeur.

### 1.2 Hébergeurs adaptés

| Hébergeur | Remarque |
| --- | --- |
| **VPS** (Hetzner, OVH, Contabo) | Le plus économique et le plus maîtrisable. Node + PM2 ou systemd, derrière Cloudflare. Demande un peu d'administration système. |
| **Railway** | Déploiement depuis Git, Node configurable, PostgreSQL intégré. Le plus simple. |
| **Render** | Équivalent, plan gratuit qui s'endort — à éviter pour une boutique. |
| **Fly.io** | Bon si vous voulez une région proche (Afrique de l'Ouest : Paris ou Johannesburg). |

À éviter ici : les plateformes purement *serverless*, qui ramèneraient les mêmes
contraintes que Cloudflare Workers.

### 1.3 Build et démarrage

`next.config.mjs` active `output: 'standalone'` : le build produit un serveur
autonome de ~60 Mo au lieu des 430 Mo de `.next` complet.

```bash
npm ci
npx prisma generate
npm run build

# Deux dossiers ne sont PAS copies automatiquement par Next :
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public

node .next/standalone/server.js
```

> **L'oubli de `cp -r .next/static` est la cause n°1 d'un site en production
> sans aucun style ni JavaScript.** Le serveur démarre, les pages répondent 200,
> mais rien n'est mis en forme.

Sous PM2 :

```bash
pm2 start .next/standalone/server.js --name sdesign --update-env
pm2 save && pm2 startup
```

Variables minimales au démarrage : `NODE_ENV=production`, `PORT`, `HOSTNAME`,
plus le bloc PRODUCTION de `.env.example`.

---

## 2. Cloudflare

### 2.1 DNS

| Type | Nom | Contenu | Proxy |
| --- | --- | --- | --- |
| A | `@` | IP du serveur | **Proxifié** (nuage orange) |
| A | `www` | IP du serveur | **Proxifié** |

Le nuage orange est ce qui active le CDN, le WAF et le TLS de Cloudflare. Sans
lui, Cloudflare ne fait que de la résolution DNS.

### 2.2 SSL/TLS

- Mode : **Full (strict)**. « Flexible » laisserait le trafic Cloudflare→serveur
  en clair ; « Full » sans strict accepterait un certificat invalide.
- Installez un **certificat d'origine Cloudflare** sur le serveur (valable 15 ans),
  ou un Let's Encrypt.
- Activez **Always Use HTTPS** et **Automatic HTTPS Rewrites**.
- HSTS : à activer une fois le site stable, pas avant.

### 2.3 Server Actions — le point critique

Next 14 compare l'en-tête `Origin` à `Host` / `X-Forwarded-Host` et **rejette
l'action si elles diffèrent**. Derrière un proxy, cela arrive dès que le port ou
l'hôte est réécrit. Tous les formulaires du site en dépendent.

Renseignez donc systématiquement :

```
SERVER_ACTIONS_ORIGINS="sdesignshop.com,www.sdesignshop.com"
```

`next.config.mjs` la transmet à `experimental.serverActions.allowedOrigins`.
À défaut, l'hôte de `NEXT_PUBLIC_APP_URL` est utilisé.

Vérifiez aussi que votre reverse proxy éventuel (nginx, Caddy) transmet bien
les en-têtes d'origine :

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP         $remote_addr;
```

### 2.4 Cache — ne jamais servir une page privée

L'application envoie déjà `Cache-Control: private, no-store` sur `/admin/*`,
`/espace/*`, `/api/*` et les pages d'authentification. Les règles Cloudflare
suivantes doublent cette protection.

**Règle 1 — Ne pas mettre en cache le privé** (Caching → Cache Rules)

```
Si   URI Path commence par  /admin
 ou  URI Path commence par  /espace
 ou  URI Path commence par  /api
 ou  URI Path est          /connexion, /creer-compte, /verification,
                           /mot-de-passe-oublie, /reinitialiser-mot-de-passe
 ou  Cookie contient       sds_session
Alors  Cache eligibility : Bypass cache
```

Le critère sur le cookie `sds_session` est le plus important : il garantit
qu'aucune réponse destinée à une personne connectée n'entre jamais en cache.

**Règle 2 — Mettre en cache les fichiers statiques** (sûr)

```
Si   URI Path commence par  /_next/static
 ou  URI Path commence par  /uploads
Alors  Cache eligibility : Eligible for cache
       Edge TTL : 1 an     Browser TTL : 1 an
```

Les fichiers de `/_next/static` portent une empreinte dans leur nom : ils sont
immuables, donc sans risque.

> Ne créez **jamais** de règle « Cache Everything » sur `/*`. Elle servirait le
> tableau de bord d'une cliente à la suivante.

### 2.5 Sécurité

- **WAF** : activez les *Managed Rules* Cloudflare (règles OWASP).
- **Rate limiting** sur l'authentification, en complément des limites internes :

  ```
  /connexion                    10 requêtes / minute / IP
  /creer-compte                  5 requêtes / minute / IP
  /mot-de-passe-oublie           5 requêtes / minute / IP
  ```

- **Bot Fight Mode** : à activer, mais vérifiez ensuite que les formulaires
  passent toujours.
- Ne placez **pas** `/admin` derrière Cloudflare Access sans y réfléchir : cela
  ajouterait une seconde authentification devant celle de l'application.

### 2.6 R2

Le bucket doit être **public en lecture** (sous-domaine `r2.dev` ou domaine
personnalisé). Les identifiants R2 ne servent qu'à l'écriture, côté serveur, et
ne sont jamais transmis au navigateur.

---

## 3. PostgreSQL

Le schéma est portable : 22 modèles, **aucun type natif `@db.`**, aucun champ
`Json`, aucun enum Prisma. **Prisma reste en 5.22** — aucun adaptateur de driver
n'est nécessaire sur un serveur Node.

### 3.1 Procédure

```bash
# 1. Sauvegarder ET exporter les donnees, schema encore en sqlite
node --env-file=.env scripts/exporter-donnees.mjs

# 2. Basculer le provider (sauvegarde automatique du schema et de la base)
node scripts/basculer-postgres.mjs                # simulation
node scripts/basculer-postgres.mjs --appliquer

# 3. Renseigner DATABASE_URL vers PostgreSQL, puis creer les tables
npx prisma migrate dev --name init-postgres
npx prisma generate

# 4. Reprendre les donnees existantes
node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json
node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json --appliquer
```

`npm run db:seed` ne doit **pas** être lancé si vous importez les données :
il créerait des doublons de formations et de prestations.

L'import refuse d'écrire dans une base déjà peuplée, sauf `--forcer`.

### 3.2 Recherche sensible à la casse

Déjà réglé : `src/lib/db-search.ts` ajoute `mode: 'insensitive'` uniquement
quand `DATABASE_URL` désigne PostgreSQL. Les 5 écrans de recherche fonctionnent
sur les deux moteurs sans modification.

### 3.3 Moteurs Prisma

`prisma/schema.prisma` déclare `binaryTargets = ["native", "debian-openssl-3.0.x"]`.
Un build effectué sous Windows embarque donc aussi le moteur Linux. Pour une
image Alpine, ajoutez `"linux-musl-openssl-3.0.x"`.

---

## 4. Cloudflare R2

```bash
npm run verifier:sigv4     # signature, aucune cle requise
npm run verifier:r2        # ecriture, lecture publique, suppression

npm run migrer:r2          # simulation
node --env-file=.env scripts/migrer-vers-r2.mjs --appliquer

node --env-file=.env scripts/verifier-images.mjs https://sdesignshop.com
```

`public/uploads/` étant exclu du dépôt, le logo officiel et les photos des
formations n'existent que sur le poste de développement : **la migration est
obligatoire**, sinon le site déployé s'affiche sans identité visuelle.

`verifier-images.mjs` contrôle que chaque URL répond en HTTP 200 avec un
`content-type` d'image, **et** que le nom de fichier correspond toujours à la
formation associée.

---

## 5. Brevo

```
EMAIL_DRIVER=brevo
BREVO_API_KEY=…
BREVO_SENDER_EMAIL=contact@sdesignshop.com
BREVO_SENDER_NAME=S.DESIGN SHOP
```

```bash
node --env-file=.env scripts/verifier-brevo.mjs vous@exemple.com
```

Le script vérifie la clé, contrôle que l'expéditeur est **déclaré et validé**
chez Brevo, puis envoie un message réel.

Tant que `BREVO_API_KEY` est absente, l'application reste en mode test — qui
**refuse de fonctionner** si `NODE_ENV=production`. Aucun code ne peut donc
fuiter dans les journaux. Dans ce cas, la page de vérification affiche un
avertissement invitant la cliente à téléphoner à la boutique.

---

## 6. Procédure exacte de mise en production

```bash
# --- Préparation locale ------------------------------------------------------
node --env-file=.env scripts/exporter-donnees.mjs
cp -r public/uploads "sauvegardes/uploads-$(date +%Y%m%d-%H%M%S)"
npm run verifier:sigv4

# --- Services externes -------------------------------------------------------
#  Créer la base PostgreSQL, le bucket R2, la clé Brevo, puis renseigner .env
npm run verifier:r2
node --env-file=.env scripts/verifier-brevo.mjs vous@exemple.com

# --- Base de données ---------------------------------------------------------
node scripts/basculer-postgres.mjs --appliquer
npx prisma migrate deploy
npx prisma generate
node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json --appliquer

# --- Fichiers ----------------------------------------------------------------
node --env-file=.env scripts/migrer-vers-r2.mjs --appliquer
#  puis passer STORAGE_DRIVER=r2

# --- Build et démarrage ------------------------------------------------------
npx tsc --noEmit
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public
NODE_ENV=production PORT=3000 node .next/standalone/server.js

# --- Cloudflare --------------------------------------------------------------
#  DNS proxifié, SSL Full (strict), règles de cache, WAF, rate limiting

# --- Contrôles finaux --------------------------------------------------------
node --env-file=.env scripts/verifier-images.mjs https://sdesignshop.com
```

Puis, à la main : créer un compte cliente réel, recevoir le code, l'activer, se
connecter, et vérifier dans Admin → Paramètres → Services techniques que le
stockage affiche `r2` et la messagerie `brevo`.

---

## 7. Procédure de rollback

Chaque étape est réversible. Dans l'ordre inverse.

### 7.1 Revenir à la version précédente de l'application

```bash
git checkout <commit-precedent>
npm ci && npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public
pm2 restart sdesign
```

### 7.2 Revenir à SQLite

```bash
node scripts/basculer-postgres.mjs --revenir --appliquer
npx prisma db push
npx prisma generate
# La base SQLite d'origine est intacte dans sauvegardes/
cp sauvegardes/sdesign-<horodatage>.db prisma/sdesign.db
```

### 7.3 Revenir au stockage local

```
STORAGE_DRIVER=local
```

Les fichiers d'origine n'ont **jamais** été supprimés de `public/uploads` par la
migration. Il reste à réécrire les URL en base :

```sql
UPDATE settings SET value = '/uploads/' || split_part(value, '/', -1)
  WHERE key = 'shop.logoUrl' AND value LIKE 'http%';
UPDATE courses SET "imageUrl" = '/uploads/' || split_part("imageUrl", '/', -1)
  WHERE "imageUrl" LIKE 'http%';
UPDATE course_images SET url = '/uploads/' || split_part(url, '/', -1)
  WHERE url LIKE 'http%';
```

### 7.4 Revenir en arrière sur Cloudflare

Passer le nuage orange au gris (DNS only) rétablit l'accès direct au serveur,
sans CDN ni WAF. Utile pour isoler un problème de cache ou de règle WAF.

### 7.5 Restaurer les données

```bash
# PostgreSQL
pg_restore -d "$DATABASE_URL" sauvegardes/<dump>
# ou re-import complet dans une base vide
node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json --appliquer
```

---

## 8. Sauvegardes

Le dossier `sauvegardes/` est exclu du dépôt — il contient des empreintes de
mots de passe. Il conserve :

- les copies de `prisma/sdesign.db` et de `prisma/schema.prisma` faites
  automatiquement par les scripts,
- les exports JSON complets,
- les copies de `public/uploads`.

En production, ajoutez les sauvegardes automatiques de votre fournisseur
PostgreSQL (Neon et Supabase en proposent) et une copie périodique du bucket R2.

---

## 9. Migration Neon effectuée — 27 août 2026

La bascule SQLite → PostgreSQL Neon est **faite et validée**.

| Élément | Valeur |
| --- | --- |
| Fournisseur | Neon, projet `sdesign-shop` |
| Base | `neondb`, schéma `public` |
| Région | AWS `eu-central-1` (Francfort) |
| Migration Prisma | `20260827134531_init_postgres` |
| Lignes migrées | **127 / 127** |

### 9.1 Deux chaînes de connexion

`prisma/schema.prisma` déclare désormais :

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // groupée, hôte en -pooler
  directUrl = env("DATABASE_URL_UNPOOLED")  // directe, exigée par prisma migrate
}
```

`prisma migrate` et `prisma db push` **refusent** de passer par la connexion
groupée. Les deux variables sont donc obligatoires en production.

Chacune se termine par `?sslmode=require&connect_timeout=15` : le délai évite un
échec pendant que l'instance Neon sort de veille (mise à l'échelle à zéro).

### 9.2 Vérifier les connexions sans exposer de secret

```bash
npm run verifier:postgres
```

Contrôle la forme des deux chaînes, leur cohérence (même base, même point
d'entrée), et leur joignabilité réelle en TCP + TLS. Aucune chaîne, aucun mot de
passe, aucun identifiant complet d'endpoint n'est affiché.

### 9.3 Comparer les deux bases

```bash
node --env-file=.env scripts/comparer-bases.mjs sauvegardes/donnees-….json
```

Produit le tableau ligne à ligne SQLite / PostgreSQL, puis contrôle les 8 prix,
les 2 téléphones, les coordonnées GPS, le logo, les hachages bcrypt et les
relations.

### 9.4 Rollback vers SQLite

Rien n'a été supprimé. `prisma/sdesign.db` est intact.

```bash
# 1. Remettre la valeur SQLite dans DATABASE_URL (conservée en commentaire
#    dans .env), et vider DATABASE_URL_UNPOOLED
# 2. Rebasculer le schéma
node scripts/basculer-postgres.mjs --revenir --appliquer
npx prisma db push
npx prisma generate
```

La base Neon n'est pas touchée par cette opération : elle reste disponible pour
une nouvelle tentative. Pour repartir d'une base Neon vierge, supprimez les
tables puis rejouez `prisma migrate deploy` et l'import.

### 9.5 Latence observée

Depuis ce poste vers Francfort, les pages du back-office répondent entre 0,7 s
et 2,5 s **en mode développement** (compilation à la demande incluse). Un
serveur de production situé en Europe réduira nettement ce délai. Prévoyez le
serveur d'application dans la même région que la base.
