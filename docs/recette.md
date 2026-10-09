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
| RC02 | US02 | Un joueur ouvre le lien d'invitation `?room=CODE`. | Le code est pré-rempli à l'accueil. | Fonctionnel | E2E `extra-paths.spec.ts` | Réussi (local) ; CI à confirmer |
| RC03 | US03 | Pseudonyme vide, trop court, trop long, avec caractère interdit, puis doublon en changeant la casse. | Refus avec un message explicite ; le doublon est refusé dans le salon. | Fonctionnel | Intégration `server.test.ts`, unitaire `validation.test.ts` | Réussi (local) ; CI à confirmer |
| RC04 | US02, US27 | Code de salon inconnu ou mal formé. | Message d'erreur ; aucune entrée dans un salon. | Fonctionnel | E2E `extra-paths.spec.ts` (interface), intégration `server.test.ts` (serveur) | Réussi (local) ; CI à confirmer |
| RC05 | US01, US06 | Partie à deux joueurs, puis tentative de lancement à un seul joueur. | Le lancement est refusé à un joueur ; il est possible à deux joueurs prêts. | Fonctionnel | Unitaire `rooms.test.ts` (lancement) ; E2E à automatiser (3) | Partiel : unitaire réussi en CI |
| RC06 | US01 | Salon plein : un septième joueur tente de rejoindre. | Refus « salon plein ». | Fonctionnel | Unitaire `rooms.test.ts` | Réussi en CI |
| RC07 | US06, US23 | Un non-hôte tente de lancer ; lancement avant que tous soient prêts ; second lancement. | Refus avec un message ; l'état de la partie ne change pas. | Sécurité | Intégration `server.test.ts` (non-hôte) ; reste à automatiser (3) | Partiel : refus du non-hôte réussi (local) |
| RC08 | US07 | Un joueur quitte le salon depuis l'écran du lobby. | Il revient à l'accueil ; le salon n'affiche plus son nom. | Fonctionnel | E2E `main-game.spec.ts` | Réussi en CI |

### Partie

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC09 | US08, US09, US10, US11, US13, US14, US15, US16 | Parcours complet à trois joueurs : deux manches, chacune avec trois dessins validés en même temps puis estimés un par un. | Chaque dessin est présenté une fois ; points et révélation après chaque dessin ; classement final après la seconde manche. | Fonctionnel | E2E `main-game.spec.ts` ; unitaire `game.test.ts` | Réussi (local, Node 22.12.0) ; CI à confirmer |
| RC10 | US08, US09 | Chaque joueur reçoit sa propre consigne et son niveau secret ; l'état public ne contient aucun niveau avant la révélation. | Trois consignes distinctes par manche ; aucune fuite dans l'état public. | Sécurité | Unitaire `game.test.ts` | Réussi (local) ; CI à confirmer |
| RC11 | US09 | Utiliser stylo, gomme, pot de peinture, couleurs, épaisseurs, annuler, tout effacer. | Chaque outil modifie le dessin comme attendu. | Fonctionnel | Manuel, puis E2E ciblé (3) | Non exécuté |
| RC12 | US10 | Valider un dessin vide ; valider un dessin avec confirmation ; annuler la confirmation. | Le bouton de validation est inactif sans trait ; l'annulation conserve le dessin. | Fonctionnel | E2E `extra-paths.spec.ts` (validation désactivée sans trait) ; annulation de la confirmation non automatisée | Partiel : validation désactivée sans trait réussie (local) |
| RC13 | US10, US23 | Second envoi d'un dessin ; envoi hors phase ; dessin dépassant 250 traits. | Refus pour chaque cas. | Sécurité | Intégration `server.test.ts` (second envoi), unitaire `validation.test.ts` (limites) ; hors phase à automatiser | Partiel : second envoi et limites réussis (local) |
| RC14 | US11, US12, US23 | L'auteur tente d'estimer son dessin ; doublon d'estimation ; valeur hors 1 à 10 ; estimation d'un dessin périmé ; estimation après révélation. | Refus pour chaque cas, sans changer l'état du jeu. | Sécurité | Intégration `server.test.ts` | Réussi (local) ; CI à confirmer |
| RC15 | US13 | Barème : estimation exacte, écart de 1, écart de 2 ou plus ; points de l'auteur selon les points de ses votants. | Votant : 2, 1 ou 0 point ; auteur : moyenne arrondie des points de ses votants. | Structurel | Unitaire `game.test.ts` (barème paramétré) | Réussi (local) ; CI à confirmer |
| RC16 | US16 | Égalité au classement final. | Tous les ex æquo sont annoncés vainqueurs. | Fonctionnel | À automatiser (2) | Non exécuté |
| RC17 | US17 | L'hôte propose une revanche ; un non-hôte essaie. | Retour au lobby de tous, scores et états prêts remis à zéro ; refus pour le non-hôte. | Fonctionnel | E2E `main-game.spec.ts` (hôte), intégration `server.test.ts` (non-hôte) | Réussi (local) ; CI à confirmer |
| RC18 | US25 | Partie complète à deux joueurs. | Un seul votant par dessin ; la partie se termine normalement. | Fonctionnel | E2E `extra-paths.spec.ts` (téléphone) | Réussi (local) ; CI à confirmer |
| RC19 | US25 | Partie à six joueurs. | Six joueurs dessinent en même temps sur deux manches. | Fonctionnel | À automatiser (3) | Non exécuté |
| RC41 | US10 | Un joueur valide son dessin avant les autres. | Il voit « En attente des autres joueurs » et la liste de ceux qui dessinent encore ; les votes ne démarrent qu'après la dernière validation. | Fonctionnel | E2E `main-game.spec.ts` ; unitaire `game.test.ts` | Réussi (local) ; CI à confirmer |
| RC42 | US14, US15 | Enchaînement des dessins : dessin suivant, manche suivante, classement final. | Les libellés et la suite correspondent à l'étape ; un non-hôte ne peut pas continuer. | Fonctionnel | E2E `main-game.spec.ts` ; unitaire `game.test.ts` | Réussi (local) ; CI à confirmer |

