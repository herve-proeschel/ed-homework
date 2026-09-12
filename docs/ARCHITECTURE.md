 # Architecture d'infrastructure

 ## 1. Périmètre et état du projet

 Cette application est une SPA React statique. Le frontend peut être publié sur
 GitHub Pages, mais le navigateur ne peut pas appeler directement l'API privée
 d'ÉcoleDirecte : l'API ne fournit pas les en-têtes CORS nécessaires pour une
 origine GitHub Pages.

 Le dépôt contient aujourd'hui le squelette Vite et la documentation du flux
 ÉcoleDirecte. Le Worker décrit ci-dessous est l'architecture cible à mettre en
 place lorsque le client API sera implémenté. Il ne faut pas considérer ce
 relais comme déjà déployé simplement parce qu'il est documenté ici.

 ## 2. Architecture cible

 ```mermaid
 flowchart LR
		 U[Utilisateur] -->|HTTPS| P[GitHub Pages\nSPA React / fichiers statiques]
		 P -->|HTTPS + CORS contrôlé| W[Cloudflare Worker\nAPI façade]
		 W -->|HTTPS POST\nrequêtes autorisées| E[ÉcoleDirecte API\napi.ecoledirecte.com/v3]

		 W -.-> RL[Rate limiting\npar IP + route]
		 W -.-> O[Logs minimisés\nAnalytics / Workers Logs]
		 W -.-> S[Secrets / variables\nCloudflare]
 ```

 ### Responsabilité des composants

 | Composant | Responsabilité | Ne doit pas faire |
 | --- | --- | --- |
 | GitHub Pages | Servir le bundle React, les assets et le manifeste PWA | Contenir un secret, stocker un mot de passe ou appeler directement ÉcoleDirecte |
 | Navigateur | Collecter les identifiants, conserver éventuellement le jeton de session et afficher les données | Faire confiance à une origine arbitraire ou exposer le jeton dans une URL |
 | Cloudflare Worker | Vérifier l'origine, filtrer les routes, relayer les requêtes, gérer CORS et les erreurs | Persister les identifiants, mettre en cache les réponses privées ou devenir un proxy ouvert |
 | ÉcoleDirecte | Authentifier l'utilisateur et fournir les données du compte | Être appelée depuis le navigateur sans relais CORS |

 Le Worker n'est pas un serveur applicatif classique et ne nécessite pas de
 base de données pour ce cas d'usage. Cette absence de persistance réduit la
 surface d'exposition : les identifiants et le `X-Token` transitent pendant la
 requête, mais ne sont pas enregistrés par le Worker.

 ## 3. Flux de production

 ### 3.1 Chargement de l'application et appel API

 ```mermaid
 sequenceDiagram
		 autonumber
		 participant B as Navigateur
		 participant G as GitHub Pages
		 participant W as Cloudflare Worker
		 participant E as API ÉcoleDirecte

		 B->>G: GET /ed-homework/
		 G-->>B: index.html + bundle React
		 B->>W: OPTIONS /login.awp\nOrigin: https://<user>.github.io
		 W-->>B: CORS autorisé + méthodes/en-têtes autorisés
		 B->>W: POST /login.awp\nContent-Type: application/x-www-form-urlencoded
		 W->>E: POST /v3/login.awp\nBody data=...
		 E-->>W: Réponse d'authentification
		 W-->>B: Réponse relayée\nAccess-Control-Allow-Origin exact
		 B->>W: POST /eleves/...\nX-Token: <token>
		 W->>E: POST /v3/eleves/...\nX-Token: <token>
		 E-->>W: Données du cahier de texte
		 W-->>B: Données JSON sans mise en cache
 ```

 Le Worker doit relayer le corps `application/x-www-form-urlencoded` sans le
 transformer. Le payload attendu par ÉcoleDirecte est de la forme :

 ```text
 data={"identifiant":"...","motdepasse":"..."}
 ```

 Pour les appels authentifiés, le Worker transmet `X-Token` vers l'API amont.
 Le token reste dans un en-tête et ne doit jamais être ajouté à la query string,
 à une URL de redirection ou à un message de log.

 ### 3.2 Flux MFA / 2FA

 ```mermaid
 sequenceDiagram
		 participant U as Utilisateur
		 participant A as SPA
		 participant W as Worker
		 participant E as ÉcoleDirecte

		 U->>A: Saisie identifiant + mot de passe
		 A->>W: POST /login.awp
		 W->>E: Relai de la demande
		 E-->>W: Succès ou demande de validation MFA
		 W-->>A: Réponse sans modification métier
		 A-->>U: Demande de code / validation
		 U->>A: Saisie du code MFA
		 A->>W: POST route MFA prévue par l'API
		 W->>E: Relai avec le contexte requis
		 E-->>W: X-Token et profil, ou erreur
		 W-->>A: Résultat d'authentification
 ```

 Le Worker doit rester transparent pour les statuts et le format de réponse
 nécessaires au MFA. La logique d'interface et l'état temporaire du parcours
 restent dans la SPA, sauf exigence contraire de l'API ÉcoleDirecte.

 ## 4. Routage du Worker

 Une URL dédiée est préférable à un proxy générique, par exemple :

 ```text
 https://api.example.fr/ecoledirecte/*
 ```

 ou, pour un premier déploiement :

 ```text
 https://ed-homework-api.<account>.workers.dev/*
 ```

 Le Worker ajoute le préfixe `/v3` côté amont et ne rend publiques que les
 routes réellement utilisées par l'application. Exemple de table de routage :

 | Route publique | Méthode | Route amont | Cache |
 | --- | --- | --- | --- |
 | `/login.awp` | `POST` | `/v3/login.awp` | Interdit |
 | `/auth/*` | `POST` | `/v3/auth/*` | Interdit |
 | `/eleves/*` | `POST` | `/v3/eleves/*` | Interdit |
 | Toute autre route | Toutes | Refus `404` ou `405` | N/A |

 Cette liste doit être adaptée aux routes réellement consommées par le client.
 Il ne faut pas accepter une URL amont fournie par l'utilisateur : sinon le
 Worker devient un open proxy exploitable pour contourner des contrôles ou
 générer du trafic vers des tiers.

 ## 5. CORS et contrôle des origines

 Le Worker doit comparer l'en-tête `Origin` à une allowlist exacte :

 ```text
 https://<user>.github.io
 https://www.example.fr             # seulement si un domaine custom existe
 http://localhost:5173              # développement local uniquement
 ```

 Règles recommandées :

 * répondre à `OPTIONS` avec `204` pour le préflight ;
 * renvoyer `Access-Control-Allow-Origin` uniquement avec l'origine validée ;
 * renvoyer `Access-Control-Allow-Methods: POST, OPTIONS` ;
 * renvoyer `Access-Control-Allow-Headers: Content-Type, X-Token` ;
 * ajouter `Vary: Origin` ;
 * ne pas utiliser `Access-Control-Allow-Origin: *` avec des données de session ;
 * refuser les origines absentes ou inconnues pour les routes API.

 Le CORS n'est pas une authentification. Il empêche principalement un site
 tiers de lire les réponses dans le navigateur ; il faut donc le compléter par
 des limites de débit et par un filtrage strict des routes.

 ## 6. Sécurité et confidentialité

 ### Données sensibles

 * Le mot de passe est envoyé uniquement sur une requête HTTPS vers le Worker,
	 puis relayé vers ÉcoleDirecte.
 * Le Worker ne l'écrit ni dans KV, ni dans D1, ni dans R2, ni dans un log.
 * Le frontend peut conserver le `X-Token` en mémoire. Si une persistance est
	 nécessaire, `sessionStorage` est préférable à `localStorage` pour réduire sa
	 durée de vie ; dans les deux cas, une compromission XSS pourrait le lire.
 * Les messages d'erreur côté client doivent être utiles sans refléter le corps
	 complet de la requête ni les en-têtes d'authentification.

 ### Mesures Worker

 1. Autoriser uniquement `POST` et `OPTIONS` sur les routes connues.
 2. Limiter la taille du corps entrant et le délai amont.
 3. Appliquer un rate limit plus strict sur la connexion et le MFA que sur la
		consultation du cahier de texte.
 4. Ne jamais activer le cache Cloudflare sur les réponses contenant des données
		ou des tokens.
 5. Supprimer les en-têtes hop-by-hop et ne recopier depuis l'amont que les
		en-têtes nécessaires.
 6. Ne pas journaliser `data`, `X-Token`, les cookies ou les réponses complètes.
 7. Ajouter des alertes sur les pics de `401`, `403`, `429` et `5xx`.

 ### Limite importante

 Un Worker public ne peut pas empêcher un utilisateur de reproduire les appels
 avec son propre compte. Le relais protège le navigateur contre le problème
 CORS et réduit l'exposition, mais il ne constitue pas un coffre-fort pour les
 identifiants. La confiance métier reste celle d'ÉcoleDirecte.

 ## 7. Développement local

 En local, deux modèles sont possibles :

 ```mermaid
 flowchart TD
		 D[SPA Vite localhost:5173]
		 D -->|/api-ed/*| V[Vite dev proxy]
		 V --> E[API ÉcoleDirecte]

		 D2[SPA Vite localhost:5173]
		 D2 -->|HTTPS| W[Worker Cloudflare de dev]
		 W --> E
 ```

 Le second modèle est le plus fidèle à la production. Il évite qu'un bug de
 proxy Vite masque un problème du Worker. Si le proxy Vite est conservé, sa
 cible et ses règles doivent rester documentées et ne doivent pas être
 utilisées comme solution de production.

 ## 8. Déploiement Cloudflare

 Le Worker peut être déployé avec Wrangler. Exemple minimal de configuration :

 ```toml
 name = "ed-homework-api"
 main = "src/worker.js"
 compatibility_date = "2026-09-12"

 [vars]
 UPSTREAM_ORIGIN = "https://api.ecoledirecte.com"
 ```

 L'allowlist d'origines et les paramètres non secrets peuvent être des variables
 d'environnement par environnement (`dev`, `staging`, `production`). Aucun mot
 de passe ÉcoleDirecte ne doit être placé dans `wrangler.toml`, GitHub Actions
 ou le dépôt. Si un secret devient nécessaire, il doit être fourni par
 `wrangler secret put` et lu uniquement côté Worker.

 Pipeline recommandé :

 ```mermaid
 flowchart LR
		 C[Commit] --> CI[GitHub Actions]
		 CI --> T[Tests + lint + build SPA]
		 T --> PG[Déploiement GitHub Pages]
		 T --> WD[wrangler deploy]
		 WD --> CF[Cloudflare Worker production]
 ```

 Le déploiement du frontend et celui du Worker peuvent évoluer séparément. Il
 faut toutefois versionner ensemble le contrat de routes publiques et le client
 API afin d'éviter de publier une SPA qui appelle une route absente du Worker.

 ## 9. Observabilité et exploitation

 Les logs doivent être corrélables sans être sensibles. Un identifiant de
 requête aléatoire peut être généré par le Worker et renvoyé dans
 `X-Request-Id`; il ne doit pas contenir le token ou l'identité de l'utilisateur.

 À surveiller :

 * latence Worker -> ÉcoleDirecte ;
 * taux de réponses `401`, `403`, `429` et `5xx` ;
 * erreurs CORS et préflights ;
 * volume par route et par adresse IP ;
 * indisponibilité ou changement de contrat de l'API amont.

 Les réponses privées ne doivent pas être placées dans le cache HTTP. Les
 éventuels retries doivent être très prudents : une nouvelle tentative de login
 ou de MFA peut répéter une opération sensible. Par défaut, ne pas retry les
 `POST` d'authentification.

 ## 10. Checklist de mise en production

 - [ ] Déployer le Worker avec une URL HTTPS stable.
 - [ ] Configurer l'allowlist CORS sur les origines réelles uniquement.
 - [ ] Implémenter la liste blanche des routes et méthodes.
 - [ ] Vérifier le relais du `Content-Type`, du corps `data=...` et de `X-Token`.
 - [ ] Désactiver le cache sur toutes les réponses API.
 - [ ] Ajouter les limites de taille, de délai et de débit.
 - [ ] Vérifier qu'aucun log ne contient mot de passe, payload ou token.
 - [ ] Tester login, MFA, changement de profil et expiration de session.
 - [ ] Tester depuis le domaine GitHub Pages réel, pas uniquement depuis localhost.
 - [ ] Prévoir une procédure de révocation/changement si ÉcoleDirecte modifie son API.
