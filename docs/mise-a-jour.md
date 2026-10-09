# Manuel de mise à jour

Ce manuel décrit comment faire évoluer le jeu sans casser la production : changer le code, mettre à jour les dépendances, changer de version de Node, modifier une règle de jeu ou la configuration, puis promouvoir et revenir en arrière si besoin.

## 1. Règles communes

- On ne commite jamais directement sur `develop` ni sur `main`.
- Toute évolution part de `develop` à jour, sur une branche préfixée `feat/`, `fix/`, `chore/`, `docs/`, `test/` ou `refactor/`, et passe par une PR vers `develop`.
- Neuf contrôles doivent être verts avant fusion : `Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Unit tests`, `E2E`, `Quality` et `Branch policy`. Leurs noms ne changent pas : les protections de branche s'appuient dessus.
- Un test n'est ajouté que pour un risque précis ; on étend de préférence un test existant (voir `docs/recette.md`, section 5).
- Une preuve du dossier (`docs/bloc2.md`, `docs/validation.md`) ne passe à « acquise » qu'après une exécution observable.

## 2. Modifier le code

1. `git fetch && git checkout -b fix/mon-correctif origin/develop`.
2. Modifier, puis `npm run check` et `npm run test:unit` ; `npm run test:e2e` si l'interface ou le réseau changent.
3. Pousser la branche, ouvrir la PR vers `develop`, attendre les contrôles, fusionner.
4. Render déploie la **préproduction** une fois la CI du commit de fusion réussie.
5. Exécuter `node scripts/smoke-check.mjs <url préproduction> <commit>` et les scénarios de `docs/recette.md` concernés.
6. Promouvoir (section 6).

## 3. Mettre à jour les dépendances

Les versions sont figées par `package-lock.json` et la CI installe avec `npm ci`.

1. `npm outdated` pour lister les écarts, `npm audit` pour les vulnérabilités.
2. Mettre à jour une dépendance à la fois (`npm install <paquet>@<version> --save-exact` pour les paquets déjà en version exacte), ou un lot homogène.
3. Relancer `npm run check`, `npm run test:unit`, `npm run test:e2e` et `npm run perf:budget`.
4. Le job `Dependency audit` échoue sur toute vulnérabilité de niveau haut : une version corrigée est alors exigée avant fusion.
5. Pour un paquet de test ou de lint (Playwright, Biome), vérifier que l'image du job E2E dans `.github/workflows/ci.yml` correspond à la version de Playwright (`mcr.microsoft.com/playwright:v<version>-noble`).

## 4. Changer de version de Node

1. Modifier `.node-version`, `engines` de `package.json`, la plage indiquée dans `README.md` et `docs/deploiement.md`.
2. Vérifier que la CI utilise la nouvelle version (elle lit `.node-version`).
3. Vérifier le runtime Render : il suit `.node-version`.
4. Rejouer l'ensemble des contrôles et la recette en préproduction avant promotion.

## 5. Modifier une règle de jeu ou un contrat

Le serveur est l'autorité des règles ; les contrats communs sont dans `shared/`.

1. Modifier d'abord `shared/src` (types, événements) puis le serveur, puis le client.
2. Mettre à jour `docs/recette.md` : règles (section 2 bis), user stories concernées et scénarios.
3. Adapter le test existant qui couvre la règle (par exemple `server/test/game.test.ts` pour le barème) plutôt que d'en créer un nouveau.
4. Un changement de contrat Socket.IO rend l'ancien client incompatible : les joueurs connectés doivent recharger la page. Prévoir le déploiement hors d'une partie en cours.

## 6. Promouvoir en production

1. Constater que la préproduction est saine et que la recette concernée est réussie.
2. Ouvrir une PR `develop` vers `main` ; seuls les commits déjà éprouvés en préproduction y figurent.
3. Après la fusion (décision du porteur du projet), Render déploie `game-prod`.
4. Exécuter `node scripts/smoke-check.mjs <url production> <commit>` et consigner le résultat dans `docs/deploiement-progressif.md`.

## 7. Revenir en arrière

Voir `docs/deploiement-progressif.md`, section 4. Si le retour arrière est motivé par une régression, ouvrir une PR de correction vers `develop`, la valider en préproduction, puis promouvoir ; réactiver ensuite le déploiement automatique sur **After CI Checks Pass**.

## 8. Variables et configuration Render

- Une variable d'environnement se change dans le tableau de bord du service concerné, puis se redéploie. Les noms attendus sont dans `docs/deploiement.md`.
- Toute modification de `render.yaml` suit le circuit d'une PR ; le Blueprint est ensuite synchronisé dans Render.
- Ne jamais ajouter un second déclencheur de déploiement (workflow GitHub, hook) en plus de **After CI Checks Pass**.

## 9. Vérifier après une mise à jour

| Contrôle | Commande ou lieu |
| --- | --- |
| Santé et commit servi | `node scripts/smoke-check.mjs <url> <commit>` |
| Poids du client | `npm run perf:budget` (aussi exécuté en CI) |
| Charge | `npm run perf:load -- <url locale> 20` (en local seulement) |
| Accessibilité | `npm run test:e2e` (`e2e/accessibility.spec.ts`) |
| Journal de sécurité | Journaux Render : lignes JSON `"level":"security"`, adresses masquées |
