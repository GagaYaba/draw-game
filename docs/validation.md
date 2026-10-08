# Validation du premier lot

Ce document ne contient que des contrôles réellement exécutés sur la branche `chore/reprise-drawing-game`. Le commit applicatif vérifié sera renseigné après stabilisation du lot.

## Environnement

- Windows, PowerShell
- Node.js cible : `22.12.0`
- npm cible : `10.9.0`
- source applicative : `6af6c0fb0f4f1abdb914a63018526d71ac1dbffc`

## Contrôles exécutés

Les résultats définitifs d’installation, formatage, lint, typecheck, build, démarrage et santé seront consignés ici après la stabilisation du code.

## Recette navigateur initiale

À exécuter contre le vrai serveur avec trois sessions indépendantes : création et entrée dans le salon, prêt, partie complète de deux manches, fin, revanche, actualisation avec restauration et départ représentatif.

## Anomalies observées

- L’audit initial du lockfile historique signalait 8 vulnérabilités : 2 modérées, 4 hautes et 2 critiques. Les dépendances de production concernées étaient `engine.io`, `proxy-addr` et `qs`. Les dépendances de développement ajoutaient notamment `shell-quote` via `concurrently`.
- Traitement : mise à jour compatible des dépendances transitives, suppression des dépendances de test non reprises et remplacement de `concurrently` par un lanceur Node local sans dépendance. Un nouvel audit ne signale aucune vulnérabilité.

Les éventuelles anomalies fonctionnelles et les parcours non exécutés seront ajoutés après la recette.
