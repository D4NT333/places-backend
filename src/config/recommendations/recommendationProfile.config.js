/*
 * Fuente única de verdad del sistema de perfiles de recomendación.
 *
 * Este archivo NO consulta Firestore y NO modifica usuarios.
 * Solamente define:
 * - perfiles y subperfiles válidos;
 * - límites de puntuación;
 * - eventos que afectan el perfil;
 * - etiquetas que participan;
 * - matriz etiqueta + enfoque + subetiqueta.
 */

export const RECOMMENDATION_PROFILE_VERSION = 1;

export const RECOMMENDATION_PROFILE_DOCUMENT = {
  subcollection: "recommendationProfile",
  documentId: "current",
};

export const RECOMMENDATION_PROFILE_IDS = {
  CULINARIO: "culinario",
  RECREATIVO: "recreativo",
  INTELECTUAL: "intelectual",
};

export const RECOMMENDATION_SUBPROFILE_IDS = {
  TIPICO: "tipico",
  GOURMET: "gourmet",
  PRACTICO: "practico",

  CONVIVENCIAL: "convivencial",
  DINAMICO: "dinamico",
  DESAFIANTE: "desafiante",

  HISTORICO: "historico",
  ARTISTICO: "artistico",
};

export const RECOMMENDATION_TAG_IDS = {
  GASTRONOMIA: "gastronomia",
  ENTRETENIMIENTO: "entretenimiento",
  NATURALEZA: "naturaleza",
  APRENDIZAJE_FORMACION:
    "aprendizaje_formacion",
  DEPORTES: "deportes",
  ARTE_CULTURA: "arte_cultura",
};

export const RECOMMENDATION_APPROACH_IDS = {
  LOCAL: "local",
  PREMIUM: "premium",
  RAPIDO: "rapido",

  FAMILIAR: "familiar",
  SOCIAL: "social",

  ACTIVO: "activo",
  CASUAL: "casual",
  RECREATIVO: "recreativo",

  COMPETITIVO: "competitivo",
  LUDICO: "ludico",
  FORMATIVO: "formativo",

  CULTURAL: "cultural",
  PATRIMONIAL: "patrimonial",

  ACADEMICO: "academico",
  CREATIVO: "creativo",
};

export const RECOMMENDATION_EVENT_TYPES = {
  PLACE_VIEW: "place_view",

  LIKE_ADDED: "place_like_added",
  LIKE_REMOVED: "place_like_removed",

  REVIEW_CREATED: "place_review_created",
  REVIEW_REMOVED: "place_review_removed",

  PHOTO_PROPOSAL_CREATED:
    "place_photo_proposal_created",

  DESCRIPTION_PROPOSAL_CREATED:
    "place_description_proposal_created",

  VALID_DWELL_SESSION:
    "place_valid_dwell_session",
};

/*
 * Los valores iniciales se encuentran a la mitad de su rango.
 * De esta manera pueden subir o bajar desde la primera interacción.
 *
 * El perfil/subperfil dominante inicial se conservará aparte,
 * normalmente desde la selección inicial del usuario.
 */
export const RECOMMENDATION_SCORE_LIMITS = {
  profile: {
    min: 1,
    max: 20,
    initial: 10,
  },

  subprofile: {
    min: 1,
    max: 5,
    initial: 3,
  },
};

export const RECOMMENDATION_DWELL_CONFIG = {
  minimumValidSeconds: 30,
};

/*
 * Peso positivo: acerca al usuario al perfil del lugar.
 * Peso negativo: revierte una interacción positiva anterior.
 */
export const RECOMMENDATION_EVENT_IMPACTS = {
  [RECOMMENDATION_EVENT_TYPES.PLACE_VIEW]: {
    weight: 0.10,
    direction: 1,
    reversible: false,
  },

  [RECOMMENDATION_EVENT_TYPES.LIKE_ADDED]: {
    weight: 0.25,
    direction: 1,
    reversible: true,
  },

  [RECOMMENDATION_EVENT_TYPES.LIKE_REMOVED]: {
    weight: 0.25,
    direction: -1,
    reverses:
      RECOMMENDATION_EVENT_TYPES.LIKE_ADDED,
    reversible: false,
  },

  [RECOMMENDATION_EVENT_TYPES.REVIEW_CREATED]: {
    weight: 0.20,
    direction: 1,
    reversible: true,
  },

  [RECOMMENDATION_EVENT_TYPES.REVIEW_REMOVED]: {
    weight: 0.20,
    direction: -1,
    reverses:
      RECOMMENDATION_EVENT_TYPES.REVIEW_CREATED,
    reversible: false,
  },

  [
    RECOMMENDATION_EVENT_TYPES
      .PHOTO_PROPOSAL_CREATED
  ]: {
    weight: 0.18,
    direction: 1,
    reversible: false,
  },

  [
    RECOMMENDATION_EVENT_TYPES
      .DESCRIPTION_PROPOSAL_CREATED
  ]: {
    weight: 0.15,
    direction: 1,
    reversible: false,
  },

  [
    RECOMMENDATION_EVENT_TYPES
      .VALID_DWELL_SESSION
  ]: {
    weight: 0.12,
    direction: 1,
    reversible: false,
  },
};

