# Manuel de déploiement

Ce manuel explique comment installer le jeu sur un poste de développement, le construire, le mettre en ligne sur Render et vérifier le résultat. La séquence de promotion entre préproduction et production et le retour arrière sont détaillés dans [deploiement-progressif.md](deploiement-progressif.md).

## 1. Prérequis

| Élément | Exigence | Remarque |
| --- | --- | --- |
| Système | Windows 10 ou 11, macOS ou Linux 64 bits | Le projet est développé sous Windows ; la CI tourne sous Linux. |
| Node.js | `22.12.0` (plage acceptée : `>=22.12.0 <23.0.0`) | Version consignée dans `.node-version`. |
| npm | `10.9.0` | Livré avec Node 22 ; la CI l'installe explicitement. |
| Git | Une version récente | Les fins de ligne sont figées par `.gitattributes`. |
| Navigateur de test | Chromium installé par Playwright | Seulement pour les tests E2E : `npx playwright install chromium`. |
| Espace disque | Environ 1 Go | Dépendances (`node_modules`) et navigateur de test. |
| Réseau | Accès à npm et à GitHub | Aucune base de données, aucun service tiers à configurer. |

Aucun éditeur n'est imposé. Les contrôles de qualité s'exécutent en ligne de commande et dans la CI ; un éditeur compatible TypeScript et Biome (extension officielle) donne les mêmes retours qu'en CI.

## 2. Installer et lancer en local

```bash
git clone https://github.com/GagaYaba/draw-game.git
cd draw-game
npm ci
npm run dev
```

Le client Vite écoute sur `http://localhost:5173` et relaie l'API et Socket.IO vers le serveur sur `http://localhost:3000`. Sous Windows, `start.bat` propose le même lancement par menu.

Version construite, telle qu'en production :

```bash
npm run build
npm start
```

Le serveur Express sert alors le client compilé sur `http://localhost:3000`. `GET /api/health` doit répondre `status: "ok"`.

## 3. Variables d'environnement

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port HTTP (fourni par Render) | `3000` |
| `NODE_ENV` | `production` en ligne : active la politique d'origine stricte | `development` |
| `PLAYER_RECONNECT_GRACE_MS` | Délai accordé à un joueur déconnecté avant l'annulation de la partie | `60000` |
| `MAX_ROOMS_PER_IP_PER_DAY` | Salons créables par adresse IP en 24 h (à relever sur un réseau partagé) | `5` |
| `SOCKET_ALLOWED_ORIGINS` | Origines supplémentaires autorisées, séparées par des virgules | vide (même hôte) |
| `RENDER_GIT_COMMIT` | Fourni par Render ; expose le commit servi dans `/api/health` | absent en local |

`.env.example` liste les variables. Les valeurs ne sont pas versionnées.

## 4. Contrôles avant livraison

```bash
npm run check          # formatage, lint, typecheck, build
npm run test:unit      # tests unitaires et d'intégration
npm run test:e2e       # parcours navigateur (lance le serveur construit sur le port 3480)
npm run perf:budget    # poids du client (après npm run build)
npm audit
```

La CI exécute les mêmes contrôles sur chaque PR (voir `.github/workflows/ci.yml`) : `Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Unit tests`, `E2E`, `Quality` et `Branch policy`.

## 5. Mise en ligne sur Render

La configuration est décrite dans `render.yaml` (Blueprint) :

| | `game-preprod` | `game-prod` |
| --- | --- | --- |
| Branche | `develop` | `main` |
| Offre et région | Free, Francfort | Free, Francfort |
| Build | `npm ci --include=dev && npm run build` | idem |
| Démarrage | `npm start` | idem |
| Santé | `/api/health` | idem |
| Déclenchement | **After CI Checks Pass** | **After CI Checks Pass** |

Mise en place d'un environnement neuf :

1. Dans Render, créer un Blueprint pointant vers `GagaYaba/draw-game` et sa branche de référence ; les deux services sont proposés.
2. Saisir `NODE_ENV=production` et `PLAYER_RECONNECT_GRACE_MS` pour chacun (les valeurs ne sont pas dans le dépôt).
3. Vérifier que le déclenchement est **After CI Checks Pass** : c'est le seul déclencheur, aucun workflow GitHub ne déploie.
4. Attendre l'état **Live**, puis exécuter le contrôle ci-dessous.

Tout écart entre le tableau de bord et `render.yaml` se corrige dans `render.yaml`, par PR.

## 6. Vérifier un déploiement

```bash
node scripts/smoke-check.mjs <url> <commit attendu>
```

Le script contrôle la santé, le commit servi, la page d'accueil et une connexion Socket.IO. La première requête peut attendre une vingtaine de secondes si l'instance gratuite était en veille.

## 7. Revenir en arrière

Voir la section 4 de [deploiement-progressif.md](deploiement-progressif.md) : redéployer la dernière version saine depuis **Deploys**, vérifier avec `smoke-check.mjs`, corriger par PR, puis réactiver le déploiement automatique.

## 8. Dépannage

| Symptôme | Cause probable | Action |
| --- | --- | --- |
| `npm ci` refuse de s'exécuter | Version de Node ou de npm différente | Installer Node 22.12.0 et npm 10.9.0. |
| Le client affiche « Connexion au serveur indisponible » en local | Le serveur n'est pas démarré | Utiliser `npm run dev`, qui lance client et serveur. |
| Un déploiement Render échoue | Branche sans application, build en échec | Lire les journaux de build ; `game-prod` échoue tant que `main` n'est pas promu. |
| Le premier chargement dure une vingtaine de secondes | Instance gratuite en veille | Attendre ; voir `docs/performance.md`. |
| Un réseau partagé ne peut plus créer de salon | Quota de 5 salons par adresse et par jour | Relever `MAX_ROOMS_PER_IP_PER_DAY`. |
