# ed-homework

Application React autonome (SPA 100 % client-side) construite avec **Vite**, installable comme PWA et déployable sur un hébergement statique comme **GitHub Pages**.

Elle permet de se connecter à la plateforme **ÉcoleDirecte** (compte parent ou élève), de gérer la validation 2FA, de choisir un profil élève, de consulter les devoirs à venir et d'imprimer ou d'exporter l'intégralité du cahier de texte au format papier ou PDF.

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
* **Export & Impression PDF instantanés :**
  * Bouton dédié qui compile la totalité du planning récupéré.
  * Feuille de style optimisée `@media print` avec pagination automatique A4 (`page-break-inside: avoid`), masquant les éléments d'interface parasite (barres de navigation, boutons, filtres).
  * Déclenchement via `window.print()` vers une imprimante physique ou la sortie PDF native du navigateur.
* **PWA hors ligne partielle :** Le shell et les assets générés sont précachés par un service worker en production. Les appels à l'API et les données privées restent toujours récupérés sur le réseau.

---

## Architecture & Contraintes Techniques

### 1. Relais Cloudflare et CORS
L'API privée d'ÉcoleDirecte ne permet pas les appels directs depuis le navigateur. L'application utilise donc le Worker configuré en dur dans `src/services/edClient.js` :

```text
https://ed-cors-proxy.herve-proeschel.workers.dev
```

Le Worker relaie les requêtes vers `https://api.ecoledirecte.com`, ajoute les en-têtes attendus par ÉcoleDirecte et expose au navigateur les en-têtes de session (`X-Token`, `2fa-token`, `x-all-cookies`). Il répond également aux préflights `OPTIONS`.

Il n'y a actuellement **aucun proxy Vite local** ni backend exécuté avec le frontend : le même Worker est utilisé en développement et en production.

### 2. Format des requêtes ÉcoleDirecte
* Les requêtes vers l'API sont émises en `POST` avec le payload sérialisé au format form-urlencoded : `data={"identifiant":"...","motdepasse":"..."}`.
* Les requêtes authentifiées véhiculent l'en-tête `X-Token`.

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

Le build accepte `VITE_BASE_URL` pour définir le chemin de base d'un déploiement statique. Sans cette variable, la base est `/`. Le build génère aussi `dist/sw.js`, qui précache les fichiers statiques présents dans `dist`.

### Déployer le proxy Cloudflare

Le Worker défini dans `cloudflare.js` est déployé par le workflow GitHub Actions **Deploy Cloudflare Worker**. Ce workflow est manuel : il ne s'exécute pas lors d'un push.

Dans les paramètres du dépôt GitHub, créez l'environnement `cloudflare-production`, activez une approbation obligatoire pour cet environnement, puis ajoutez ces secrets d'environnement :

* `CLOUDFLARE_API_TOKEN` : un token API Cloudflare limité au compte et au service Workers `ed-cors-proxy`, avec la permission `Workers Scripts: Edit`.
* `CLOUDFLARE_ACCOUNT_ID` : l'identifiant du compte Cloudflare `xxx`.

Pour déployer, ouvrez **Actions > Deploy Cloudflare Worker > Run workflow**. GitHub demandera l'approbation de l'environnement avant d'utiliser les secrets.

Le relais est actuellement générique et répond avec `Access-Control-Allow-Origin: *`. Il ne limite ni les origines, ni les routes, ni le débit. Cette configuration est pratique pour le fonctionnement actuel, mais elle doit être durcie avant une exposition publique plus large.

## Stockage et sécurité

* `sessionStorage.ed_session` contient le token actif, le token 2FA, GTK, les cookies réduits, l'élève sélectionné, la liste des élèves et le nom affiché.
* `localStorage.ed_user` contient uniquement l'identifiant utilisé pour préremplir le formulaire.
* `localStorage.ed_fa` contient la réponse de validation 2FA mémorisée.
* Le mot de passe reste uniquement dans l'état React pendant la session de la page et n'est pas écrit dans le stockage du navigateur.

Le Worker ne contient pas de base de données et ne persiste pas la session. La déconnexion et l'expiration de session suppriment les données de session locales. Les appels API et les réponses privées ne sont pas mis en cache par le service worker.

## Limites connues

Avant une exposition plus large du Worker, prévoir au minimum :

* une allowlist d'origines au lieu de `*` ;
* une allowlist des méthodes et routes réellement utilisées ;
* une limite de taille et de durée des requêtes ;
* un rate limiting sur la connexion et la validation 2FA ;
* l'absence de journalisation des mots de passe, tokens, cookies et corps de requêtes ;
* des tests de contrat pour les en-têtes exposés et les erreurs de l'API amont.