### Continuité et réseau

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC20 | US18 | Un votant actualise sa page pendant son estimation. | Il retrouve son salon et son formulaire d'estimation, et peut voter. | Fonctionnel | E2E `main-game.spec.ts` | Réussi en CI |
| RC21 | US18 | Le dessinateur actualise sa page en cours de dessin. | Le dessin en cours et le niveau secret sont restaurés. | Fonctionnel | E2E `extra-paths.spec.ts` | Réussi (local) ; CI à confirmer |
| RC22 | US18, US23 | Restauration avec un jeton invalide, un joueur inconnu, une instance cliente différente. | Refus ; aucune restauration. | Sécurité | Intégration `server.test.ts` | Réussi (local) ; CI à confirmer |
| RC23 | US19 | Un joueur est coupé, puis revient avant 60 secondes. | Indicateur de déconnexion, puis reprise de sa place. | Fonctionnel | E2E `extra-paths.spec.ts`, intégration `server.test.ts` | Réussi (local) ; CI à confirmer |
| RC24 | US20 | Un joueur reste déconnecté plus de 60 secondes pendant une partie. | Il est retiré ; la partie est annulée avec un message pour le groupe. | Fonctionnel | E2E `extra-paths.spec.ts`, intégration `server.test.ts` | Réussi (local) ; CI à confirmer |
| RC25 | US21 | Un joueur quitte en cours de partie ; l'hôte quitte. | La partie est annulée ; l'hôte passe au plus ancien joueur. | Fonctionnel | Intégration `server.test.ts` | Réussi (local) ; CI à confirmer |
| RC26 | US22 | La même session est ouverte dans un second onglet. | Refus avec un message ; le premier onglet reste actif. | Sécurité | Intégration `server.test.ts` (serveur) ; message d'interface à automatiser (3) | Partiel : refus côté serveur réussi (local) |
| RC27 | US27 | Le serveur est indisponible au chargement ou en cours de partie. | Message clair ; reprise automatique lorsque le serveur revient. | Fonctionnel | Manuel | Non exécuté |

### Sécurité et exploitation

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC28 | US24 | Plus de 60 requêtes par minute sur `/api` depuis la même IP. | Réponse 429 avec en-tête `Retry-After`. | Sécurité | Intégration `quotas.test.ts` | Réussi (local) ; CI à confirmer |
| RC29 | US24 | Plus de 5 événements par seconde sur une connexion. | Accusé `RATE_LIMITED` ; l'état du jeu ne change pas. | Sécurité | Intégration `quotas.test.ts`, unitaire `security.test.ts` | Réussi (local) ; CI à confirmer |
| RC30 | US24 | Plus de 30 connexions simultanées ou 5 salons par jour depuis la même IP. | La connexion ou la création excédentaire est refusée. | Sécurité | Intégration `quotas.test.ts`, unitaire `security.test.ts` | Réussi (local) ; CI à confirmer |
| RC31 | US24 | Cinq échecs de jonction ou de restauration. | Les tentatives suivantes sont refusées pendant 15 minutes. | Sécurité | Intégration `quotas.test.ts`, unitaire `security.test.ts` | Réussi (local) ; CI à confirmer |
| RC32 | US24 | Un salon sans action pendant 24 heures. | Le salon est fermé. | Sécurité | Unitaire `rooms.test.ts` | Réussi en CI |
| RC33 | US23 | Poignée de main WebSocket depuis une origine étrangère ; en-têtes de sécurité sur `/api/health`. | Origine refusée ; en-têtes CSP, `X-Frame-Options`, `nosniff` présents ; pas de `X-Powered-By`. | Sécurité | Intégration `quotas.test.ts`, unitaire `validation.test.ts` | Réussi (local) ; CI à confirmer |
| RC34 | B6 | Audit des dépendances, formatage, lint, typage, build. | 0 vulnérabilité haute ; tous les contrôles verts. | Structurel | CI : `Dependency audit`, `Formatting`, `Lint`, `Typecheck`, `Build` | Réussi en CI |
| RC35 | B7 | Déploiement : santé après déploiement, déclenchement automatique, retour arrière. | `/api/health` répond 200 ; déploiement sans clic manuel ; retour arrière exécuté. | Déploiement | Manuel (7) | Non exécuté |

