const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

const googleConfig = {
  mapsApiKey: process.env.GOOGLE_MAPS_API_KEY,

  places: {
    baseUrl: GOOGLE_PLACES_BASE_URL,
    searchNearbyEndpoint: `${GOOGLE_PLACES_BASE_URL}/places:searchNearby`,
  },
};

export function validateGoogleConfig() {
  if (!googleConfig.mapsApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY no está configurada en el archivo .env");
  }

  if (!googleConfig.places?.searchNearbyEndpoint) {
    throw new Error("Google Places searchNearbyEndpoint no está configurado");
  }
}

export default googleConfig;