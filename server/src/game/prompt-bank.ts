import type { DrawingPrompt } from "./game-types.js";

export const DRAWING_PROMPTS = [
  {
    id: "octopus-elegance",
    statement:
      "Une pieuvre est invitée à un gala sous-marin. Imaginez et dessinez sa tenue, du vieux torchon noué à la robe royale.",
    lowLabel: "Torchon noué",
    highLabel: "Robe royale",
    category: "élégance",
  },
  {
    id: "cabin-comfort",
    statement:
      "Vous devez dormir dans une cabane perdue en forêt. Montrez son intérieur, de l’abri plein de courants d’air au chalet cinq étoiles.",
    lowLabel: "Abri inconfortable",
    highLabel: "Chalet cinq étoiles",
    category: "confort",
  },
  {
    id: "dragon-power",
    statement:
      "Un dragon garde le dernier trésor du royaume. Dessinez-le, du petit lézard qui peine à fumer au colosse qui fait trembler la forteresse.",
    lowLabel: "Petit lézard fumant",
    highLabel: "Colosse de la forteresse",
    category: "puissance",
  },
  {
    id: "penguin-suspicion",
    statement:
      "Un pingouin tente de passer la douane avec une valise mystérieuse. Montrez-le, du voyageur parfaitement innocent au suspect numéro un.",
    lowLabel: "Voyageur innocent",
    highLabel: "Suspect numéro un",
    category: "suspicion",
  },
  {
    id: "train-speed",
    statement:
      "Une course ferroviaire traverse montagnes et nuages. À quoi ressemble le train engagé, de la locomotive poussive à l’éclair sur rails ?",
    lowLabel: "Locomotive poussive",
    highLabel: "Éclair sur rails",
    category: "vitesse",
  },
  {
    id: "sandwich-appetite",
    statement:
      "Un restaurant douteux présente son nouveau sandwich vedette. Créez-le, du casse-croûte qui coupe l’appétit au festin irrésistible.",
    lowLabel: "Sandwich repoussant",
    highLabel: "Festin irrésistible",
    category: "appétit",
  },
  {
    id: "lamp-modernity",
    statement:
      "Un inventeur équipe la maison de demain. Imaginez sa lampe, de la bougie rafistolée au luminaire piloté par un robot.",
    lowLabel: "Bougie rafistolée",
    highLabel: "Luminaire robotisé",
    category: "modernité",
  },
  {
    id: "witch-kindness",
    statement:
      "Un enfant perdu frappe à la porte d’une sorcière. Montrez son accueil, de la porte hérissée de pièges au refuge avec chocolat chaud.",
    lowLabel: "Porte piégée",
    highLabel: "Refuge chaleureux",
    category: "gentillesse",
  },
  {
    id: "island-danger",
    statement:
      "Une île inconnue apparaît sur une carte de pirate. À quoi ressemblent ses côtes, de la plage paisible aux volcans, requins et pièges ?",
    lowLabel: "Plage paisible",
    highLabel: "Île pleine de pièges",
    category: "danger",
  },
  {
    id: "slipper-luxury",
    statement:
      "Une pantoufle unique trône dans la vitrine d’une boutique chic. Créez-la, de la savate élimée au chausson serti de joyaux.",
    lowLabel: "Savate élimée",
    highLabel: "Chausson à joyaux",
    category: "luxe",
  },
  {
    id: "alien-strangeness",
    statement:
      "Un extraterrestre participe à un concours de normalité terrienne. Imaginez son portrait, du voisin presque banal à la créature aux quinze yeux fluorescents.",
    lowLabel: "Voisin presque banal",
    highLabel: "Créature à quinze yeux",
    category: "étrangeté",
  },
  {
    id: "vampire-fear",
    statement:
      "Un vampire passe une audition pour hanter un vieux château. Montrez-le, du figurant aux canines en carton à la terreur dont l’ombre envahit les murs.",
    lowLabel: "Canines en carton",
    highLabel: "Terreur du château",
    category: "peur",
  },
  {
    id: "duck-humour",
    statement:
      "Un canard monte sur scène pour son premier spectacle comique. Montrez son numéro, du silence gêné au fou rire général.",
    lowLabel: "Silence gêné",
    highLabel: "Fou rire général",
    category: "humour",
  },
  {
    id: "cloud-sadness",
    statement:
      "Un nuage vient de vivre la pire journée de sa vie. À quoi ressemble-t-il, du petit coup de blues à l’orage de larmes inconsolable ?",
    lowLabel: "Petit coup de blues",
    highLabel: "Orage de larmes",
    category: "tristesse",
  },
  {
    id: "bicycle-intelligence",
    statement:
      "Un ingénieur transforme un simple vélo en compagnon de route. Équipez-le, de la sonnette montée à l’envers aux capteurs qui évitent tous les obstacles.",
    lowLabel: "Sonnette à l’envers",
    highLabel: "Vélo plein de capteurs",
    category: "ingéniosité",
  },
  {
    id: "crown-elegance",
    statement:
      "Le royaume cherche une couronne pour sa prochaine cérémonie. Créez-la, du cercle de carton cabossé au chef-d’œuvre impérial finement ciselé.",
    lowLabel: "Couronne en carton",
    highLabel: "Couronne impériale",
    category: "élégance",
  },
  {
    id: "sofa-comfort",
    statement:
      "Vous devez regarder un marathon de films sans quitter le canapé. À quoi ressemble-t-il, de la planche qui grince au nuage de coussins ?",
    lowLabel: "Planche qui grince",
    highLabel: "Nuage de coussins",
    category: "confort",
  },
  {
    id: "hamster-power",
    statement:
      "Un hamster rêve d’intégrer une équipe de super-héros. Imaginez son costume, de la cape en mouchoir à l’armure capable de soulever une voiture.",
    lowLabel: "Cape en mouchoir",
    highLabel: "Armure surpuissante",
    category: "puissance",
  },
  {
    id: "detective-suspicion",
    statement:
      "Un détective mène une filature sans vouloir être remarqué. Créez son déguisement, du passant discret à l’espion fluo armé d’une loupe géante.",
    lowLabel: "Passant discret",
    highLabel: "Espion fluo",
    category: "suspicion",
  },
  {
    id: "rocket-speed",
    statement:
      "Une fusée doit livrer une pizza à l’autre bout de la galaxie. À quoi ressemble-t-elle, du vieux coucou spatial au bolide qui sème les étoiles ?",
    lowLabel: "Coucou spatial",
    highLabel: "Bolide interstellaire",
    category: "vitesse",
  },
  {
    id: "soup-appetite",
    statement:
      "Un grand restaurant dévoile sa soupe signature sous une cloche d’argent. Composez le bol, du bouillon où flotte une chaussette au velouté d’un banquet royal.",
    lowLabel: "Bouillon à la chaussette",
    highLabel: "Velouté royal",
    category: "appétit",
  },
  {
    id: "school-modernity",
    statement:
      "Une école ouvre ses portes après un étrange voyage dans le temps. Imaginez-la, de la classe à la bougie au campus rempli de robots.",
    lowLabel: "Classe à la bougie",
    highLabel: "Campus robotisé",
    category: "modernité",
  },
  {
    id: "goblin-cuteness",
    statement:
      "Un gobelin s’inscrit à un concours de créatures adorables. Créez son meilleur look, du monstre couvert de verrues à la mascotte que le jury veut câliner.",
    lowLabel: "Monstre hideux",
    highLabel: "Mascotte à câliner",
    category: "mignonnerie",
  },
  {
    id: "bridge-danger",
    statement:
      "Un aventurier doit franchir le seul pont au-dessus d’un ravin. À quoi ressemble-t-il, de la passerelle solide aux trois planches prêtes à céder ?",
    lowLabel: "Passerelle solide",
    highLabel: "Trois planches fragiles",
    category: "danger",
  },
  {
    id: "tent-luxury",
    statement:
      "Un camping veut décrocher cinq étoiles grâce à une tente exceptionnelle. Concevez-la, de la bâche trouée au palace de toile avec lit à baldaquin.",
    lowLabel: "Bâche trouée",
    highLabel: "Palace sous la toile",
    category: "luxe",
  },
  {
    id: "fish-strangeness",
    statement:
      "Un pêcheur remonte un poisson encore absent de tous les livres. À quoi ressemble sa découverte, du nageur ordinaire à la créature avec pattes, antennes et lumière ?",
    lowLabel: "Poisson ordinaire",
    highLabel: "Merveille des abysses",
    category: "étrangeté",
  },
  {
    id: "scarecrow-fear",
    statement:
      "Les oiseaux organisent un concours d’épouvantails. Créez le candidat, de la peluche où ils font la sieste au gardien qui les fait tous fuir.",
    lowLabel: "Peluche pour oiseaux",
    highLabel: "Terreur des oiseaux",
    category: "peur",
  },
  {
    id: "king-humour",
    statement:
      "Le roi doit divertir toute sa cour avant le dessert. Montrez sa prestation, de la blague qui endort les gardes au gag qui fait voler les perruques de rire.",
    lowLabel: "Gardes endormis",
    highLabel: "Cour hilare",
    category: "humour",
  },
  {
    id: "sun-sadness",
    statement:
      "Le soleil apprend que ses vacances sont annulées. Montrez son visage, du rayon encore joyeux à l’astre si triste qu’il fait pleuvoir en plein midi.",
    lowLabel: "Rayon encore joyeux",
    highLabel: "Soleil inconsolable",
    category: "tristesse",
  },
  {
    id: "backpack-intelligence",
    statement:
      "Un explorateur commande un sac à dos pour résoudre tous ses problèmes. Inventez ses fonctions, de la poche qui perd tout au sac qui éclaire et déplie un abri.",
    lowLabel: "Poche qui perd tout",
    highLabel: "Sac qui pense à tout",
    category: "ingéniosité",
  },
  {
    id: "whale-elegance",
    statement:
      "Une baleine ouvre le grand ballet de l’océan. Imaginez son entrée, de la nageuse empêtrée dans les algues à la vedette qui fait danser les vagues.",
    lowLabel: "Empêtrée dans les algues",
    highLabel: "Vedette des océans",
    category: "élégance",
  },
  {
    id: "spaceship-comfort",
    statement:
      "Vous embarquez pour dix ans dans un vaisseau spatial. Aménagez votre cabine, du siège en métal sans fenêtre à la suite avec jardin et jacuzzi.",
    lowLabel: "Siège en métal",
    highLabel: "Suite avec jacuzzi",
    category: "confort",
  },
  {
    id: "fairy-power",
    statement:
      "Une fée passe l’examen final de magie devant un jury sévère. Imaginez son sort, de l’étincelle qui s’éteint à la tempête magique qui remplit la salle.",
    lowLabel: "Étincelle timide",
    highLabel: "Tempête magique",
    category: "puissance",
  },
  {
    id: "neighbor-suspicion",
    statement:
      "Chaque nuit, votre voisin sort avec une mystérieuse valise. Montrez-le, du promeneur en chaussons qui descend les poubelles à l’inconnu couvert de gadgets.",
    lowLabel: "Voisin sans histoire",
    highLabel: "Inconnu couvert de gadgets",
    category: "suspicion",
  },
  {
    id: "snail-speed",
    statement:
      "Un escargot s’aligne au départ d’une course automobile. Créez son bolide, de la coquille immobile couverte de mousse au pilote qui laisse une traînée de feu.",
    lowLabel: "Coquille immobile",
    highLabel: "Escargot supersonique",
    category: "vitesse",
  },
  {
    id: "planet-appetite",
    statement:
      "Des astronautes découvrent une planète qui ressemble à un dessert. À quoi ressemble-t-elle, du caillou brûlé impossible à mâcher au gâteau qui donne faim à la galaxie ?",
    lowLabel: "Caillou immangeable",
    highLabel: "Gâteau cosmique",
    category: "appétit",
  },
  {
    id: "toilet-paper-replacement",
    statement:
      "Le rayon papier toilette est vide au pire moment. Inventez votre solution de remplacement, de l’objet parfaitement inutile à l’alternative vraiment efficace.",
    lowLabel: "Objet inutile",
    highLabel: "Alternative efficace",
    category: "débrouille",
  },
  {
    id: "heroic-official-reward",
    statement:
      "La ville prépare un cadeau officiel pour remercier ses héros. Créez la récompense, du souvenir franchement ridicule au cadeau de rêve.",
    lowLabel: "Souvenir ridicule",
    highLabel: "Cadeau de rêve",
    category: "récompense",
  },
  {
    id: "unlikely-roommate",
    statement:
      "Vous devez partager une petite pièce pendant une semaine avec un personnage réel ou imaginaire. Imaginez votre colocataire, du pire choix à l’allié idéal.",
    lowLabel: "Pire colocataire",
    highLabel: "Allié idéal",
    category: "cohabitation",
  },
  {
    id: "partner-dirty-trick",
    statement:
      "Votre partenaire a préparé une sale surprise dans le salon. Montrez la scène, de la petite farce salissante au désastre ménager absolu.",
    lowLabel: "Farce salissante",
    highLabel: "Désastre ménager",
    category: "vengeance",
  },
  {
    id: "video-call-background",
    statement:
      "Un client très sérieux apparaît en visioconférence. Que se passe-t-il derrière vous, du décor presque professionnel au chaos terriblement gênant ?",
    lowLabel: "Décor professionnel",
    highLabel: "Chaos très gênant",
    category: "gêne",
  },
  {
    id: "future-diary-scene",
    statement:
      "Dix ans plus tard, vous rouvrez le journal d’une époque complètement folle. Quelle scène raconte-t-il, du premier jour paisible au deux-centième jour chaotique ?",
    lowLabel: "Jour 1 paisible",
    highLabel: "Jour 200 chaotique",
    category: "chaos",
  },
  {
    id: "face-protection-substitute",
    statement:
      "Vous devez sortir sans équipement pour protéger votre visage. Inventez votre solution improvisée, de la barrière inutile à la protection vraiment efficace.",
    lowLabel: "Barrière inutile",
    highLabel: "Protection efficace",
    category: "débrouille",
  },
  {
    id: "balcony-performance",
    statement:
      "Votre balcon devient une scène pour un spectacle improvisé. Imaginez votre numéro, de la catastrophe qui fâche les voisins au triomphe avec rappel.",
    lowLabel: "Voisins furieux",
    highLabel: "Rappel triomphal",
    category: "spectacle",
  },
  {
    id: "hamster-neighbor-revenge",
    statement:
      "Votre voisin promène son hamster vingt fois par jour sous votre balcon. Créez votre riposte, du dessin gentiment moqueur au jardin noyé sous les confettis.",
    lowLabel: "Dessin taquin",
    highLabel: "Jardin sous confettis",
    category: "vengeance",
  },
  {
    id: "toilet-paper-mummy",
    statement:
      "Un enfant a utilisé le dernier rouleau pour se déguiser en momie. Montrez votre réaction, du soupir à peine visible à la colère volcanique.",
    lowLabel: "Petit soupir",
    highLabel: "Colère volcanique",
    category: "colère",
  },
  {
    id: "suspicious-drop-reaction",
    statement:
      "Une goutte vraiment suspecte vient d’atterrir sur votre main. À quoi ressemble votre réaction, du calme olympien à la panique absolue ?",
    lowLabel: "Calme olympien",
    highLabel: "Panique absolue",
    category: "panique",
  },
  {
    id: "dramatic-president-speech",
    statement:
      "Un président doit annoncer une nouvelle dramatique en direct. Montrez sa posture, de l’orateur qui ne convainc personne au héros de cinéma.",
    lowLabel: "Aucune conviction",
    highLabel: "Posture héroïque",
    category: "conviction",
  },
  {
    id: "living-room-sport",
    statement:
      "Votre salon devient une salle de sport improvisée. Imaginez l’activité choisie, de l’exercice sans aucun dégât au mobilier entièrement dévasté.",
    lowLabel: "Salon intact",
    highLabel: "Mobilier dévasté",
    category: "dégâts",
  },
  {
    id: "unlikely-miracle-remedy",
    statement:
      "Un médecin invente un remède miracle avec un ingrédient improbable. Imaginez la potion, de la mixture impossible à avaler au délice qu’on ressert.",
    lowLabel: "Mixture imbuvable",
    highLabel: "Délice à resservir",
    category: "dégoût",
  },
  {
    id: "absurd-official-outing",
    statement:
      "Une activité absurde devient un motif officiel pour sortir. Créez-la, de l’excuse qui ne motive personne à l’événement qui remplit les rues.",
    lowLabel: "Personne ne sort",
    highLabel: "Rues bondées",
    category: "absurdité",
  },
  {
    id: "silent-video-karaoke",
    statement:
      "Le son de votre karaoké en visioconférence vient de disparaître. Montrez la prestation muette, du moment terriblement triste à la fête visible depuis l’espace.",
    lowLabel: "Moment déprimant",
    highLabel: "Fête cosmique",
    category: "fête",
  },
] as const satisfies readonly DrawingPrompt[];
