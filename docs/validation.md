# Validation du premier lot

Ce document ne contient que des contrôles réellement exécutés sur la branche `chore/reprise-drawing-game`. Le code applicatif testé correspond au commit `1bb581b70a13b766a166e802a650606bd0e2b6c7`, complété par le correctif CI `5ee812811951f39ccdcf11a9137bd2b7d5552668`. Le commit suivant ne modifie que cette preuve de validation.

## Environnement

- Windows, PowerShell
- Node.js : `22.12.0`
- npm : `10.9.0`
- TypeScript : `7.0.2`
- Vite : `8.1.4`
- Biome : `2.5.15`
- Playwright : `1.64.0`
- Chromium : `156.0.8078.4`
- source applicative : `6af6c0fb0f4f1abdb914a63018526d71ac1dbffc`

## Contrôles exécutés

| Contrôle | Commande ou cible | Résultat observé |
| --- | --- | --- |
| Installation verrouillée | `npm ci` avec Node 22.12.0 et npm 10.9.0 | Réussie. |
| Formatage | `npm run format:check` | 85 fichiers vérifiés, aucune correction requise. |
| Lint | `npm run lint` | 75 fichiers applicatifs vérifiés, aucun diagnostic actif. |
| TypeScript | `npm run typecheck` | `shared`, `server` et `client` réussis ; aucune configuration de test appelée. |
| Build de production | `npm run build` | Build des trois workspaces réussi ; bundle client principal de 328,47 kB, 97,97 kB gzip. |
| Audit des dépendances | `npm audit` | 0 vulnérabilité après traitement ciblé. |
| Démarrage réel | `PORT=3100`, `NODE_ENV=production`, `npm start` | Serveur à l’écoute sur `0.0.0.0:3100`, client compilé servi avec HTTP 200. |
| Santé | `GET http://127.0.0.1:3100/api/health` | HTTP 200, `{"status":"ok","service":"drawing-game-server"}`. |

Le lint conserve les règles recommandées de Biome, avec une ligne de base explicitement désactivée pour les motifs historiques qui demandent un lot dédié : dépendances de hooks React, sémantique/accessibilité de certains composants, ordre de spécificité CSS et `!important` utilisé pour la réduction des animations. Les conversions sûres `Object.hasOwn` et `import type` ont été appliquées. Cette ligne de base ne constitue pas une preuve d’accessibilité.

## Recette navigateur initiale

Un scénario Playwright temporaire, non conservé dans le dépôt, a piloté le vrai serveur construit avec trois contextes Chromium indépendants.

Résultat final : **réussi en 37,0 secondes**.

- Alice crée un salon ; Bob et Chloe le rejoignent avec le code généré.
- Les trois joueurs se déclarent prêts et l’hôte lance la partie.
- Les six tours sont joués, soit deux manches complètes à trois joueurs.
- Chaque tour comprend le dessin vectoriel, sa confirmation, deux estimations confirmées, la révélation, les scores et la continuation par l’hôte.
- Une session non dessinatrice est rechargée pendant la première estimation. Le serveur restaure la session et le joueur poursuit la partie.
- Le classement final est affiché dans les trois sessions.
- L’hôte propose une revanche et les trois joueurs reviennent au lobby.
- Chloe quitte le lobby ; sa session revient à l’accueil et le lobby restant affiche deux joueurs.

Les deux premiers essais du scénario se sont arrêtés sur les dialogues de confirmation du dessin puis des estimations. Le scénario a été ajusté pour suivre ces étapes réelles de l’interface ; il ne s’agissait pas de défauts applicatifs.

## Anomalies observées et traitement

1. **Typecheck serveur bloqué.** `game-manager.ts` utilisait `cloneTurnScoreResult` sans import, tandis que la fonction restait privée dans `game-rules.ts`.
   - Qualification : erreur de compilation bloquante, limitée au code applicatif repris.
   - Correction : export ciblé de la fonction et import explicite dans le gestionnaire de partie.
   - Contre-test : typecheck et build complets réussis, puis partie navigateur complète réussie.
2. **Dépendances vulnérables dans le lockfile historique.** L’audit initial signalait 8 vulnérabilités : 2 modérées, 4 hautes et 2 critiques. Les dépendances de production concernées étaient `engine.io`, `proxy-addr` et `qs`. Les dépendances de développement ajoutaient notamment `shell-quote` via `concurrently`.
   - Qualification : risque de sécurité de chaîne d’approvisionnement, dont trois alertes affectaient l’arbre de production.
   - Correction : mises à jour transitives compatibles, suppression des dépendances de tests non reprises et remplacement de `concurrently` par un lanceur Node local sans dépendance.
   - Contre-test : installation, audit à 0 vulnérabilité, contrôles qualité, build, démarrage et recette réussis.
3. **Formatage non reproductible après un build.** La première commande globale de formatage incluait les répertoires `dist` une fois ceux-ci générés et rejetait leurs fichiers minifiés.
   - Qualification : défaut de ciblage du contrôle CI, sans effet sur le code exécuté.
   - Correction : chemins explicites limités aux sources et configurations suivies par Git.
   - Contre-test : `npm ci`, puis `npm run check` et `npm audit --audit-level=high` réussis avec les artefacts de build présents.

## Parcours non exécutés

- limites à quatre à huit joueurs et refus d’un neuvième joueur ;
- erreurs de saisie détaillées, doublons de pseudonyme et code de salon invalide ;
- expiration du délai de reconnexion et annulation de partie ;
- interruptions réseau répétées et reconnexion simultanée de plusieurs joueurs ;
- limites maximales du document de dessin et messages trop volumineux ;
- contrôles complets clavier, lecteur d’écran, contraste et réduction de mouvement ;
- tests structurels et de sécurité du futur cahier de recettes.

Ces parcours restent à intégrer aux lots E2E, accessibilité, sécurité et recette décrits dans `docs/bloc2.md`.
