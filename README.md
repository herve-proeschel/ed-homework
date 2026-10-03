# ed-homework

Application React autonome (SPA 100 % client-side) construite avec **Vite**, installable comme PWA et déployable sur un hébergement statique comme **GitHub Pages**.

Elle permet de se connecter à la plateforme **ÉcoleDirecte** (compte parent ou élève), de gérer la validation 2FA, de choisir un profil élève, de consulter les devoirs, l'emploi du temps et les notes, puis d'imprimer les devoirs et l'emploi du temps ou de les exporter au format papier ou PDF.

---

## Fonctionnalités

* **Authentification ÉcoleDirecte :** Connexion via le relais Cloudflare vers l'API privée (`/v3/login.awp`) avec prise en charge du flux de validation de sécurité (MFA / 2FA et QCM).
* **Persistance de session locale :** Sauvegarde de l'état de session dans `sessionStorage` pour éviter de se réauthentifier à chaque ouverture. L'identifiant et la validation 2FA mémorisée sont conservés séparément dans `localStorage`.
* **Support multi-profils (Comptes Famille & Élèves) :**
  * Extraction des profils depuis les comptes directs ou les profils famille.
  * Sélecteur d'élève avec affichage du nom et de la photo lorsque ces données sont fournies par ÉcoleDirecte.
* **Consultation du cahier de texte :**
  * Récupération des devoirs des dates futures, avec progression affichée pendant la collecte.
  * Décodage automatique du descriptif des devoirs (données Base64 + assainissement HTML).
  * Statut d'avancement (fait / à faire).
* **Consultation de l'emploi du temps :**
  * Bascule entre « Cahier de Texte », « Emploi du temps » et « Notes » en cliquant sur le titre.
  * Téléchargement de la semaine courante, puis de la semaine suivante au défilement.
  * Affichage vertical par jour dans l'application, sans échelle horaire répétitive.
* **Consultation des notes :**
  * Une boîte « Moyenne générale » puis une boîte par matière ayant des notes, avec la moyenne de l'élève comparée à celle de la classe et l'écart entre les deux.
  * Liste des notes reçues par matière (date, devoir, valeur, coefficient, moyenne de classe du devoir). Les notes d'une sous-matière (Oral, Écrit) sont rattachées à la matière parente.
  * Indicateur de tendance (▲ hausse, ▬ stable, ▼ baisse) : la moyenne avec et sans les notes de la date la plus récente est comparée, avec un seuil de 0,25 point.
  * Rappel de la moyenne de la période précédente (semestre ou trimestre) lorsqu'elle existe, et onglets pour changer de période.
  * Les moyennes sont recalculées à partir des notes (ramenées sur 20 et pondérées par leur coefficient ; la moyenne générale est pondérée par les coefficients des matières), car les moyennes et le rang renvoyés par l'API peuvent être en retard ou incohérents. Le rang n'est pas affiché.
  * Pas d'impression pour cette vue.
* **Export & Impression PDF instantanés :**
  * Bouton dédié pour imprimer les devoirs ou l'emploi du temps téléchargé.
  * L'emploi du temps est imprimé semaine par semaine, du lundi au vendredi, comme dans l'extension `ed-chrome-extension`.
  * Feuille de style optimisée `@media print` avec pagination automatique A4, masquant les éléments d'interface parasites.
  * Déclenchement via `window.print()` vers une imprimante physique ou la sortie PDF native du navigateur.
* **PWA hors ligne partielle :** Le shell et les assets générés sont précachés par un service worker en production. Les appels à l'API et les données privées restent toujours récupérés sur le réseau.

---

## Architecture & Contraintes Techniques

### 1. Relais Cloudflare et CORS
L'API privée d'ÉcoleDirecte ne permet pas les appels directs depuis le navigateur. L'application utilise le Worker défini par la variable d'environnement `VITE_PROXY_BASE_URL` :

```text
https://ed-cors-proxy.herve-proeschel.workers.dev
```

Le Worker relaie les requêtes vers `https://api.ecoledirecte.com`, ajoute les en-têtes attendus par ÉcoleDirecte et expose au navigateur les en-têtes de session (`X-Token`, `2fa-token`, `x-all-cookies`). Il répond également aux préflights `OPTIONS`.

Il n'y a actuellement **aucun proxy Vite local** ni backend exécuté avec le frontend : le même Worker est utilisé en développement et en production.

### 2. Format des requêtes ÉcoleDirecte
* Les requêtes vers l'API sont émises en `POST` avec le payload sérialisé au format form-urlencoded : `data={"identifiant":"...","motdepasse":"..."}`.
* Les requêtes authentifiées véhiculent l'en-tête `X-Token`.
* L'emploi du temps utilise `POST /v3/E/{eleveId}/emploidutemps.awp?verbe=get` avec `dateDebut`, `dateFin` et `avecTrous: false`.

---

## Installation, tests et développement local

### Prérequis
* Node.js (>= 18)
* npm ou pnpm

### Lancement

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev

# Vérifications
npm run lint
npm test
npm run build

