# Besoins, user stories et cahier de recettes

Ce document est la source unique des besoins, des user stories et des scénarios de recette (critères 9, 10, 20 et 21 de `docs/bloc2.md`). Les résultats d'exécution détaillés restent dans `docs/validation.md`.

Statut du document : les besoins et les user stories sont rédigés à partir du comportement du jeu existant, faute de cahier des charges préalable. Ils sont **à valider par le porteur du projet**. Aucun scénario manuel n'est exécuté à ce jour.

## 1. Besoins

| Réf. | Besoin |
| --- | --- |
| B1 | Jouer en ligne à un jeu de dessin et d'estimation, de 2 à 6 joueurs, sans créer de compte. |
| B2 | Rejoindre une partie par un code de salon ou un lien d'invitation. |
| B3 | Jouer sur tout appareil : ordinateur (souris), tablette et téléphone (tactile). |
| B4 | Jouer deux manches : à chaque manche tous dessinent en même temps, puis les dessins sont présentés et estimés un par un ; classement final et revanche. |
| B5 | Retrouver sa place après une actualisation ou une coupure brève. |
| B6 | Garantir l'équité : le serveur décide des rôles, des phases, des secrets et des scores. |
| B7 | Résister aux abus courants (inondation de requêtes, création massive de salons, devinette de codes). |
| B8 | Rester accessible à des personnes en situation de handicap (cible : RGAA 4.1, niveau AA). |

## 2. User stories

Format : « En tant que … je veux … afin de … ».

### Salon

| Réf. | Besoin | User story |
| --- | --- | --- |
| US01 | B1, B2 | En tant que joueur, je crée un salon avec un pseudonyme afin d'obtenir un code à partager. |
| US02 | B2 | En tant que joueur, je rejoins un salon avec un code ou un lien d'invitation afin de jouer avec mon groupe. |
| US03 | B1 | En tant que joueur, je saisis un pseudonyme de 2 à 20 caractères, unique dans le salon, afin d'être reconnu des autres. |
| US04 | B1 | En tant que joueur, je vois la liste des joueurs, leur état prêt et leur connexion afin de savoir quand démarrer. |
| US05 | B1 | En tant que joueur, j'indique que je suis prêt ou non afin de signaler ma disponibilité. |
| US06 | B1, B6 | En tant qu'hôte, je lance la partie lorsque 2 à 6 joueurs connectés sont prêts. |
| US07 | B1 | En tant que joueur, je quitte le salon afin de ne plus participer. |

### Partie

| Réf. | Besoin | User story |
| --- | --- | --- |
| US08 | B4, B6 | En tant que joueur, je vois l'introduction de la manche et je reçois ma propre consigne et mon propre niveau secret. |
| US09 | B3, B4, B6 | En tant que joueur, je dessine ma consigne en même temps que les autres, avec un stylo, une gomme, un pot de peinture, des couleurs et des épaisseurs, avec annuler et tout effacer ; je suis le seul à connaître mon niveau. |
| US10 | B4 | En tant que joueur, je valide mon dessin après confirmation, puis j'attends que tous aient validé le leur, avec l'avancement affiché. |
| US11 | B4, B6 | En tant que votant, je vois les dessins un par un et j'estime un niveau de 1 à 10, avec confirmation, une seule fois par dessin. |
| US12 | B6 | En tant qu'auteur, je ne peux pas voter pour mon propre dessin. |
| US13 | B4 | En tant que joueur, je vois après chaque dessin le niveau secret, chaque estimation, les points gagnés et le classement. |
| US14 | B4 | En tant qu'hôte, je passe au dessin suivant, à la manche suivante, puis au classement final. |
| US15 | B4 | En tant que groupe, nous jouons deux manches : à chacune, chaque joueur dessine une fois et chaque dessin est présenté une fois. |
| US16 | B4 | En tant que joueur, je vois le classement final et les vainqueurs, y compris en cas d'égalité. |
| US17 | B4 | En tant qu'hôte, je propose une revanche qui ramène tout le monde au salon. |

### Continuité

| Réf. | Besoin | User story |
| --- | --- | --- |
| US18 | B5 | En tant que joueur, j'actualise la page et je retrouve ma place, mon dessin en cours et mon estimation. |
| US19 | B5 | En tant que joueur, une coupure brève est signalée et je reprends ma place dans le délai de reconnexion. |
| US20 | B5, B6 | En tant que groupe, si un joueur ne revient pas dans le délai, il est retiré et la partie en cours est annulée avec un message clair. |
| US21 | B5, B6 | En tant que groupe, le départ d'un joueur annule la partie en cours et l'hôte est transféré si besoin. |
| US22 | B6 | En tant que joueur, ma session ne peut être active que dans un seul onglet à la fois. |

### Protection, appareils et accessibilité

| Réf. | Besoin | User story |
| --- | --- | --- |
| US23 | B6 | En tant que groupe, les actions interdites (non-hôte, non-dessinateur, mauvaise phase, doublon, tour périmé) sont refusées avec un message. |
| US24 | B7 | En tant qu'exploitant, les abus sont limités (requêtes, événements, connexions, salons par jour, échecs d'accès, salons inactifs). |
| US25 | B3 | En tant que joueur, j'utilise le jeu sur ordinateur, tablette ou téléphone, à la souris ou au doigt. |
| US26 | B8 | En tant que joueur en situation de handicap, je joue au clavier et avec un lecteur d'écran, avec des contrastes suffisants. |
| US27 | B2, B6 | En tant que joueur, je suis informé clairement lorsque le serveur est indisponible ou lorsqu'une erreur survient. |

## 2 bis. Règles du jeu retenues

Décisions du porteur du projet (9 octobre 2026), qui remplacent le principe d'un dessinateur par tour :

- À chaque manche, **tous les joueurs dessinent en même temps**, chacun avec **sa propre consigne et son propre niveau secret**.
- Quand tous ont validé leur dessin, les dessins sont **présentés un par un**, dans un ordre mélangé. Les autres joueurs estiment le niveau ; la révélation a lieu **après chaque dessin**.
- **Barème** : un votant gagne 2 points pour une estimation exacte, 1 point pour un écart de 1, sinon 0. L'auteur gagne la moyenne arrondie des points de ses votants (0, 1 ou 2).
- **Aucun minuteur** ne limite le dessin ni la manche. Un joueur déconnecté plus de 60 secondes annule la partie, comme auparavant.
- Deux manches ; salons de 2 à 6 joueurs.

## 3. Plan de test

| Type | Objet | Moyens | Critère de réussite |
| --- | --- | --- | --- |
| Fonctionnel | Parcours des user stories | E2E Playwright (`e2e/`), recette manuelle | Résultat attendu observé, aucune erreur de page ni de console |
| Structurel | Règles, validations, quotas, sessions | Tests unitaires (`server/test`), couverture, CI (`Formatting`, `Lint`, `Typecheck`, `Build`) | Tests réussis ; couverture mesurée sur un périmètre explicite |
| Sécurité | Autorisations, quotas, en-têtes, origine, dépendances | Tests unitaires et E2E, `Dependency audit`, audit OWASP (`docs/securite.md`) | Refus attendus observés, 0 vulnérabilité haute |
| Accessibilité et appareils | Clavier, lecteur d'écran, contrastes, mobile et tablette | Contrôle automatique, essais manuels, appareils réels | Critères du référentiel retenu respectés ou limites documentées |
| Déploiement | Santé, déclenchement automatique, retour arrière | Vérification Render | Santé 200, déploiement sans clic manuel, rollback exécuté |

Règle d'exécution : chaque exécution consigne la version de l'application (commit), l'environnement, la date et le résultat dans `docs/validation.md`. Tout échec est qualifié (défaut, risque, amélioration, décision) avant correction.

## 4. Cahier de recettes

Colonne « Moyen » : *E2E* et *Unitaire* renvoient à un test permanent existant ; *À automatiser* indique un test prévu (étape du plan entre parenthèses) ; *Manuel* indique un essai à exécuter à la main. Colonne « Résultat » : « Réussi en CI » signifie que le test permanent a réussi sur la CI de la PR #14 (9 octobre 2026) ; « Réussi (local) » signifie que le test a réussi sous Node 22.12.0 sur le poste de développement, sa CI restant à confirmer ; « Non exécuté » signifie qu'aucun résultat n'est consigné.

### Salon

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC01 | US01, US02, US04, US05, US06 | Un joueur crée un salon, deux autres le rejoignent par le code, tous se déclarent prêts, l'hôte lance. | Le code à 5 caractères s'affiche ; chaque joueur voit les deux autres ; la partie démarre. | Fonctionnel | E2E `main-game.spec.ts` | Réussi en CI |
| RC02 | US02 | Un joueur ouvre le lien d'invitation `?room=CODE`. | Le code est pré-rempli à l'accueil. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC03 | US03 | Pseudonyme vide, trop court, trop long, avec caractère interdit, puis doublon en changeant la casse. | Refus avec un message explicite ; le doublon est refusé dans le salon. | Fonctionnel | À automatiser (2) | Non exécuté |
| RC04 | US02, US27 | Code de salon inconnu ou mal formé. | Message d'erreur ; aucune entrée dans un salon. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC05 | US01, US06 | Partie à deux joueurs, puis tentative de lancement à un seul joueur. | Le lancement est refusé à un joueur ; il est possible à deux joueurs prêts. | Fonctionnel | Unitaire `rooms.test.ts` (lancement) ; E2E à automatiser (3) | Partiel : unitaire réussi en CI |
| RC06 | US01 | Salon plein : un septième joueur tente de rejoindre. | Refus « salon plein ». | Fonctionnel | Unitaire `rooms.test.ts` | Réussi en CI |
| RC07 | US06, US23 | Un non-hôte tente de lancer ; lancement avant que tous soient prêts ; second lancement. | Refus avec un message ; l'état de la partie ne change pas. | Sécurité | À automatiser (2, 3) | Non exécuté |
| RC08 | US07 | Un joueur quitte le salon depuis l'écran du lobby. | Il revient à l'accueil ; le salon n'affiche plus son nom. | Fonctionnel | E2E `main-game.spec.ts` | Réussi en CI |

### Partie

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC09 | US08, US09, US10, US11, US13, US14, US15, US16 | Parcours complet à trois joueurs : deux manches, chacune avec trois dessins validés en même temps puis estimés un par un. | Chaque dessin est présenté une fois ; points et révélation après chaque dessin ; classement final après la seconde manche. | Fonctionnel | E2E `main-game.spec.ts` ; unitaire `game.test.ts` | Réussi (local, Node 22.12.0) ; CI à confirmer |
| RC10 | US08, US09 | Chaque joueur reçoit sa propre consigne et son niveau secret ; l'état public ne contient aucun niveau avant la révélation. | Trois consignes distinctes par manche ; aucune fuite dans l'état public. | Sécurité | Unitaire `game.test.ts` | Réussi (local) ; CI à confirmer |
| RC11 | US09 | Utiliser stylo, gomme, pot de peinture, couleurs, épaisseurs, annuler, tout effacer. | Chaque outil modifie le dessin comme attendu. | Fonctionnel | Manuel, puis E2E ciblé (3) | Non exécuté |
| RC12 | US10 | Valider un dessin vide ; valider un dessin avec confirmation ; annuler la confirmation. | Le bouton de validation est inactif sans trait ; l'annulation conserve le dessin. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC13 | US10, US23 | Second envoi d'un dessin ; envoi hors phase ; dessin dépassant 250 traits. | Refus pour chaque cas. | Sécurité | Unitaire `game.test.ts` (second envoi) ; reste à automatiser (2) | Partiel : second envoi réussi (local) |
| RC14 | US11, US12, US23 | L'auteur tente d'estimer son dessin ; doublon d'estimation ; valeur hors 1 à 10 ; estimation d'un dessin périmé ; estimation après révélation. | Refus pour chaque cas, sans changer l'état du jeu. | Sécurité | Unitaire `game.test.ts` (auteur) ; reste à automatiser (2) | Partiel : refus de l'auteur réussi (local) |
| RC15 | US13 | Barème : estimation exacte, écart de 1, écart de 2 ou plus ; points de l'auteur selon les points de ses votants. | Votant : 2, 1 ou 0 point ; auteur : moyenne arrondie des points de ses votants. | Structurel | Unitaire `game.test.ts` (barème paramétré) | Réussi (local) ; CI à confirmer |
| RC16 | US16 | Égalité au classement final. | Tous les ex æquo sont annoncés vainqueurs. | Fonctionnel | À automatiser (2) | Non exécuté |
| RC17 | US17 | L'hôte propose une revanche ; un non-hôte essaie. | Retour au lobby de tous, scores et états prêts remis à zéro ; refus pour le non-hôte. | Fonctionnel | E2E `main-game.spec.ts` (hôte) ; refus à automatiser (2) | Partiel : hôte réussi (local) |
| RC18 | US25 | Partie complète à deux joueurs. | Un seul votant par dessin ; la partie se termine normalement. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC19 | US25 | Partie à six joueurs. | Six joueurs dessinent en même temps sur deux manches. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC41 | US10 | Un joueur valide son dessin avant les autres. | Il voit « En attente des autres joueurs » et la liste de ceux qui dessinent encore ; les votes ne démarrent qu'après la dernière validation. | Fonctionnel | E2E `main-game.spec.ts` ; unitaire `game.test.ts` | Réussi (local) ; CI à confirmer |
| RC42 | US14, US15 | Enchaînement des dessins : dessin suivant, manche suivante, classement final. | Les libellés et la suite correspondent à l'étape ; un non-hôte ne peut pas continuer. | Fonctionnel | E2E `main-game.spec.ts` ; unitaire `game.test.ts` | Réussi (local) ; CI à confirmer |

