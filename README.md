# Drawing Game

SERVEUR EN LIGNE : https://drawing-scale-game.onrender.com/

Drawing Game est un jeu multijoueur en temps réel. Trois à huit joueurs rejoignent un salon, se déclarent prêts, dessinent selon un niveau secret, estiment les dessins, découvrent les résultats et enchaînent deux manches avant le classement final et une éventuelle revanche.

Ce dépôt reprend sélectivement l’application du commit historique `6af6c0fb0f4f1abdb914a63018526d71ac1dbffc` de `GagaYaba/drawing-game`. Le code applicatif, les ressources visuelles et les configurations nécessaires ont été importés. Les anciens tests, scripts de recette, artefacts, documents et workflows de déploiement ne l’ont pas été.

## Prérequis

- Node.js `22.12.0` (la plage supportée reste `>=22.12.0 <23.0.0`)
- npm `10.9.0`

Les versions sont consignées dans `.node-version`, `package.json` et `package-lock.json`. Utilisez `npm ci` pour une installation identique à la CI.

## Démarrage

```bash
npm ci
npm run dev
```

Le client Vite écoute sur `http://localhost:5173` et relaie l’API et Socket.IO vers le serveur sur `http://localhost:3000`.

Pour exécuter la version construite :

```bash
npm run build
npm start
```

Le serveur Express sert alors le client compilé. La route de santé est `GET /api/health` et doit répondre avec `status: "ok"` et `service: "drawing-game-server"`.

Variables disponibles :

- `PORT`, port HTTP du serveur, `3000` par défaut ;
- `PLAYER_RECONNECT_GRACE_MS`, délai de reconnexion, `60000` ms par défaut ;
- `MAX_ROOMS_PER_IP_PER_DAY`, nombre de salons qu'une adresse IP peut créer en 24 heures, `5` par défaut (à relever pour un réseau partagé) ;
- `NODE_ENV`, environnement Node ;
- `SOCKET_ALLOWED_ORIGINS`, liste facultative d'origines HTTP(S) séparées par des virgules si le client est servi depuis un autre domaine de confiance. Les connexions navigateur de même hôte sont autorisées par défaut.

## Contrôles

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run check
npm audit
```

Le typecheck couvre uniquement le code applicatif de `client`, `server` et `shared`. Les nouvelles suites unitaires et E2E seront ajoutées dans les lots prévus par [docs/bloc2.md](docs/bloc2.md), sans reprendre les anciens tests.

## Architecture

- `client/` : interface React 19 et Vite, dessin vectoriel, état de session et écrans de jeu ;
- `server/` : serveur Node/Express/Socket.IO, salons, règles, validation, secrets, scores et restauration ;
- `shared/` : contrats TypeScript, événements Socket.IO et modèle du dessin ;
- `docs/` : cadrage BLOC 2, source d’évaluation et preuves de validation ;
- `scripts/dev.mjs` : lancement multiplateforme des trois workspaces en développement.

Le serveur reste l’autorité pour les règles, les rôles, les phases, les secrets, les validations et les scores. Le client n’expose que l’état public et le secret destiné au dessinateur courant.

## Workflow Git

L’amorçage exceptionnel du dépôt a créé `main` et `develop` sur le même commit minimal `a02b14b`. Aucun autre commit direct sur ces branches n’est autorisé.

- une branche de travail part de `develop` à jour ;
- les préfixes admis sont `feat/`, `fix/`, `chore/`, `docs/`, `test/` et `refactor/` ;
- une PR de travail cible `develop` ;
- une livraison stable passe uniquement par une PR `develop` vers `main` ;
- les contrôles requis sont `Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Quality` et `Branch policy` ;
- la branche doit être à jour, les conversations résolues et les protections s’appliquent aussi aux administrateurs ;
- aucune approbation d’un second contributeur n’est requise pour ce projet individuel.

Le workflow unique `.github/workflows/ci.yml` s’exécute sur les PR et les pushes vers `develop` et `main`, ainsi que manuellement. Chaque contrôle applicatif utilise Node `22.12.0`, npm `10.9.0`, le lockfile et `npm ci`. `Quality` synthétise les cinq contrôles applicatifs et échoue si l’un d’eux échoue, est annulé ou est ignoré.

## Déploiement Render sur `develop`

Pendant ce lot, le service existant qui conserve l’URL publique reste lié à `GagaYaba/draw-game`, branche `develop`. La promotion vers `main` est différée et `main` reste sur son commit d’amorçage.

Configuration attendue pour le monorepo :

- répertoire racine vide, afin que les workspaces `client`, `server` et `shared` restent accessibles ;
- runtime Node défini par `.node-version`, soit `22.12.0` ;
- commande de build : `npm ci && npm run build` ;
- commande de démarrage : `npm start` ;
- health check : `/api/health` ;
- `PORT` fourni par Render, `NODE_ENV=production` et `PLAYER_RECONNECT_GRACE_MS` facultatif ;
- déploiement automatique unique : Render, réglé sur **After CI Checks Pass**. Aucun second workflow GitHub ne déclenche le même déploiement.

Après chaque fusion dans `develop`, la CI doit réussir sur le commit de fusion avant que Render ne le déploie. La vérification post-déploiement couvre la santé HTTP, Socket.IO et une partie navigateur complète. Pour revenir en arrière, utiliser l’historique **Deploys** du service afin de redéployer la dernière version réussie, puis vérifier `/api/health` et Socket.IO. Render désactive le déploiement automatique après un rollback ; le réactiver sur **After CI Checks Pass** une fois l’incident traité.
