const EPSILON = 0.0000001;
const SCORE_DECIMALS = 6;

function roundScore(value) {
  return Number(
    Number(value).toFixed(SCORE_DECIMALS),
  );
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max,
  );
}

function normalizeScore(value, fallback, min, max) {
  const parsed = Number(value);

  return clamp(
    Number.isFinite(parsed) ? parsed : fallback,
    min,
    max,
  );
}

function normalizeScores({
  scores,
  scoreIds,
  initial,
  min,
  max,
}) {
  return scoreIds.reduce((result, scoreId) => {
    result[scoreId] = roundScore(
      normalizeScore(
        scores?.[scoreId],
        initial,
        min,
        max,
      ),
    );

    return result;
  }, {});
}

function sumValues(values) {
  return values.reduce(
    (total, value) => total + value,
    0,
  );
}

/*
 * Reparte un monto entre varios IDs respetando su capacidad.
 * Si se proporcionan pesos preferidos, intenta conservarlos.
 * Cuando alguno llega a su límite, reparte el sobrante entre
 * los demás participantes.
 */
function allocateWithCapacities({
  ids,
  amount,
  capacities,
  preferredWeights = null,
}) {
  const allocations = ids.reduce(
    (result, id) => {
      result[id] = 0;
      return result;
    },
    {},
  );

  let remaining = Math.max(Number(amount) || 0, 0);
  let activeIds = ids.filter(
    (id) => (capacities[id] || 0) > EPSILON,
  );

  while (
    remaining > EPSILON &&
    activeIds.length
  ) {
    const rawWeights = activeIds.reduce(
      (result, id) => {
        const preferred = Number(
          preferredWeights?.[id],
        );

        result[id] =
          Number.isFinite(preferred) &&
          preferred > EPSILON
            ? preferred
            : capacities[id] - allocations[id];

        return result;
      },
      {},
    );

    let totalWeight = sumValues(
      activeIds.map((id) => rawWeights[id]),
    );

    if (totalWeight <= EPSILON) {
      activeIds.forEach((id) => {
        rawWeights[id] = 1;
      });

      totalWeight = activeIds.length;
    }

    let distributedThisRound = 0;

    activeIds.forEach((id) => {
      const available = Math.max(
        capacities[id] - allocations[id],
        0,
      );

      const proportionalAmount =
        remaining *
        (rawWeights[id] / totalWeight);

      const assigned = Math.min(
        proportionalAmount,
        available,
      );

      allocations[id] += assigned;
      distributedThisRound += assigned;
    });

    if (distributedThisRound <= EPSILON) {
      break;
    }

    remaining -= distributedThisRound;

    activeIds = activeIds.filter(
      (id) =>
        capacities[id] - allocations[id] >
        EPSILON,
    );
  }

  /*
   * Corrige residuos diminutos por coma flotante.
   */
  if (remaining > EPSILON) {
    for (const id of ids) {
      const available = Math.max(
        capacities[id] - allocations[id],
        0,
      );

      if (available <= EPSILON) {
        continue;
      }

      const assigned = Math.min(
        remaining,
        available,
      );

      allocations[id] += assigned;
      remaining -= assigned;

      if (remaining <= EPSILON) {
        break;
      }
    }
  }

  Object.keys(allocations).forEach((id) => {
    allocations[id] = roundScore(
      allocations[id],
    );
  });

  return allocations;
}

function buildEmptyDeltas(scoreIds) {
  return scoreIds.reduce((result, scoreId) => {
    result[scoreId] = 0;
    return result;
  }, {});
}

export function moveScoresTowardTarget({
  scores,
  scoreIds,
  targetId,
  requestedWeight,
  limits,
}) {
  const normalizedScores = normalizeScores({
    scores,
    scoreIds,
    initial: limits.initial,
    min: limits.min,
    max: limits.max,
  });

  const deltas = buildEmptyDeltas(scoreIds);

  if (!scoreIds.includes(targetId)) {
    return {
      scores: normalizedScores,
      deltas,
      appliedWeight: 0,
    };
  }

  const donorIds = scoreIds.filter(
    (scoreId) => scoreId !== targetId,
  );

  const targetCapacity = Math.max(
    limits.max - normalizedScores[targetId],
    0,
  );

  const donorCapacities = donorIds.reduce(
    (result, donorId) => {
      result[donorId] = Math.max(
        normalizedScores[donorId] -
          limits.min,
        0,
      );

      return result;
    },
    {},
  );

  const totalDonorCapacity = sumValues(
    Object.values(donorCapacities),
  );

  const appliedWeight = roundScore(
    Math.min(
      Math.max(Number(requestedWeight) || 0, 0),
      targetCapacity,
      totalDonorCapacity,
    ),
  );

  if (appliedWeight <= EPSILON) {
    return {
      scores: normalizedScores,
      deltas,
      appliedWeight: 0,
    };
  }

  const donorAllocations =
    allocateWithCapacities({
      ids: donorIds,
      amount: appliedWeight,
      capacities: donorCapacities,
    });

  const nextScores = {
    ...normalizedScores,
    [targetId]: roundScore(
      normalizedScores[targetId] +
        appliedWeight,
    ),
  };

  deltas[targetId] = appliedWeight;

  donorIds.forEach((donorId) => {
    const donated = donorAllocations[donorId];

    nextScores[donorId] = roundScore(
      normalizedScores[donorId] - donated,
    );

    deltas[donorId] = roundScore(-donated);
  });

  return {
    scores: nextScores,
    deltas,
    appliedWeight,
  };
}

export function moveScoresAwayFromTarget({
  scores,
  scoreIds,
  targetId,
  requestedWeight,
  limits,
  preferredRecipientWeights = null,
}) {
  const normalizedScores = normalizeScores({
    scores,
    scoreIds,
    initial: limits.initial,
    min: limits.min,
    max: limits.max,
  });

  const deltas = buildEmptyDeltas(scoreIds);

  if (!scoreIds.includes(targetId)) {
    return {
      scores: normalizedScores,
      deltas,
      appliedWeight: 0,
    };
  }

  const recipientIds = scoreIds.filter(
    (scoreId) => scoreId !== targetId,
  );

  const targetAvailable = Math.max(
    normalizedScores[targetId] - limits.min,
    0,
  );

  const recipientCapacities =
    recipientIds.reduce((result, recipientId) => {
      result[recipientId] = Math.max(
        limits.max -
          normalizedScores[recipientId],
        0,
      );

      return result;
    }, {});

  const totalRecipientCapacity = sumValues(
    Object.values(recipientCapacities),
  );

  const appliedWeight = roundScore(
    Math.min(
      Math.max(Number(requestedWeight) || 0, 0),
      targetAvailable,
      totalRecipientCapacity,
    ),
  );

  if (appliedWeight <= EPSILON) {
    return {
      scores: normalizedScores,
      deltas,
      appliedWeight: 0,
    };
  }

  const recipientAllocations =
    allocateWithCapacities({
      ids: recipientIds,
      amount: appliedWeight,
      capacities: recipientCapacities,
      preferredWeights:
        preferredRecipientWeights,
    });

  const nextScores = {
    ...normalizedScores,
    [targetId]: roundScore(
      normalizedScores[targetId] -
        appliedWeight,
    ),
  };

  deltas[targetId] = roundScore(
    -appliedWeight,
  );

  recipientIds.forEach((recipientId) => {
    const received =
      recipientAllocations[recipientId];

    nextScores[recipientId] = roundScore(
      normalizedScores[recipientId] +
        received,
    );

    deltas[recipientId] = received;
  });

  return {
    scores: nextScores,
    deltas,
    appliedWeight,
  };
}