### Continuité et réseau

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC20 | US18 | Un votant actualise sa page pendant son estimation. | Il retrouve son salon et son formulaire d'estimation, et peut voter. | Fonctionnel | E2E `main-game.spec.ts` | Réussi en CI |
| RC21 | US18 | Le dessinateur actualise sa page en cours de dessin. | Le dessin en cours et le niveau secret sont restaurés. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC22 | US18, US23 | Restauration avec un jeton invalide, un joueur inconnu, une instance cliente différente. | Refus ; aucune restauration. | Sécurité | À automatiser (2) | Non exécuté |
| RC23 | US19 | Un joueur est coupé, puis revient avant 60 secondes. | Indicateur de déconnexion, puis reprise de sa place. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC24 | US20 | Un joueur reste déconnecté plus de 60 secondes pendant une partie. | Il est retiré ; la partie est annulée avec un message pour le groupe. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC25 | US21 | Un joueur quitte en cours de partie ; l'hôte quitte. | La partie est annulée ; l'hôte passe au plus ancien joueur. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC26 | US22 | La même session est ouverte dans un second onglet. | Refus avec un message ; le premier onglet reste actif. | Sécurité | À automatiser (3) | Non exécuté |
| RC27 | US27 | Le serveur est indisponible au chargement ou en cours de partie. | Message clair ; reprise automatique lorsque le serveur revient. | Fonctionnel | Manuel | Non exécuté |

### Sécurité et exploitation

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC28 | US24 | Plus de 60 requêtes par minute sur `/api` depuis la même IP. | Réponse 429 avec en-tête `Retry-After`. | Sécurité | À automatiser (2) | Non exécuté |
| RC29 | US24 | Plus de 5 événements par seconde sur une connexion. | Accusé `RATE_LIMITED` ; l'état du jeu ne change pas. | Sécurité | Unitaire `security.test.ts` (débit) ; E2E à automatiser (3) | Partiel : unitaire réussi en CI |
| RC30 | US24 | Plus de 30 connexions simultanées ou 5 salons par jour depuis la même IP. | La connexion ou la création excédentaire est refusée. | Sécurité | Unitaire `security.test.ts` (connexions) | Partiel : unitaire réussi en CI |
| RC31 | US24 | Cinq échecs de jonction ou de restauration. | Les tentatives suivantes sont refusées pendant 15 minutes. | Sécurité | Unitaire `security.test.ts` | Réussi en CI |
| RC32 | US24 | Un salon sans action pendant 24 heures. | Le salon est fermé. | Sécurité | Unitaire `rooms.test.ts` | Réussi en CI |
| RC33 | US23 | Poignée de main WebSocket depuis une origine étrangère ; en-têtes de sécurité sur `/api/health`. | Origine refusée ; en-têtes CSP, `X-Frame-Options`, `nosniff` présents ; pas de `X-Powered-By`. | Sécurité | À automatiser (2) | Non exécuté |
| RC34 | B6 | Audit des dépendances, formatage, lint, typage, build. | 0 vulnérabilité haute ; tous les contrôles verts. | Structurel | CI : `Dependency audit`, `Formatting`, `Lint`, `Typecheck`, `Build` | Réussi en CI |
| RC35 | B7 | Déploiement : santé après déploiement, déclenchement automatique, retour arrière. | `/api/health` répond 200 ; déploiement sans clic manuel ; retour arrière exécuté. | Déploiement | Manuel (7) | Non exécuté |

### Appareils et accessibilité

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC36 | US25 | Parcours sur écran de téléphone et de tablette (émulation). | Interface utilisable, sans défilement horizontal, boutons accessibles. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC37 | US25 | Dessin et estimation au doigt sur un téléphone et une tablette réels. | Tracé continu, sans défilement parasite ; estimation validée. | Fonctionnel | Manuel (8) | Non exécuté |
| RC38 | US26 | Navigation au clavier sur tous les écrans. | Ordre logique, focus visible, aucune impasse ; limites du canevas documentées. | Accessibilité | Manuel (5) | Non exécuté |
| RC39 | US26 | Parcours avec un lecteur d'écran. | Noms et rôles annoncés ; changements de phase annoncés. | Accessibilité | Manuel (5) | Non exécuté |
| RC40 | US26 | Contrôle automatique et contrastes, zoom à 200 %. | Pas de violation automatique du référentiel retenu ; contrastes suffisants. | Accessibilité | À automatiser (5) | Non exécuté |

## 5. Limites

- Les user stories ne reposent pas sur un cahier des charges initial : elles décrivent le jeu existant et doivent être validées par le porteur du projet.
- Le cahier couvre les fonctions actuelles. Les étapes 2 et 3 du plan (`docs/bloc2.md`) automatisent les scénarios « À automatiser » ; l'étape 9 exécute le cahier complet et consigne les résultats.
- « Réussi en CI » ne vaut pas validation par des utilisateurs (étape 8).
