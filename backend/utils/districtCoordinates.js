// backend/utils/districtCoordinates.js
//
// Approximate coordinates (district headquarters town) for all 31
// Karnataka districts. Used ONLY for rough "how far is this market"
// estimates in the agri advisory module — NOT precise geodata, and NOT
// used anywhere in the civic complaint system (which already uses each
// complaint's own real GPS pin).
//
// A district covers a wide area, so distance-from-headquarters is an
// approximation, not a real farm-to-market distance. Good enough to
// rank "closer vs further" markets; not good enough for exact routing.

const DISTRICT_COORDINATES = {
  'Bagalkot': { lat: 16.1691, lng: 75.6636 },
  'Ballari': { lat: 15.1394, lng: 76.9214 },
  'Belagavi': { lat: 15.8497, lng: 74.4977 },
  'Bengaluru Rural': { lat: 13.2846, lng: 77.5946 },
  'Bengaluru Urban': { lat: 12.9716, lng: 77.5946 },
  'Bidar': { lat: 17.9133, lng: 77.5301 },
  'Chamarajanagar': { lat: 11.9236, lng: 76.9456 },
  'Chikkaballapur': { lat: 13.4355, lng: 77.7315 },
  'Chikkamagaluru': { lat: 13.3161, lng: 75.7720 },
  'Chitradurga': { lat: 14.2296, lng: 76.3985 },
  'Dakshina Kannada': { lat: 12.8438, lng: 75.2479 },
  'Davanagere': { lat: 14.4644, lng: 75.9932 },
  'Dharwad': { lat: 15.4589, lng: 75.0078 },
  'Gadag': { lat: 15.4167, lng: 75.6167 },
  'Hassan': { lat: 13.0072, lng: 76.1004 },
  'Haveri': { lat: 14.7936, lng: 75.4044 },
  'Kalaburagi': { lat: 17.3297, lng: 76.8343 },
  'Kodagu': { lat: 12.4244, lng: 75.7382 },
  'Kolar': { lat: 13.1370, lng: 78.1298 },
  'Koppal': { lat: 15.3547, lng: 76.1548 },
  'Mandya': { lat: 12.5242, lng: 76.8958 },
  'Mysuru': { lat: 12.2958, lng: 76.6394 },
  'Raichur': { lat: 16.2076, lng: 77.3463 },
  'Ramanagara': { lat: 12.7217, lng: 77.2812 },
  'Shivamogga': { lat: 13.9299, lng: 75.5681 },
  'Tumakuru': { lat: 13.3379, lng: 77.1173 },
  'Udupi': { lat: 13.3409, lng: 74.7421 },
  'Uttara Kannada': { lat: 14.7935, lng: 74.6975 }, // Karwar (HQ)
  'Vijayapura': { lat: 16.8302, lng: 75.7100 },
  'Vijayanagara': { lat: 15.2350, lng: 76.4600 }, // Hosapete (HQ)
  'Yadgir': { lat: 16.7681, lng: 77.1383 },
};

/** Haversine distance in km between two districts' headquarters. Returns null if either district is unknown. */
function distanceBetweenDistrictsKm(districtA, districtB) {
  const a = DISTRICT_COORDINATES[districtA];
  const b = DISTRICT_COORDINATES[districtB];
  if (!a || !b) return null;
  if (districtA === districtB) return 0;

  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

module.exports = { DISTRICT_COORDINATES, distanceBetweenDistrictsKm };