# Décisions structurantes

Ce document consigne les choix techniques et de conception, les alternatives écartées et leurs raisons (critère 26 de `docs/bloc2.md`). Une décision reprise du dépôt historique est indiquée comme telle : sa raison n'est donnée que lorsqu'elle est établie par le code ou les mesures du projet. Pour revenir sur une décision, ouvrir une PR qui modifie la ligne concernée.

## 1. Technologies

| Sujet | Choix | Alternatives | Raison et conséquences |
| --- | --- | --- | --- |
| Langage | TypeScript strict sur tout le dépôt | JavaScript | Les contrats client-serveur sont partagés : une erreur de type est détectée avant l'exécution (`Typecheck` en CI). Repris du dépôt historique. |
| Organisation | Monorepo npm à trois workspaces : `client`, `server`, `shared` | Dépôts séparés | `shared/` porte les types et les événements communs aux deux côtés ; une seule PR et une seule CI. Repris du dépôt historique. |
| Client | React 19 et Vite | Autres bibliothèques d'interface | Repris du dépôt historique. Poids mesuré : 95 Ko de JavaScript compressé (`docs/performance.md`). |
| Serveur | Node, Express 5 et Socket.IO | Serveur WebSocket brut | Socket.IO apporte salles, accusés de réception et reconnexion ; Express sert le client construit et `/api/health`. Repris du dépôt historique. |
| Dessin | Document vectoriel (traits, outils, couleurs) envoyé tel quel | Image bitmap | Taille bornée et validable côté serveur (250 traits, 300 points par trait), rendu identique pour tous, restauration après actualisation. |
| Qualité du code | Biome (formatage, lint, règles d'accessibilité en erreur) | ESLint et Prettier | Repris du dépôt historique. Un seul outil pour le formatage et le lint ; les règles d'accessibilité sont en erreur et bloquent la CI. |
| Tests unitaires | `node:test` avec `tsx`, couverture `c8` | Jest, Vitest | Aucun framework supplémentaire : le lanceur de Node suffit aux tests serveur, aux règles et au rendu côté serveur des écrans. |
| Tests E2E | Playwright (Chromium), `@axe-core/playwright` | Cypress, Selenium | Plusieurs contextes de navigateur indépendants dans un test (un par joueur), émulation de téléphone, image officielle pour la CI. |
| Hébergement | Render, offre gratuite, Francfort | Autres hébergeurs, offre payante | Déploiement lié à GitHub après CI, coût nul. Conséquence mesurée : mise en veille et premier chargement d'environ 23 s. |
| Compression | Aucune dans l'application | Middleware `compression` | Render compresse déjà le JavaScript en Brotli (mesuré en ligne). |

## 2. Règles de jeu et état

| Sujet | Choix | Alternatives | Raison et conséquences |
| --- | --- | --- | --- |
| Autorité | Le serveur décide des règles, rôles, phases, secrets et scores | Logique côté client | Équité : aucun niveau secret n'est publié avant la révélation (test de non-fuite). |
| Déroulement | Tous dessinent en même temps, avec une consigne et un niveau secret par joueur, puis présentation et estimation un dessin à la fois | Un dessinateur par tour | Décision du porteur du projet du 9 octobre 2026 : moins d'attente, chaque joueur dessine à chaque manche. |
| Barème | 2 points (exact), 1 point (écart de 1), 0 sinon ; l'auteur reçoit la moyenne arrondie des points de ses votants | Barème plus fin | Décision du porteur : lisible en un coup d'œil. |
| Minuteur | Aucun sur le dessin ni sur la manche | Minuteur par manche | Décision du porteur : le jeu reste détendu ; seule la déconnexion est limitée à 60 s. |
| Taille des groupes | 2 à 6 joueurs, deux manches | Plus de joueurs | Décision du porteur du projet (9 octobre 2026). La charge de 20 salons de 6 joueurs a été mesurée sans échec. |
| État des parties | En mémoire dans le processus serveur | Base de données, Redis | Instance unique, parties courtes, aucun compte : pas de coût d'infrastructure. Conséquence : un redémarrage du serveur efface les parties (écart RC27 de `docs/recette.md`). |
| Échelle visée | 20 salons de 6 joueurs en simultané sur l'instance gratuite | Plusieurs instances | Charge mesurée sans échec (`docs/performance.md`) ; au-delà, il faudrait un état partagé entre instances. |

## 3. Sécurité

| Sujet | Choix | Alternatives | Raison et conséquences |
| --- | --- | --- | --- |
| Limites de débit | Seaux à jetons et fenêtres écrits dans `server/src/security/` | Bibliothèque de limitation | Les mêmes primitives couvrent HTTP, événements Socket.IO, connexions, échecs d'accès et salons par adresse ; testées directement. |
| Adresse du client | Dernière entrée de `X-Forwarded-For` | Première entrée | Render ajoute l'adresse réelle en fin de liste ; la première est contrôlable par le client. |
| Aléa | Générateur cryptographique (`randomInt`) pour niveaux secrets, mélange et consignes | `Math.random` | Les niveaux secrets ne doivent pas être prévisibles (audit OWASP, `docs/securite.md`). |
| Origines WebSocket | Même hôte par défaut, origines supplémentaires explicites | Origines libres | Un site tiers ne doit pas piloter le serveur depuis le navigateur d'un joueur. |
| Journal | Événements de sécurité en JSON, adresse masquée | Journal complet des adresses | Détecter les abus sans conserver de donnée personnelle exploitable. |

## 4. Qualité et exploitation

| Sujet | Choix | Alternatives | Raison et conséquences |
| --- | --- | --- | --- |
| Tests | Peu de tests, regroupés par risque ; chaque test est justifié dans `docs/recette.md` | Couverture maximale | Décision du porteur : le strict minimum que l'on puisse justifier. Couverture d'environ 75 % sur un périmètre explicite (`docs/recette.md`, section 5 bis). |
| Accessibilité | RGAA 4.1 niveau AA, sur la base de WCAG 2.1 AA | OPQUAST, WCAG 2.2 | Référentiel français en vigueur ; OPQUAST est un recueil de bonnes pratiques, pas un référentiel de conformité. Version à vérifier avant toute déclaration publique. |
| Contraste | Mesure sur captures dans `e2e/contrast.ts` en plus d'axe-core | Axe-core seul | Axe-core ne décide pas sur les dégradés et pseudo-éléments ; la mesure maison est validée par mutation. |
| Branches | `develop` (préproduction), `main` (production), PR obligatoires, neuf contrôles requis | Livraison continue sur `main` | Chaque commit est éprouvé avant production ; retour arrière documenté. |
| Déploiement | Un seul déclencheur par service : **After CI Checks Pass** | Workflow GitHub de déploiement | Évite un double déploiement et garantit que la CI a réussi. |
| Budgets de performance | Poids du client contrôlé en CI ; charge et Lighthouse mesurés à la main | Tout en CI | La charge et Lighthouse dépendent de la machine et rendraient la CI instable. |

## 5. Décisions ouvertes

| Sujet | Position actuelle | Qui décide |
| --- | --- | --- |
| Mise en veille de Render (23 s) | Acceptée pour l'instant | Porteur du projet : plan payant ou appel périodique. |
| Message « Votre place est conservée » après redémarrage du serveur | Inchangé | Porteur du projet, selon les retours des testeurs. |
| Dessin au clavier | Non-conformité déclarée | À réévaluer si un besoin d'accès est exprimé. |
| Images en WebP et découpage du JavaScript | Non traités | À traiter si les testeurs signalent une lenteur. |