export const RECOMMENDATION_PROFILE_DEFINITIONS = {
  [RECOMMENDATION_PROFILE_IDS.CULINARIO]: {
    id: RECOMMENDATION_PROFILE_IDS.CULINARIO,
    label: "Culinario",

    subprofileIds: [
      RECOMMENDATION_SUBPROFILE_IDS.TIPICO,
      RECOMMENDATION_SUBPROFILE_IDS.GOURMET,
      RECOMMENDATION_SUBPROFILE_IDS.PRACTICO,
    ],
  },

  [RECOMMENDATION_PROFILE_IDS.RECREATIVO]: {
    id: RECOMMENDATION_PROFILE_IDS.RECREATIVO,
    label: "Recreativo",

    subprofileIds: [
      RECOMMENDATION_SUBPROFILE_IDS.CONVIVENCIAL,
      RECOMMENDATION_SUBPROFILE_IDS.DINAMICO,
      RECOMMENDATION_SUBPROFILE_IDS.DESAFIANTE,
    ],
  },

  [RECOMMENDATION_PROFILE_IDS.INTELECTUAL]: {
    id: RECOMMENDATION_PROFILE_IDS.INTELECTUAL,
    label: "Intelectual",

    subprofileIds: [
      RECOMMENDATION_SUBPROFILE_IDS.HISTORICO,
      RECOMMENDATION_SUBPROFILE_IDS.ARTISTICO,
    ],
  },
};

export const RECOMMENDATION_SUBPROFILE_DEFINITIONS = {
  [RECOMMENDATION_SUBPROFILE_IDS.TIPICO]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.TIPICO,
    label: "Típico",
    profileId:
      RECOMMENDATION_PROFILE_IDS.CULINARIO,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.GOURMET]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.GOURMET,
    label: "Gourmet",
    profileId:
      RECOMMENDATION_PROFILE_IDS.CULINARIO,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.PRACTICO]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.PRACTICO,
    label: "Práctico",
    profileId:
      RECOMMENDATION_PROFILE_IDS.CULINARIO,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.CONVIVENCIAL]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.CONVIVENCIAL,
    label: "Convivencial",
    profileId:
      RECOMMENDATION_PROFILE_IDS.RECREATIVO,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.DINAMICO]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.DINAMICO,
    label: "Dinámico",
    profileId:
      RECOMMENDATION_PROFILE_IDS.RECREATIVO,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.DESAFIANTE]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.DESAFIANTE,
    label: "Desafiante",
    profileId:
      RECOMMENDATION_PROFILE_IDS.RECREATIVO,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.HISTORICO]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.HISTORICO,
    label: "Histórico",
    profileId:
      RECOMMENDATION_PROFILE_IDS.INTELECTUAL,
  },

  [RECOMMENDATION_SUBPROFILE_IDS.ARTISTICO]: {
    id: RECOMMENDATION_SUBPROFILE_IDS.ARTISTICO,
    label: "Artístico",
    profileId:
      RECOMMENDATION_PROFILE_IDS.INTELECTUAL,
  },
};

export const RECOMMENDATION_ELIGIBLE_TAG_IDS = [
  RECOMMENDATION_TAG_IDS.GASTRONOMIA,
  RECOMMENDATION_TAG_IDS.ENTRETENIMIENTO,
  RECOMMENDATION_TAG_IDS.NATURALEZA,
  RECOMMENDATION_TAG_IDS.APRENDIZAJE_FORMACION,
  RECOMMENDATION_TAG_IDS.DEPORTES,
  RECOMMENDATION_TAG_IDS.ARTE_CULTURA,
];

/*
 * Algunos catálogos históricos utilizan nombres ligeramente
 * diferentes. El resolver normalizará primero el texto y después
 * aplicará estos alias.
 */
