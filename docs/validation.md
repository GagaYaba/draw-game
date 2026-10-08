# Validation des lots

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

## Lot CI/CD et autonomie du dépôt — 8 octobre 2026

La branche `chore/ci-cd-render`, créée depuis le commit de fusion `develop` `4ee04aad0d8f70eec30f138231ec60a7123039d9`, introduit la CI séparée au commit `289dcdee67adad0a9a7977afe1840fedfbdf65b0`.

### CI et protections

- PR : [#2](https://github.com/GagaYaba/draw-game/pull/2).
- Exécution CI de la PR : [37767531874](https://github.com/GagaYaba/draw-game/actions/runs/37767531874), réussie le 8 octobre 2026.
- Jobs réussis : `Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Branch policy` et synthèse `Quality`.
- Les protections de `develop` et `main` exigent ces sept contrôles, une branche à jour, une PR et la résolution des conversations. Elles s’appliquent aux administrateurs, sans approbation obligatoire, sans force-push ni suppression de branche protégée.
- Le workflow couvre désormais les PR et les pushes vers `develop` et `main`, ainsi que le déclenchement manuel.

### Clone autonome

Un clone propre de `draw-game` a été créé sous le répertoire temporaire Windows, hors de `rncp-game` et donc hors de tout dossier pouvant contenir `drawing-game`.

| Contrôle | Résultat observé |
| --- | --- |
| Liens symboliques suivis par Git | Aucun fichier de mode `120000`. |
| Dépendances de paquet externes | Aucun protocole `file:` ou `link:` ni chemin parent dans les manifests et le lockfile. |
| Runtime | Node `22.12.0`, npm `10.9.0`. |
| Installation | `npm ci` réussi, 133 paquets ajoutés, 0 vulnérabilité. |
| Formatage | 85 fichiers vérifiés, aucune correction requise. |
| Lint | 75 fichiers vérifiés, aucun diagnostic. |
| Typecheck | `shared`, `server` et `client` réussis. |
| Build | Trois workspaces réussis ; bundle client principal 328,47 kB, 97,97 kB gzip. |
| Audit | `npm audit --audit-level=high` réussi, 0 vulnérabilité. |
| Version construite | `npm start` avec `NODE_ENV=production` et un port temporaire : client HTTP 200. |
| Santé | HTTP 200, `{"status":"ok","service":"drawing-game-server"}`. |
| Socket.IO | Connexion WebSocket réelle, émission `client:ping` et réception `server:pong`. |

Une recette Playwright temporaire, non conservée dans le dépôt, a utilisé trois contextes Chromium indépendants sur ce clone. Résultat : **réussie en 34,1 secondes**.

- salon créé par Alice, rejoint par Bob et Chloe ; trois joueurs prêts et lancement par l’hôte ;
- six tours et deux manches complètes, avec l’ordre observé Chloe, Bob, Alice, Chloe, Bob, Alice ;
- dessin vectoriel, confirmation, deux estimations confirmées, révélation, scores et continuation à chaque tour ;
- session d’un votant restaurée après actualisation pendant la première estimation ;
- classement final « Victoire partagée » visible, revanche ramenant les trois sessions au lobby ;
- départ de Chloe, retour de sa session à l’accueil et lobby restant à deux joueurs.

### État public et accès Render avant fusion

L’URL `https://drawing-scale-game.onrender.com/` et `/api/health` répondent en HTTP 200. Le client servi référence les mêmes noms de bundles que le build local. Cette comparaison ne permet pas d’identifier le dépôt ni le commit réellement déployé.

Le dépôt local ne contient ni clé API Render, ni identifiant de service, ni deploy hook. Aucun navigateur connecté au compte Render n’était exposé à l’outil d’automatisation. La configuration effective du service, son commit déployé et le réglage **After CI Checks Pass** ne sont donc pas encore vérifiés indépendamment dans Render. Le lien vers `GagaYaba/draw-game` et la branche `develop` restent, à ce stade, l’état communiqué par le propriétaire du service. Aucun déploiement Render n’est déclaré exécuté dans cette section.
