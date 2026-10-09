# Manuel d'utilisation

Ce manuel s'adresse aux joueurs. Il explique comment lancer une partie et la jouer jusqu'au classement. Aucun compte n'est nécessaire.

Adresse du jeu : https://drawing-scale-game.onrender.com/ (préproduction ; l'adresse de production sera ajoutée à `README.md` une fois connue).

## 1. Le jeu en bref

De 2 à 6 joueurs se retrouvent dans un salon. Chaque joueur reçoit une **consigne** et un **niveau secret de 1 à 10** sur une échelle (par exemple de « coquille immobile » à « escargot supersonique »). Il dessine la consigne en laissant deviner ce niveau. Les dessins sont ensuite présentés un par un : les autres joueurs estiment le niveau, puis la réponse est révélée. Il y a **deux manches**. Le meilleur total gagne.

La première ouverture du site peut demander une vingtaine de secondes : le serveur gratuit se réveille. Patientez, la page se charge ensuite normalement.

## 2. Créer ou rejoindre une partie

- **Créer** : saisir un pseudonyme (2 à 20 caractères), puis « Créer une partie ». Un **code à 5 caractères** s'affiche. Partagez-le avec « Copier le code », ou envoyez le lien avec « Copier le lien d'invitation ».
- **Rejoindre** : saisir son pseudonyme et le code, puis « Rejoindre la partie ». Un lien d'invitation pré-remplit le code.
- Le salon accepte 6 joueurs au plus. Deux pseudonymes identiques (même en changeant la casse) sont refusés.

## 3. Lancer la partie

Chaque joueur clique sur « Je suis prêt » (on peut annuler). Quand **au moins deux joueurs** sont prêts et que tous le sont, l'**hôte** (le créateur du salon) clique sur « Lancer la partie ». Si l'hôte part, le joueur le plus ancien devient hôte.

## 4. Dessiner

Tous les joueurs dessinent **en même temps**, sans limite de temps. Votre consigne et votre niveau secret sont affichés en haut : personne d'autre ne les voit.

| Outil | Usage |
| --- | --- |
| Stylo | Trace un trait ; 16 couleurs et 3 tailles au choix. |
| Gomme | Efface en passant dessus. |
| Pot de peinture | Remplit une zone d'une couleur. |
| Annuler | Retire la dernière action. |
| Tout effacer | Vide le dessin, après confirmation (« Garder mon dessin » pour renoncer). |

Un dessin est limité à 250 traits. Le dessin est conservé si vous actualisez la page. Quand il vous convient, cliquez sur « Valider le dessin » (inactif tant qu'aucun trait n'est tracé), puis confirmez. **Une validation est définitive.** Vous voyez ensuite qui dessine encore ; les estimations commencent quand tout le monde a validé.

## 5. Estimer

Chaque dessin est présenté une fois, dans un ordre mélangé. Si ce n'est pas le vôtre, choisissez le **niveau de 1 à 10** que vous pensez lu dans le dessin et validez. L'auteur attend les estimations des autres.

## 6. Révélation et points

Quand tout le monde a estimé, le niveau secret est révélé.

- **Votant** : 2 points pour l'estimation exacte, 1 point à 1 niveau d'écart, 0 sinon.
- **Auteur** : la moyenne arrondie des points obtenus par ses votants (0, 1 ou 2).

L'hôte clique sur « Dessin suivant », puis « Manche suivante » après le dernier dessin d'une manche, puis « Voir le classement final » à la fin de la seconde manche.

## 7. Classement et revanche

Le classement final affiche les rangs ; en cas d'égalité, les joueurs sont ex æquo. L'hôte peut « Proposer une revanche » : tous reviennent au salon avec les scores remis à zéro. Chacun peut aussi quitter le salon.

## 8. Quand quelque chose se passe mal

| Situation | Ce qui se passe | Que faire |
| --- | --- | --- |
| Actualisation de la page ou coupure brève | Vous retrouvez votre place et votre dessin en cours. | Attendre le message « Reconnexion… ». |
| Un joueur reste déconnecté plus de 60 secondes | La partie est annulée pour tous, avec un message ; le groupe revient au salon. | Relancer une partie. |
| Un joueur quitte en cours de partie | La partie est annulée pour tous. | Relancer une partie. |
| « Cette session est déjà ouverte dans un autre onglet » | Votre place est active dans un autre onglet. | Utiliser cet onglet-là, ou fermer l'autre et recharger. |
| « Cette partie n'existe plus » | Le salon a été fermé (inactivité de 24 h, ou redémarrage du serveur). | Créer une nouvelle partie. |
| « Ce salon a déjà atteint sa limite de joueurs » ou « Cette partie a déjà commencé » | Le salon n'accepte plus de joueur. | Créer un autre salon. |
| Trop de tentatives | Cinq codes erronés bloquent les essais pendant 15 minutes ; un réseau partagé est limité à 5 salons créés par jour. | Attendre, ou demander à l'administrateur de relever la limite. |

## 9. Accessibilité

Le jeu est utilisable au clavier pour créer ou rejoindre un salon, se déclarer prêt, estimer et lire les résultats. **Le dessin à main levée n'est pas utilisable au clavier** : une personne qui ne peut pas utiliser un dispositif de pointage ne peut pas dessiner. Les contrastes et l'affichage sur écran étroit (320 px) ont été vérifiés ; les limites et contrôles restants sont dans [accessibilite.md](accessibilite.md).

## 10. Vos données

Le jeu ne demande ni compte ni adresse électronique. Le pseudonyme et un identifiant de session sont conservés dans le navigateur pour reprendre votre place ; le serveur garde l'état de la partie en mémoire uniquement et l'efface à la fin ou après 24 h d'inactivité. L'adresse IP sert aux limites de débit et n'apparaît dans les journaux que masquée.
