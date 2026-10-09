# Déploiement progressif : préproduction, production et retour arrière

Ce document décrit les deux environnements, la séquence de promotion, le contrôle après déploiement et la procédure de retour arrière (critères 1, 4 et 19 de `docs/bloc2.md`). Les valeurs sont celles de `render.yaml`.

## 1. Environnements

| | Préproduction | Production |
| --- | --- | --- |
| Service Render | `game-preprod` | `game-prod` |
| Branche | `develop` | `main` |
| URL | https://drawing-scale-game.onrender.com/ | attribuée par Render à la création |
| Rôle | Valider chaque fusion avec la recette avant promotion. | Version stable remise aux joueurs. |
| Déclenchement | **After CI Checks Pass** sur `develop` | **After CI Checks Pass** sur `main` |

Les deux services sont sur l'offre gratuite de Render (mise en veille après inactivité, premier chargement d'environ 23 s : `docs/performance.md`). Les heures d'instance gratuites sont partagées par l'espace de travail ; deux services qui s'endorment restent dans l'enveloppe, mais un service tenu éveillé en permanence ne le serait pas.

Un seul déclencheur de déploiement par service : Render. Aucun workflow GitHub ne déploie.

## 2. Séquence de promotion

```
branche feat/fix/... → PR vers develop → CI verte → fusion → CI du commit de fusion
  → Render déploie la préproduction → contrôle après déploiement + recette (docs/recette.md)
  → PR develop vers main (promotion stable) → CI verte → fusion
  → Render déploie la production → contrôle après déploiement
```

Règles :
- Un commit n'atteint `main` qu'après avoir été déployé et contrôlé en préproduction.
- Les PR `develop` vers `main` ne contiennent que des promotions : pas de correctif directement sur `main`. Un correctif urgent passe aussi par `develop`.
- La promotion est une décision du porteur du projet (la fusion dans `main` n'est pas couverte par l'autorisation permanente de fusion dans `develop`).

## 3. Contrôle après déploiement

```bash
node scripts/smoke-check.mjs <url> <commit attendu>
```

Le script vérifie : `/api/health` répond `ok`, le **commit servi** correspond au commit attendu (`/api/health` expose les 7 premiers caractères de `RENDER_GIT_COMMIT`, fourni par Render), la page d'accueil du client est servie, et une connexion Socket.IO répond à un ping. Il ne crée aucun salon et ne consomme donc pas les quotas par adresse. Il échoue (code 1) au premier écart.

À compléter à la main, en préproduction avant chaque promotion : le parcours de `docs/recette.md` concerné par les changements.

Preuve de la version servie : comparer le commit affiché par le script au commit de fusion dans GitHub (`git rev-parse --short origin/develop`).

## 4. Retour arrière

Déclencheurs : le contrôle après déploiement échoue, ou la recette révèle une régression.

1. Identifier le dernier déploiement sain dans **Deploys** du service concerné (son commit est indiqué).
2. Cliquer sur **Rollback** pour ce déploiement. Render redéploie l'image précédente sans reconstruire et **désactive le déploiement automatique** du service.
3. Exécuter le contrôle après déploiement avec le commit de ce déploiement : `node scripts/smoke-check.mjs <url> <commit>`.
4. Corriger par PR vers `develop` (jamais directement sur `main`), la faire passer en préproduction, puis promouvoir.
5. Réactiver le déploiement automatique sur **After CI Checks Pass** (réglage du service) et vérifier que le dernier commit est de nouveau servi.

Remarques : le retour arrière ne défait pas le code sur GitHub; il fige la version servie. Les salons en cours sont perdus au redémarrage (l'état est en mémoire); les joueurs reprennent à l'accueil.

## 5. Mise en place (une fois)

1. Fusionner la PR qui apporte ce document et `render.yaml`.
2. Promouvoir `develop` vers `main` (PR `develop` vers `main`) : `main` ne contient aujourd'hui que le commit d'amorçage, le build de production échouerait sans cela.
3. Dans Render, synchroniser le Blueprint : `game-prod` est créé sur `main` (premier déploiement en échec tant que `main` n'est pas promu, ce qui a été observé). Saisir les variables `NODE_ENV=production` et `PLAYER_RECONNECT_GRACE_MS` (comme sur `game`).
4. Vérifier le réglage **After CI Checks Pass** sur `game-prod`.
5. Lancer le contrôle après déploiement sur les deux URL et consigner les résultats ci-dessous.

## 6. Preuves d'exécution

Les lignes sont complétées après exécution observable (aucune n'est acquise tant que la commande n'a pas été lancée).

| Preuve | Date | Résultat | Statut |
| --- | --- | --- | --- |
| Contrôle après déploiement sur la préproduction | | | À faire |
| Création de `game-prod` et premier déploiement sur `main` | | | À faire |
| Contrôle après déploiement sur la production | | | À faire |
| Déploiement automatique observé sans déclenchement manuel (commit, heure) | | | À faire |
| Retour arrière exécuté sur la préproduction, puis commit servi vérifié | | | À faire |
| Réactivation du déploiement automatique après le retour arrière | | | À faire |