| RC43 | US23 | Charges inattendues (null, nombres, texte de 10 000 caractères, tableaux, objets imbriqués) sur chacun des dix événements. | Chaque événement est refusé sans plantage ; le serveur répond ensuite à la santé et accepte une création de salon. | Sécurité | Intégration `server.test.ts` | Réussi (local) ; CI à confirmer |
| RC44 | US24 | Origine refusée, flood HTTP et d'événements, échecs et blocage d'accès, salons et connexions limités. | Chaque événement est journalisé une fois, avec une adresse IP masquée ; HSTS annoncé pour les requêtes HTTPS. | Sécurité | Intégration `quotas.test.ts` | Réussi (local) ; CI à confirmer |

### Appareils et accessibilité

| ID | US | Scénario | Résultat attendu | Type | Moyen | Résultat |
| --- | --- | --- | --- | --- | --- | --- |
| RC36 | US25 | Parcours sur écran de téléphone et de tablette (émulation). | Interface utilisable, sans défilement horizontal, boutons accessibles. | Fonctionnel | E2E `extra-paths.spec.ts` (profil Pixel 7 : parcours complet, aucun débordement horizontal) ; tablette non testée | Partiel : téléphone réussi (local) |
| RC37 | US25 | Dessin et estimation au doigt sur un téléphone et une tablette réels. | Tracé continu, sans défilement parasite ; estimation validée. | Fonctionnel | Manuel (8) | Non exécuté |
| RC38 | US26 | Navigation au clavier sur tous les écrans. | Ordre logique, focus visible, aucune impasse ; limites du canevas documentées. | Accessibilité | Manuel (5) | Non exécuté |
| RC39 | US26 | Parcours avec un lecteur d'écran. | Noms et rôles annoncés ; changements de phase annoncés. | Accessibilité | Manuel (5) | Non exécuté |
| RC40 | US26 | Contrôle automatique et contrastes, zoom à 200 %. | Pas de violation automatique du référentiel retenu ; contrastes suffisants. | Accessibilité | À automatiser (5) | Non exécuté |

## 5. Tests automatisés et risques couverts