export const RECOMMENDATION_VALUE_ALIASES = {
 tags: {
  /*
   * IDs reales del catálogo Firestore.
   */
  gastronomy:
    RECOMMENDATION_TAG_IDS.GASTRONOMIA,

  entertainment:
    RECOMMENDATION_TAG_IDS.ENTRETENIMIENTO,

  nature:
    RECOMMENDATION_TAG_IDS.NATURALEZA,

  learning:
    RECOMMENDATION_TAG_IDS.APRENDIZAJE_FORMACION,

  sport:
    RECOMMENDATION_TAG_IDS.DEPORTES,

  art:
    RECOMMENDATION_TAG_IDS.ARTE_CULTURA,

  /*
   * Labels y nombres históricos.
   */
  gastronomia:
    RECOMMENDATION_TAG_IDS.GASTRONOMIA,

  entretenimiento:
    RECOMMENDATION_TAG_IDS.ENTRETENIMIENTO,

  naturaleza:
    RECOMMENDATION_TAG_IDS.NATURALEZA,

  aprendizaje_y_formacion:
    RECOMMENDATION_TAG_IDS.APRENDIZAJE_FORMACION,

  aprendizaje_formacion:
    RECOMMENDATION_TAG_IDS.APRENDIZAJE_FORMACION,

  deportes:
    RECOMMENDATION_TAG_IDS.DEPORTES,

  arte_y_cultura:
    RECOMMENDATION_TAG_IDS.ARTE_CULTURA,

  arte_cultura:
    RECOMMENDATION_TAG_IDS.ARTE_CULTURA,
},

  subtags: {
    pizzas: "pizza",
    pizza: "pizza",

    pollos: "pollo",
    pollo: "pollo",

    universidade: "universidad",
    universidad: "universidad",

    heladeria: "heladeria",

    birrieria: "birrieria",
  },

  approaches: {
    academico: RECOMMENDATION_APPROACH_IDS.ACADEMICO,
    rapido: RECOMMENDATION_APPROACH_IDS.RAPIDO,
    ludico: RECOMMENDATION_APPROACH_IDS.LUDICO,
  },
};

/*
 * Matriz oficial de discriminadores.
 *
 * Estructura:
 * etiqueta -> enfoque -> perfil/subperfil + subetiquetas válidas.
 *
 * Un lugar coincide con una regla cuando:
 * 1. su etiqueta coincide;
 * 2. contiene el enfoque de la regla;
 * 3. al menos una de sus subetiquetas aparece en allowedSubtagIds.
 */