# Prévisualisation du build de production
npm run preview
```

Le build accepte `VITE_BASE_URL` pour définir le chemin de base d'un déploiement statique. Sans cette variable, la base est `/`. Il nécessite aussi `VITE_PROXY_BASE_URL`, disponible dans `.env.example` pour le développement local. Le plugin `vite-plugin-pwa` génère `dist/sw.js` et `dist/manifest.webmanifest`, précache les fichiers statiques présents dans `dist` et traite les requêtes GET/POST vers le proxy en `NetworkOnly` : aucune donnée de session ou réponse ÉcoleDirecte n'est mise en cache.

### Déployer le proxy Cloudflare

Le Worker défini dans `cloudflare.js` est déployé par le workflow GitHub Actions **Deploy Cloudflare Worker**. Le workflow se déclenche automatiquement sur `main` ou `master` lorsqu'un push modifie `cloudflare.js`, `wrangler.toml` ou le workflow lui-même. Il reste également lançable manuellement.

Dans les paramètres du dépôt GitHub, créez l'environnement `cloudflare-production`, activez une approbation obligatoire pour cet environnement, puis ajoutez ces secrets d'environnement :

* `CLOUDFLARE_API_TOKEN` : un token API Cloudflare limité au compte et au service Workers `ed-cors-proxy`, avec la permission `Workers Scripts: Edit`.
* `CLOUDFLARE_ACCOUNT_ID` : l'identifiant du compte Cloudflare `xxx`.
* `CLOUDFLARE_WORKER_NAME` : le nom du Worker Cloudflare à publier.

Pour un déploiement manuel, ouvrez **Actions > Deploy Cloudflare Worker > Run workflow**. GitHub demandera l'approbation de l'environnement avant d'utiliser les secrets.

Ajoutez également les secrets d'environnement `ALLOWED_ORIGINS` et `CLOUDFLARE_WORKER_NAME`. Par exemple, `ALLOWED_ORIGINS` peut contenir `https://herve-proeschel.github.io,http://localhost:5173,http://127.0.0.1:5173` et `CLOUDFLARE_WORKER_NAME` peut contenir `ed-cors-proxy`. Le workflow injecte directement ces secrets dans la commande Wrangler; le nom du Worker et les origines autorisées ne sont pas codés dans le dépôt.

Pour le workflow GitHub Pages, ajoutez également le secret d'environnement `VITE_PROXY_BASE_URL` contenant l'URL publique du Worker dans `cloudflare-production`. Le job de build GitHub Pages utilise cet environnement pour accéder au secret. Comme cette valeur est utilisée par le navigateur, Vite l'intègre au JavaScript généré : elle ne doit donc pas contenir un secret réel.

Le worker n'autorise que les routes et méthodes utilisées par l'application, limite les corps à 64 KiB et annule les appels amont après 10 secondes. Les tentatives de connexion et les réponses 2FA sont limitées à 5 par minute et par adresse IP. Pour un rate limiting distribué entre les instances Cloudflare, configurer les bindings `LOGIN_RATE_LIMITER` et `TWO_FA_RATE_LIMITER`; sans ces bindings, un limiteur mémoire local fournit un filet de sécurité non distribué.

Dans `wrangler.toml`, déclarez les deux bindings avec des `namespace_id` distincts :

```toml
[[ratelimits]]
name = "LOGIN_RATE_LIMITER"
namespace_id = "1001"
simple = { limit = 5, period = 60 }

[[ratelimits]]
name = "TWO_FA_RATE_LIMITER"
namespace_id = "1002"
simple = { limit = 5, period = 60 }
```

Les deux bindings limitent les connexions et les validations 2FA à 5 tentatives par minute et par adresse IP. Déployez ensuite le Worker avec `npx wrangler deploy`.

## Stockage et sécurité

* `sessionStorage.ed_session` contient le token actif, le token 2FA, GTK, les cookies réduits, l'élève sélectionné, la liste des élèves et le nom affiché.
* `localStorage.ed_user` contient uniquement l'identifiant utilisé pour préremplir le formulaire.
* `localStorage.ed_fa` contient la réponse de validation 2FA mémorisée.
* Le mot de passe reste uniquement dans l'état React pendant la session de la page et n'est pas écrit dans le stockage du navigateur.

Le Worker ne contient pas de base de données et ne persiste pas la session. La déconnexion et l'expiration de session suppriment les données de session locales. Les appels API et les réponses privées ne sont pas mis en cache par le service worker.

## Confidentialité des données (Data privacy)

Aucune donnée de l'utilisateur n'est stockée en dehors du client web. Les identifiants, tokens, cookies de session, profils élèves et devoirs sont conservés uniquement dans la mémoire de la page ou dans le `sessionStorage` et le `localStorage` du navigateur, selon le besoin décrit ci-dessus.

Le relais Cloudflare ne fait que transmettre les requêtes entre le navigateur et ÉcoleDirecte : il ne possède pas de base de données et ne persiste aucune donnée utilisateur. Les données privées ne sont pas mises en cache par l'application. Elles transitent néanmoins par ce relais et par les services d'ÉcoleDirecte nécessaires à l'authentification et à la récupération des devoirs.

## Limites connues

Le worker ne journalise aucun mot de passe, token, cookie ni corps de requête. Les erreurs renvoyées au navigateur sont génériques afin de ne pas divulguer le détail de l'amont.

Pour la production, vérifier que `ALLOWED_ORIGINS` contient l'origine exacte affichée par GitHub Pages et configurer les deux bindings de rate limiting dans Cloudflare. Ne jamais ajouter de secret, de token Cloudflare ou de cookie dans une variable publique du frontend.