La suite compte **31 tests unitaires et d'intégration** et **4 tests E2E**. Chaque test regroupe les cas d'un même risque (tableaux d'entrées et de résultats attendus) ; un test n'existe que s'il protège un risque identifié.

| Fichier | Test | Risque couvert |
| --- | --- | --- |
| `server/test/game.test.ts` | Barème et suite de la partie | Un score faux fausse le classement final. |
| | Partie à dessin simultané | Fuite de secret, enchaînement des dessins ou des manches incorrect, scores incohérents. |
| `server/test/rooms.test.ts` | Bornes de joueurs | Règle de jeu 2 à 6 joueurs non respectée. |
| | Fermeture des salons inactifs | Saturation mémoire par des salons abandonnés. |
| `server/test/security.test.ts` | Limiteurs, fenêtres, adresse IP | Quota faux : joueurs légitimes bloqués ou flood non limité. |
| | Échecs d'accès et connexions par adresse | Énumération de codes, saturation des connexions. |
| `server/test/validation.test.ts` | Saisies (pseudonymes, codes, commandes) | Données mal formées ou injection. |
| | Sessions, jetons, estimations | Prise de place d'un joueur, triche par estimation falsifiée. |
| | Dessins | Dessin hors limites : saturation mémoire ou réseau. |
| | Origine WebSocket | Site tiers pilotant le serveur depuis le navigateur d'un joueur. |
| `server/test/shutdown.test.ts` | Arrêt gracieux (2 tests) | Déploiement qui laisse des connexions ou des minuteurs actifs. |
| `server/test/quotas.test.ts` | En-têtes et origines (réseau réel) | Navigateur insuffisamment protégé. |
| | Quotas HTTP et événements | Flood épuisant le processeur de l'instance unique. |
| | Échecs de jonction, salons, connexions par IP (et journal de sécurité) | Énumération, création massive de salons, abus non détectés. |
| `server/test/server.test.ts` | Partie complète sur serveur réel | Contrat réseau : autorisations, phases, secrets de bout en bout. |
| | Restauration, expiration, mauvais identifiants | Coupure réseau : place perdue, partie bloquée, usurpation. |
| | Départ et transfert d'hôte | Partie bloquée après un départ. |
| | Saisies et commandes hors contexte | Une commande invalide modifie l'état du jeu. |
| | Charges inattendues sur chaque événement | Plantage du processus : l'état de tous les salons est en mémoire. |
| | Salon plein, pseudonyme pris, partie commencée | Règles d'admission contournées. |
| `client/test/storage.test.ts` | Stockage local | Stockage corrompu ou indisponible qui empêche de jouer ou restaure à tort. |
| | Contexte des brouillons, identifiant d'instance | Brouillon ou identifiant d'un autre tour, d'une autre partie ou d'un autre onglet. |
| `client/test/drawing.test.ts` | Normalisation et document de dessin | Dessin déformé à l'envoi. |
| | Remplissage | Pot de peinture qui déborde ou plante. |
| | Cache de rendu | Dessin affiché différent du dessin envoyé. |
| `client/test/screens.test.tsx` | Accueil et salon | Écran qui plante au rendu et bloque le groupe. |
| | Introduction, dessin, attente | Idem, et information d'attente fausse. |
| | Vote | Idem, et auteur autorisé à voter. |
| | Révélation | Idem, et bouton de suite inadapté. |
| | Classement, connexion, application | Idem, et message de reconnexion absent. |
| `e2e/main-game.spec.ts` | Partie complète à trois joueurs | Parcours réel dans un navigateur, restauration après actualisation, revanche, départ. |
| `e2e/extra-paths.spec.ts` | Lien d'invitation et erreurs de saisie | Un joueur qui se trompe de pseudonyme ou de code reste bloqué sans comprendre. |
| | Partie à deux joueurs sur téléphone | Jeu injouable sur petit écran ou au minimum de joueurs (débordement, écran hors de vue). |
| | Actualisation, coupure, reprise et expiration | Perte du dessin en cours, groupe bloqué après une coupure. |

Ces tests ne couvrent pas les gestionnaires d'événements ni les effets des composants (canevas, minuteries) : ils relèvent du test E2E.

## 5 bis. Couverture des tests unitaires

Commande : `npm run test:coverage` (tests unitaires, d'intégration serveur et de rendu des écrans ; `c8` avec l'option `all`, qui compte aussi les fichiers jamais exécutés). Le détail par fichier s'obtient avec `node scripts/coverage-report.mjs --files <préfixe>`.

**Périmètre** : tout le code applicatif de `server/src`, `shared/src` et `client/src`. Seuls deux fichiers sont exclus, parce qu'ils ne contiennent que des déclarations de types sans code exécutable : `server/src/game/game-types.ts` et `shared/src/types.ts`. Les tests, les feuilles de style et les fichiers `.d.ts` sont exclus.

| Périmètre | Lignes couvertes | Couverture |
| --- | --- | --- |
| Serveur (`server/src`) | 4 457 / 5 251 | 84,9 % |
| Partagé (`shared/src`) | 155 / 155 | 100,0 % |
| Client, composants React | 3 706 / 4 631 | 80,0 % |
| Client, hors composants (dont le hook `useRoomSession`) | 1 164 / 2 650 | 43,9 % |
| **Total** | **9 482 / 12 687** | **74,7 %** |

Mesure locale sous Node 22.12.0 ; la CI exécute la même commande et échoue sous 70 % de lignes (seuil interne de non-régression, absent du référentiel).

**Limites** :
- Les composants React sont testés par rendu côté serveur (`react-dom/server`) : le code de rendu est exécuté, mais les gestionnaires d'événements et les effets (canevas, minuteries, copie dans le presse-papiers) ne le sont pas ; ils relèvent du test E2E.
- Le hook `useRoomSession` (1 694 lignes, environ 26 % couvert) n'est testé que par ses fonctions pures et par le test E2E. Un test de hook demanderait un environnement DOM dédié.
- Le composant `DrawingCanvas` (gestion du pointeur) n'est couvert qu'en rendu.
- La couverture par lignes ne mesure pas la qualité des assertions : les scénarios « Réussi (local) » de la section 4 indiquent ce que les tests vérifient.

## 6. Limites

- Les user stories ne reposent pas sur un cahier des charges initial : elles décrivent le jeu existant et doivent être validées par le porteur du projet.
- Le cahier couvre les fonctions actuelles. Les étapes 2 et 3 du plan (`docs/bloc2.md`) automatisent les scénarios « À automatiser » ; l'étape 9 exécute le cahier complet et consigne les résultats.
- « Réussi en CI » ne vaut pas validation par des utilisateurs (étape 8).