export const RECOMMENDATION_SEGMENTATION_MATRIX = {
  [RECOMMENDATION_TAG_IDS.GASTRONOMIA]: {
    [RECOMMENDATION_APPROACH_IDS.LOCAL]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.CULINARIO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.TIPICO,

      allowedSubtagIds: [
        "mexicana",
        "japonesa",
        "cenaduria",
        "cortes_de_carne",
        "tacos",
        "mariscos",
        "birrieria",
        "pollo",
        "sushi",
        "hot_dogs",
        "tortas_lonches",
        "cafeteria",
        "heladeria",
        "reposteria",
        "desayunos",
        "panaderia",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.PREMIUM]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.CULINARIO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.GOURMET,

      allowedSubtagIds: [
        "mexicana",
        "italiana",
        "china",
        "japonesa",
        "coreana",
        "buffet",
        "cenaduria",
        "cortes_de_carne",
        "tacos",
        "mariscos",
        "pizza",
        "sushi",
        "hamburguesas",
        "alitas",
        "cafeteria",
        "heladeria",
        "reposteria",
        "ensaladas",
        "desayunos",
        "panaderia",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.RAPIDO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.CULINARIO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.PRACTICO,

      allowedSubtagIds: [
        "mexicana",
        "italiana",
        "china",
        "buffet",
        "cenaduria",
        "tacos",
        "mariscos",
        "birrieria",
        "pizza",
        "pollo",
        "sushi",
        "hamburguesas",
        "hot_dogs",
        "alitas",
        "tortas_lonches",
        "ensaladas",
        "desayunos",
      ],
    },
  },

  [RECOMMENDATION_TAG_IDS.ENTRETENIMIENTO]: {
    [RECOMMENDATION_APPROACH_IDS.FAMILIAR]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.CONVIVENCIAL,

      allowedSubtagIds: [
        "cine",
        "teatro",
        "musica_en_vivo",
        "billar",
        "karaoke",
        "parque_de_diversiones",
        "zoologico",
        "trampolines",
        "boliche",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.SOCIAL]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.CONVIVENCIAL,

      allowedSubtagIds: [
        "foro",
        "musica_en_vivo",
        "bar",
        "billar",
        "karaoke",
        "parque_de_diversiones",
        "zoologico",
        "club_nocturno",
        "trampolines",
        "boliche",
      ],
    },
  },

  [RECOMMENDATION_TAG_IDS.NATURALEZA]: {
    [RECOMMENDATION_APPROACH_IDS.ACTIVO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.DINAMICO,

      allowedSubtagIds: [
        "bosque_sendero",
        "parque",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.CASUAL]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.CONVIVENCIAL,

      allowedSubtagIds: [
        "parque",
        "jardin",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.RECREATIVO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.DINAMICO,

      allowedSubtagIds: [
        "mirador",
        "bosque_sendero",
        "parque",
        "jardin",
      ],
    },
  },

  [RECOMMENDATION_TAG_IDS.DEPORTES]: {
    [RECOMMENDATION_APPROACH_IDS.COMPETITIVO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.DESAFIANTE,

      allowedSubtagIds: [
        "danza_baile",
        "futbol",
        "skatepark",
        "pista_para_correr",
        "padel",
        "natacion",
        "ciclismo",
        "artes_marciales",
        "club_deportivo",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.LUDICO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.DINAMICO,

      allowedSubtagIds: [
        "danza_baile",
        "gimnasio",
        "futbol",
        "skatepark",
        "pista_para_correr",
        "natacion",
        "ciclismo",
        "yoga",
        "rehabilitacion_fisica",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.FORMATIVO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.RECREATIVO,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.DESAFIANTE,

      allowedSubtagIds: [
        "danza_baile",
        "futbol",
        "pista_para_correr",
        "padel",
        "natacion",
        "artes_marciales",
        "yoga",
        "club_deportivo",
        "rehabilitacion_fisica",
      ],
    },
  },

  [RECOMMENDATION_TAG_IDS.ARTE_CULTURA]: {
    [RECOMMENDATION_APPROACH_IDS.CULTURAL]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.INTELECTUAL,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.ARTISTICO,

      allowedSubtagIds: [
        "galeria",
        "zona_historica",
        "arte_urbano_murales",
        "edificio_historico",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.PATRIMONIAL]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.INTELECTUAL,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.HISTORICO,

      allowedSubtagIds: [
        "museo",
        "templo",
        "monumento",
        "galeria",
        "zona_historica",
        "arte_urbano_murales",
        "edificio_historico",
      ],
    },
  },

  [
    RECOMMENDATION_TAG_IDS
      .APRENDIZAJE_FORMACION
  ]: {
    [RECOMMENDATION_APPROACH_IDS.ACADEMICO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.INTELECTUAL,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.HISTORICO,

      allowedSubtagIds: [
        "biblioteca",
        "escuela",
        "universidad",
        "idiomas",
        "taller_artistico",
        "escuela_de_musica",
        "pintura_y_dibujo",
      ],
    },

    [RECOMMENDATION_APPROACH_IDS.CREATIVO]: {
      profileId:
        RECOMMENDATION_PROFILE_IDS.INTELECTUAL,

      subprofileId:
        RECOMMENDATION_SUBPROFILE_IDS.ARTISTICO,

      allowedSubtagIds: [
        "taller_artistico",
        "escuela_de_musica",
        "pintura_y_dibujo",
      ],
    },
  },
};

export const RECOMMENDATION_PROFILE_CONFIG = {
  version: RECOMMENDATION_PROFILE_VERSION,

  document: RECOMMENDATION_PROFILE_DOCUMENT,

  profileIds: RECOMMENDATION_PROFILE_IDS,
  subprofileIds: RECOMMENDATION_SUBPROFILE_IDS,
  tagIds: RECOMMENDATION_TAG_IDS,
  approachIds: RECOMMENDATION_APPROACH_IDS,
  eventTypes: RECOMMENDATION_EVENT_TYPES,

  scoreLimits: RECOMMENDATION_SCORE_LIMITS,
  dwell: RECOMMENDATION_DWELL_CONFIG,
  eventImpacts: RECOMMENDATION_EVENT_IMPACTS,

  profiles: RECOMMENDATION_PROFILE_DEFINITIONS,
  subprofiles:
    RECOMMENDATION_SUBPROFILE_DEFINITIONS,

  eligibleTagIds:
    RECOMMENDATION_ELIGIBLE_TAG_IDS,

  aliases: RECOMMENDATION_VALUE_ALIASES,

  segmentationMatrix:
    RECOMMENDATION_SEGMENTATION_MATRIX,
};

export default RECOMMENDATION_PROFILE_CONFIG;
