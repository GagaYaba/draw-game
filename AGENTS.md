# Consignes durables

## Périmètre

- Ce dépôt est autonome. Ne jamais dépendre des anciens dépôts `drawing-game`, `game-backend` ou `game-frontend` pour installer, compiler, tester ou documenter le projet.
- La reprise initiale provient du commit `6af6c0fb0f4f1abdb914a63018526d71ac1dbffc`. Conserver cette traçabilité sans recopier la documentation historique.
- Ne jamais consulter, copier ni réintroduire les anciens tests, fixtures, snapshots, harnais, scripts de recette, contrôles navigateur ou smoke tests.

## Architecture et comportement

- Conserver les workspaces `client`, `server` et `shared`.
- Le serveur est autoritaire pour les règles, validations, rôles, phases, secrets et scores.
- Préserver les salons, joueurs, état prêt, lancement, deux manches, dessin vectoriel, estimations, révélation, classement, revanche, départ et restauration de session.
- Toute modification visible ou fonctionnelle doit avoir une raison explicite et rester proportionnée au lot demandé.

## Qualité

- Utiliser Node `22.12.0`, npm `10.9.0` et `npm ci`.
- Avant livraison, exécuter `npm run format:check`, `npm run lint`, `npm run typecheck` et `npm run build`.
- Ajouter des tests seulement pour un risque concret. Préférer quelques scénarios cohérents, mutualisés et paramétrés aux variantes redondantes.
- Ne jamais déclarer une preuve BLOC 2 acquise sans exécution observable. Mettre à jour `docs/validation.md` et la matrice unique `docs/bloc2.md` quand une preuve évolue.

## Git

- Partir de `develop` à jour avec un préfixe `feat/`, `fix/`, `chore/`, `docs/`, `test/` ou `refactor/`.
- Passer par une PR vers `develop`. Réserver les PR `develop` vers `main` aux promotions stables.
- Ne pas committer directement sur `main` ou `develop`, ne pas forcer les pushes et ne pas contourner les protections.
- Garder stables les contrôles requis `Quality` et `Branch policy`.
