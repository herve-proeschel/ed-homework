# ed-homework

Application React autonome (SPA 100 % client-side) bootstrappée avec **Vite**, packagée en **PWA / Chrome App** et déployée sur **GitHub Pages**.

Elle permet de se connecter à la plateforme **ÉcoleDirecte** (compte parent ou élève), de basculer entre les différents profils enfants rattachés, de consulter les devoirs et d'exporter ou imprimer l'intégralité du cahier de texte au format papier ou PDF.

---

## Fonctionnalités

* **Authentification directe ÉcoleDirecte :** Connexion sécurisée via l'API privée (`/v3/login.awp`) avec prise en charge du flux de validation de sécurité (MFA / 2FA).
* **Persistance de session locale :** Sauvegarde du jeton de session (`X-Token`) dans le `localStorage` ou `sessionStorage` pour éviter de se réauthentifier à chaque ouverture.
* **Support multi-profils (Comptes Famille & Élèves) :**
  * Détection automatique du type de compte (`typeCompte === "1"` pour famille).
  * Sélecteur d'enfant permettant de basculer instantanément d'un profil à un autre.
* **Consultation du cahier de texte :**
  * Vue chronologique des devoirs à venir et passés.
  * Décodage automatique du descriptif des devoirs (données Base64 + assainissement HTML).
  * Statut d'avancement (fait / à faire).
* **Export & Impression PDF instantanés :**
  * Bouton dédié **« Exporter / Imprimer PDF »** qui compile la totalité du planning des devoirs.
  * Feuille de style optimisée `@media print` avec pagination automatique A4 (`page-break-inside: avoid`), masquant les éléments d'interface parasite (barres de navigation, boutons, filtres).
  * Compatible avec le mode PWA / Chrome App (déclenchement via `window.print()` vers imprimante physique ou sortie PDF vectorielle native).

---

## Architecture & Contraintes Techniques

### 1. Hébergement sans backend & Défi CORS
L'API d'ÉcoleDirecte (`https://api.ecoledirecte.com/v3/`) ne renvoie pas les en-têtes `Access-Control-Allow-Origin` autorisant les requêtes cross-origin depuis un domaine tiers comme `https://<user>.github.io`.

Pour un fonctionnement 100 % client sur GitHub Pages :
* **En développement local :** Vite est configuré avec un proxy inverse (`vite.config.ts`) redirigeant `/api-ed` vers `https://api.ecoledirecte.com/v3`.
* **En production (GitHub Pages) :** L'application nécessite l'utilisation d'un relais CORS léger (ex. worker Cloudflare personnel ou passerelle reverse proxy) ou l'exécution dans un contexte d'extension/PWA configurée.

### 2. Format des requêtes ÉcoleDirecte
* Les requêtes vers l'API sont émises en `POST` avec le payload sérialisé au format form-urlencoded : `data={"identifiant":"...","motdepasse":"..."}`.
* Les requêtes authentifiées véhiculent l'en-tête `X-Token`.

---

## Installation & Développement local

### Prérequis
* Node.js (>= 18)
* npm ou pnpm

### Lancement

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev