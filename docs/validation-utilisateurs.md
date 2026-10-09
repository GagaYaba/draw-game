# Validation par des utilisateurs

Ce document définit le protocole de validation par des utilisateurs indépendants (critères 9, 10, 19 et 22 de `docs/bloc2.md`), la fiche de retour et la façon dont les retours alimentent le registre des anomalies. **Aucune session n'a eu lieu à ce jour : les tableaux de résultats sont vides et aucune preuve n'est acquise.**

## 1. Objectif

Vérifier qu'un utilisateur qui n'a pas participé au projet peut, **sans aide**, créer ou rejoindre une partie, la jouer jusqu'au classement final et comprendre ce qui lui arrive, sur son propre appareil. Les besoins B1 à B5 de `docs/recette.md` sont ceux visés.

## 2. Testeurs et appareils

| Exigence | Valeur minimale | Raison |
| --- | --- | --- |
| Testeurs | 6, répartis en 2 salons de 3 | Une partie se joue à 2 à 6 : des salons de 3 évitent qu'un testeur absent bloque la session. |
| Indépendance | Aucun testeur n'a participé au développement | Un développeur connaît le jeu et ne bute plus sur ses ambiguïtés. |
| Appareils | Au moins un téléphone, une tablette et un ordinateur | Besoin B3 : tactile et souris. |
| Navigateurs | Au moins deux familles (par exemple Chrome et Safari) | Le dessin repose sur des événements de pointeur dont la prise en charge varie. |
| Profils | Au moins un testeur peu habitué aux jeux en ligne | Mesure l'autonomie, pas seulement la bonne volonté d'un joueur averti. |

Si possible, inclure une personne qui utilise un agrandissement du texte ou un lecteur d'écran : cela complète les contrôles manuels de `docs/accessibilite.md` (section 7).

## 3. Déroulement d'une session (30 minutes)

Environnement : la **préproduction** (`https://drawing-scale-game.onrender.com/`) pour les premiers essais, puis la production une fois sa URL consignée. Le serveur gratuit peut mettre une vingtaine de secondes à répondre au premier chargement : prévenir les testeurs et faire charger la page avant de commencer.

1. **Consigne unique donnée à l'oral** : « Voici l'adresse. Jouez une partie complète ensemble. » Aucune explication des règles, aucune démonstration.
2. L'observateur ne répond à aucune question sur le jeu ; il note l'heure et la nature de chaque blocage (un blocage = plus de 30 secondes sans avancer, ou une question posée).
3. Scénario observé, dans l'ordre : créer un salon (hôte), rejoindre par le code ou le lien (les autres), se déclarer prêt, lancer, dessiner, valider, estimer, lire la révélation, terminer les deux manches, lire le classement, proposer une revanche.
4. Chaque testeur remplit la fiche de retour (section 4) seul, juste après la partie.
5. Un échange de 5 minutes en groupe recueille les remarques libres.

## 4. Fiche de retour (une par testeur)

**Identification** : numéro de testeur (T1, T2, ...), appareil et modèle, système et navigateur, familiarité avec les jeux en ligne (faible / moyenne / forte). Pas de nom ni d'adresse électronique.

**Observations de l'observateur** : a-t-il terminé la partie sans aide (oui / non) ; durée ; blocages (étape, durée, ce qui a débloqué) ; erreurs affichées ; comportements inattendus.

**Questionnaire** (échelle de 1, « pas du tout d'accord », à 5, « tout à fait d'accord ») :

| N° | Affirmation |
| --- | --- |
| Q1 | J'ai compris comment créer ou rejoindre une partie. |
| Q2 | J'ai compris ce que je devais faire à chaque étape sans aide. |
| Q3 | Dessiner sur mon appareil était confortable. |
| Q4 | J'ai compris comment estimer le niveau d'un dessin. |
| Q5 | J'ai compris mon score et le classement. |
| Q6 | Le jeu était réactif : je n'ai pas attendu sans comprendre pourquoi. |
| Q7 | Les textes étaient lisibles sur mon appareil. |
| Q8 | Je rejouerais avec des amis. |

**Questions ouvertes** : ce qui vous a le plus gêné ; ce que vous avez préféré ; ce que vous changeriez en premier.

## 5. Critères d'acceptation

| Critère | Seuil |
| --- | --- |
| Testeurs ayant terminé la partie sans aide | Au moins 5 sur 6 |
| Moyenne des questions Q1 à Q7 | Au moins 4 sur 5, et aucune question sous 3 en moyenne |
| Anomalie bloquante (partie impossible à terminer) | Aucune non traitée |
| Q8 | Au moins 4 testeurs sur 6 à 4 ou plus |

Ces seuils sont une proposition du projet, à valider par le porteur ; ils sont fixés avant les sessions pour que les résultats ne les redéfinissent pas.

## 6. Traitement des retours

Chaque retour est classé, puis consigné dans le registre des anomalies de `docs/validation.md` avec le même format que les défauts existants (gravité, cause, correction, statut) :

| Classe | Définition | Suite |
| --- | --- | --- |
| Défaut | Comportement contraire au résultat attendu d'un scénario de `docs/recette.md` | Correction par PR avec un contre-test ciblé si le risque le justifie (étape 9). |
| Écart d'ergonomie | Le comportement est conforme mais a bloqué un testeur | Amélioration proportionnée, ou décision documentée de ne pas la faire. |
| Suggestion | Fonction ou règle nouvelle | Consignée, non traitée sans décision du porteur. |

Un retour qui ne se reproduit pas est consigné comme « non reproduit » avec l'appareil et la version (commit servi par `/api/health`).

## 7. Résultats

À compléter après les sessions.

| Session | Date | Version (commit) | Testeurs | Appareils | Terminé sans aide | Moyenne Q1 à Q7 | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | À faire |
| 2 | | | | | | | À faire |

| Anomalies relevées | Classe | Gravité | Référence dans `docs/validation.md` | Statut |
| --- | --- | --- | --- | --- |
| | | | | |
