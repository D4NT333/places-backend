import resolvePlaceRecommendationTargetService from "./resolvePlaceRecommendationTarget.service.js";

const FEED_PAGE_SIZE = 20;

const PAGE_DISTRIBUTIONS = [
  {
    subprofile: 8,
    profile: 7,
    exploration: 5,
  },
  {
    subprofile: 7,
    profile: 7,
    exploration: 6,
  },
];

const DEFAULT_DISTRIBUTION = {
  subprofile: 6,
  profile: 6,
  exploration: 8,
};

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getDistribution(pageIndex) {
  return (
    PAGE_DISTRIBUTIONS[pageIndex] ||
    DEFAULT_DISTRIBUTION
  );
}

function getCandidatePlace(candidate) {
  if (
    !candidate?.document ||
    typeof candidate.document.data !==
      "function"
  ) {
    return null;
  }

  const place =
    candidate.document.data();

  return {
    ...place,

    id:
      candidate.document.id,

    placeId:
      cleanText(
        place?.placeId,
      ) ||
      candidate.document.id,
  };
}

function takeFromQueue(
  queue,
  amount,
) {
  if (
    !Array.isArray(queue) ||
    amount <= 0
  ) {
    return [];
  }

  return queue.splice(
    0,
    amount,
  );
}

function fillPage({
  page,
  queues,
}) {
  if (
    page.length >=
    FEED_PAGE_SIZE
  ) {
    return page;
  }

  /*
   * Cuando un grupo no tiene suficientes lugares,
   * rellenamos con los grupos restantes.
   *
   * El orden favorece:
   * 1. subperfil;
   * 2. perfil;
   * 3. exploración.
   */
  const refillOrder = [
    queues.subprofile,
    queues.profile,
    queues.exploration,
  ];

  for (
    const queue of refillOrder
  ) {
    const missing =
      FEED_PAGE_SIZE -
      page.length;

    if (missing <= 0) {
      break;
    }

    page.push(
      ...takeFromQueue(
        queue,
        missing,
      ),
    );
  }

  return page;
}

function classifyCandidates({
  candidates,
  dominantProfileId,
  dominantSubprofileId,
}) {
  const groups = {
    subprofile: [],
    profile: [],
    exploration: [],
  };

  candidates.forEach(
    (candidate) => {
      const place =
        getCandidatePlace(
          candidate,
        );

      if (!place) {
        return;
      }

      const resolution =
        resolvePlaceRecommendationTargetService(
          place,
        );

      const target =
        resolution?.target ||
        null;

      /*
       * El candidato ya viene ordenado por distancia.
       * Al agregarlo a estas colas conservamos ese
       * orden dentro de cada grupo.
       */
      if (
        resolution?.eligible &&
        target?.profileId ===
          dominantProfileId &&
        target?.subprofileId ===
          dominantSubprofileId
      ) {
        groups.subprofile.push(
          candidate,
        );

        return;
      }

      /*
       * Coincide con el perfil, pero no con el
       * subperfil dominante.
       */
      if (
        resolution?.eligible &&
        target?.profileId ===
          dominantProfileId
      ) {
        groups.profile.push(
          candidate,
        );

        return;
      }

      /*
       * Incluye:
       * - otros perfiles;
       * - etiquetas sin perfil;
       * - Compras;
       * - Hospedaje;
       * - Servicios;
       * - lugares sin una combinación completa.
       */
      groups.exploration.push(
        candidate,
      );
    },
  );

  return groups;
}

export default function buildPersonalizedFeedOrderService({
  candidates,
  recommendationProfile,
}) {
  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    return [];
  }

  const dominantProfileId =
    cleanText(
      recommendationProfile
        ?.dominantProfileId,
    );

  const dominantSubprofileId =
    cleanText(
      recommendationProfile
        ?.dominantSubprofileId,
    );

  /*
   * Usuario sin perfil disponible:
   * conservamos exactamente el orden por distancia.
   */
  if (
    !dominantProfileId ||
    !dominantSubprofileId
  ) {
    return [
      ...candidates,
    ];
  }

  const groups =
    classifyCandidates({
      candidates,

      dominantProfileId,
      dominantSubprofileId,
    });

  const queues = {
    subprofile: [
      ...groups.subprofile,
    ],

    profile: [
      ...groups.profile,
    ],

    exploration: [
      ...groups.exploration,
    ],
  };

  const orderedCandidates = [];

  let pageIndex = 0;

  while (
    queues.subprofile.length >
      0 ||
    queues.profile.length >
      0 ||
    queues.exploration.length >
      0
  ) {
    const distribution =
      getDistribution(
        pageIndex,
      );

    const page = [
      ...takeFromQueue(
        queues.subprofile,
        distribution.subprofile,
      ),

      ...takeFromQueue(
        queues.profile,
        distribution.profile,
      ),

      ...takeFromQueue(
        queues.exploration,
        distribution.exploration,
      ),
    ];

    fillPage({
      page,
      queues,
    });

    orderedCandidates.push(
      ...page,
    );

    pageIndex += 1;
  }

  return orderedCandidates;
}