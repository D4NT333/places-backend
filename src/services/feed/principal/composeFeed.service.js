export async function composeNearbyFeedService({ latitude, longitude }) {
  return {
    userLocation: {
      latitude,
      longitude,
    },
    places: [],
  };
}