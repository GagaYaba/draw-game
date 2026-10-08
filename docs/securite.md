# Sécurité : modèle de menace et quotas

Ce document fixe les menaces retenues, les contrôles en place et les valeurs de quotas. Il répond au critère C2.2.1 (sécurité) et sert de base à l'audit OWASP (C2.2.3).

## Périmètre

- Serveur Express et Socket.IO hébergé sur Render (instance unique, plan Free, en mémoire).
- Pas de compte utilisateur, pas de messagerie, pas de base de données. L'identité d'un joueur est un jeton de session (256 bits, stocké haché côté serveur) et un identifiant d'instance cliente.

## Biens à protéger

- Disponibilité du serveur (mémoire, CPU, nombre de connexions).
- Intégrité des parties : secrets de tour, estimations non révélées, scores.
- Sessions : un jeton volé ou deviné permet de reprendre une place.

## Menaces retenues

| Menace | Contrôle | Limite résiduelle |
| --- | --- | --- |
| Flood HTTP sur `/api` | 60 requêtes par minute et par adresse IP, réponse HTTP 429 et en-tête `Retry-After`. | Les fichiers statiques ne sont pas limités. |
| Flood Socket.IO | 5 événements par seconde et par connexion (rafale de 5). Au-delà, accusé `RATE_LIMITED` ou événement ignoré. | Pas de limite par compte : il n'existe pas de compte. |
| Saturation par connexions | 30 connexions simultanées par adresse IP, dimensionné pour une salle de classe. | Une adresse partagée peut atteindre la limite avec 30 élèves. |
| Création massive de salons | 5 salons par adresse IP sur 24 heures. | Même limite par adresse partagée. |
| Salons abandonnés | Fermeture d'un salon sans action pendant 24 heures (contrôle toutes les 10 minutes). | Les salons restent en mémoire jusqu'à ce contrôle. |
| Énumération de codes de salon | 5 échecs par connexion et 20 échecs par adresse IP sur 15 minutes. | Un code de 5 caractères compte environ 33 millions de combinaisons ; les quotas réduisent l'énumération sans l'éliminer. |
| Force brute sur les jetons de reprise | Mêmes quotas d'échecs. Un jeton de 256 bits n'est pas devinable. | Un jeton volé reste valable pendant la fenêtre de reconnexion. |
| Messages trop volumineux | Limite de 2,5 Mo par message (Socket.IO) et limites du document de dessin (250 traits, 30 000 points). | Aucune mesure réelle de la taille maximale produite par un client. |
| Ajout de joueurs au-delà des règles | 2 joueurs minimum, 6 maximum. | Décision du porteur du projet, qui remplace la règle précédente de 3 à 8 joueurs. |

## Valeurs retenues

| Paramètre | Valeur | Origine du choix |
| --- | --- | --- |
| Requêtes HTTP `/api` | 60/min par IP | Demande du porteur du projet. |
| Événements Socket.IO | 5/s par connexion | Demande du porteur du projet ; une partie consomme quelques événements par tour. |
| Connexions simultanées | 30 par IP | Choix : une salle de classe partage une adresse publique. |
| Salons créés | 5 par IP et par 24 h | Demande du porteur du projet, appliquée à l'adresse IP faute de comptes. |
| Échecs d'accès | 5 par connexion, 20 par IP, sur 15 min | Choix : le seuil par IP est plus haut pour ne pas bloquer une classe. |
| Salons inactifs | 24 h sans action | Demande du porteur du projet ; une action est tout événement d'un joueur du salon. |
| Joueurs | 2 à 6 | Demande du porteur du projet. |

## Proxy et adresse IP

Render place le serveur derrière un proxy. Le serveur retient la **dernière** adresse de `X-Forwarded-For`, celle ajoutée par le proxy ; les valeurs envoyées par le client avant elle sont ignorées. Sans cette lecture, toutes les requêtes auraient la même adresse, et les quotas par IP bloqueraient tout le monde ou personne.

## Limites de l'implémentation

- Les compteurs sont en mémoire : ils sont remis à zéro à chaque redémarrage et ne sont pas partagés entre instances. Une seconde instance imposerait un stockage partagé.
- Les vérifications de santé Render interrogent `/api/health`, donc comptent dans la limite HTTP. Le seuil reste largement supérieur à leur fréquence.
- Les quotas ne remplacent pas un audit OWASP complet (C2.2.3).

## Preuves

- Tests unitaires : `server/test/security.test.ts` (débit, fenêtres, adresse IP, quotas d'accès et de connexions) et `server/test/rooms.test.ts` (bornes de joueurs, fermeture des salons inactifs). Exécution : `npm run test:unit`.
- Contre-vérification sur le build de production : 60 requêtes HTTP acceptées puis 429 ; rafale de 12 événements avec refus `RATE_LIMITED` ; 31e connexion refusée depuis la même IP ; 6e création de salon refusée. Le script est temporaire et hors dépôt.
