/**
 * TacticsEngine.js - Military Tactical Formation & Maneuver Strategy Engine
 * Implements Command Pattern architecture for complex historical battlefield maneuvers:
 * - LineFormation & WedgeFormation
 * - SiegeCommand (Rotational Orbit Positioning)
 * - FeignedRetreatCommand (Turan Tactic: Lure, Bait & Encirclement)
 * - RaidCommand (High-velocity strike and retreat vector interpolation)
 */

// Geodesic Constant: Meters per degree latitude (approximate WGS84)
const METERS_PER_DEG_LAT = 111320;

/**
 * Helper function to calculate meters per degree longitude at a given latitude
 * @param {number} lat - Latitude in degrees
 * @returns {number} Meters per degree longitude
 */
function metersPerDegLng(lat) {
  return 111320 * Math.cos(lat * (Math.PI / 180));
}

/**
 * Calculates geodesic offset in Lat/Lng from distance in meters and bearing angle in degrees
 * @param {number} startLat 
 * @param {number} startLng 
 * @param {number} distanceMeters 
 * @param {number} bearingDeg 
 * @returns {{lat: number, lng: number}} Target coordinates
 */
export function calculateGeodesicOffset(startLat, startLng, distanceMeters, bearingDeg) {
  const bearingRad = bearingDeg * (Math.PI / 180);
  const deltaLat = (distanceMeters * Math.cos(bearingRad)) / METERS_PER_DEG_LAT;
  const deltaLng = (distanceMeters * Math.sin(bearingRad)) / metersPerDegLng(startLat);

  return {
    lat: startLat + deltaLat,
    lng: startLng + deltaLng
  };
}

/**
 * Abstract Base Command Class
 */
export class TacticalCommand {
  execute(markerMap, durationMs) {
    throw new Error('Execute method must be implemented by concrete TacticalCommand subclass');
  }
}

/**
 * 1. LineFormationCommand
 * Calculates offset positions for units in a line formation perpendicular to a leader's heading.
 */
export class LineFormationCommand extends TacticalCommand {
  /**
   * @param {Array<string>} unitIds 
   * @param {number} centerLat 
   * @param {number} centerLng 
   * @param {number} headingDeg 
   * @param {number} spacingMeters 
   */
  constructor(unitIds, centerLat, centerLng, headingDeg = 90, spacingMeters = 30) {
    super();
    this.unitIds = unitIds;
    this.centerLat = centerLat;
    this.centerLng = centerLng;
    this.headingDeg = headingDeg;
    this.spacingMeters = spacingMeters;
  }

  execute(markerMap, durationMs = 2000) {
    const N = this.unitIds.length;
    const halfCount = (N - 1) / 2;

    // Perpendicular angle for line formation
    const lineBearing = (this.headingDeg + 90) % 360;

    this.unitIds.forEach((id, index) => {
      const marker = markerMap.get(id);
      if (!marker) return;

      const offsetDistance = (index - halfCount) * this.spacingMeters;
      const targetPos = calculateGeodesicOffset(this.centerLat, this.centerLng, offsetDistance, lineBearing);
      
      marker.setHeading(this.headingDeg);
      marker.animateTo(targetPos.lat, targetPos.lng, durationMs);
    });
  }
}

/**
 * 2. WedgeFormationCommand
 * Calculates V-shaped wedge offsets relative to a apex leader unit.
 */
export class WedgeFormationCommand extends TacticalCommand {
  /**
   * @param {string} leaderUnitId 
   * @param {Array<string>} wingUnitIds 
   * @param {number} apexLat 
   * @param {number} apexLng 
   * @param {number} headingDeg 
   * @param {number} depthSpacingMeters 
   * @param {number} widthSpacingMeters 
   */
  constructor(leaderUnitId, wingUnitIds, apexLat, apexLng, headingDeg = 90, depthSpacingMeters = 40, widthSpacingMeters = 35) {
    super();
    this.leaderUnitId = leaderUnitId;
    this.wingUnitIds = wingUnitIds;
    this.apexLat = apexLat;
    this.apexLng = apexLng;
    this.headingDeg = headingDeg;
    this.depthSpacingMeters = depthSpacingMeters;
    this.widthSpacingMeters = widthSpacingMeters;
  }

  execute(markerMap, durationMs = 2000) {
    // Leader at apex
    const leaderMarker = markerMap.get(this.leaderUnitId);
    if (leaderMarker) {
      leaderMarker.setHeading(this.headingDeg);
      leaderMarker.animateTo(this.apexLat, this.apexLng, durationMs);
    }

    // Wings positioned symmetrically backwards
    const reverseBearing = (this.headingDeg + 180) % 360;
    const rightPerpendicular = (this.headingDeg + 90) % 360;
    const leftPerpendicular = (this.headingDeg + 270) % 360;

    this.wingUnitIds.forEach((id, index) => {
      const marker = markerMap.get(id);
      if (!marker) return;

      const row = Math.floor(index / 2) + 1;
      const isRight = index % 2 === 0;
      const sideBearing = isRight ? rightPerpendicular : leftPerpendicular;

      // Calculate backwards depth offset + side offset
      const depthPos = calculateGeodesicOffset(this.apexLat, this.apexLng, row * this.depthSpacingMeters, reverseBearing);
      const finalPos = calculateGeodesicOffset(depthPos.lat, depthPos.lng, row * this.widthSpacingMeters, sideBearing);

      marker.setHeading(this.headingDeg);
      marker.animateTo(finalPos.lat, finalPos.lng, durationMs);
    });
  }
}

/**
 * 3. SiegeCommand
 * Positions besieging units on a rotational orbit around a center target coordinate.
 */
export class SiegeCommand extends TacticalCommand {
  /**
   * @param {Array<string>} unitIds 
   * @param {number} targetLat 
   * @param {number} targetLng 
   * @param {number} radiusMeters 
   */
  constructor(unitIds, targetLat, targetLng, radiusMeters = 800) {
    super();
    this.unitIds = unitIds;
    this.targetLat = targetLat;
    this.targetLng = targetLng;
    this.radiusMeters = radiusMeters;
  }

  execute(markerMap, durationMs = 3000) {
    const N = this.unitIds.length;
    const angleStep = 360 / N;

    this.unitIds.forEach((id, index) => {
      const marker = markerMap.get(id);
      if (!marker) return;

      const angleDeg = index * angleStep;
      const orbitPos = calculateGeodesicOffset(this.targetLat, this.targetLng, this.radiusMeters, angleDeg);

      // Facing inward towards target center
      const facingAngle = (angleDeg + 180) % 360;
      marker.setHeading(facingAngle);
      marker.animateTo(orbitPos.lat, orbitPos.lng, durationMs);
    });
  }
}

/**
 * 4. FeignedRetreatCommand (Turan Tactic / Hilal Taktigi)
 * Phase 1: Center unit feigns retreat along lure vector.
 * Phase 2: Enemy unit advances into the central trap corridor.
 * Phase 3: Left & Right flanks execute arc envelopment to encircle the enemy rear.
 */
export class FeignedRetreatCommand extends TacticalCommand {
  /**
   * @param {string} centerUnitId 
   * @param {string} leftFlankId 
   * @param {string} rightFlankId 
   * @param {string} enemyUnitId 
   * @param {Object} params 
   */
  constructor(centerUnitId, leftFlankId, rightFlankId, enemyUnitId, params = {}) {
    super();
    this.centerUnitId = centerUnitId;
    this.leftFlankId = leftFlankId;
    this.rightFlankId = rightFlankId;
    this.enemyUnitId = enemyUnitId;
    
    this.lureDistance = params.lureDistanceMeters || 2000;
    this.baitAdvanceDistance = params.baitAdvanceDistanceMeters || 1500;
    this.encircleRadius = params.encircleRadiusMeters || 1000;
  }

  execute(markerMap, durationMs = 6000) {
    const centerMarker = markerMap.get(this.centerUnitId);
    const leftMarker = markerMap.get(this.leftFlankId);
    const rightMarker = markerMap.get(this.rightFlankId);
    const enemyMarker = markerMap.get(this.enemyUnitId);

    if (!centerMarker || !enemyMarker) return;

    // 1. Calculate main attack vector from Enemy -> Center
    const enemyLat = enemyMarker.unit.lat;
    const enemyLng = enemyMarker.unit.lng;
    const centerLat = centerMarker.unit.lat;
    const centerLng = centerMarker.unit.lng;

    const dLat = centerLat - enemyLat;
    const dLng = centerLng - enemyLng;
    const advanceBearing = (Math.atan2(dLng, dLat) * (180 / Math.PI) + 360) % 360;
    const retreatBearing = advanceBearing; // Center retreats further in same direction

    // Phase 1: Center Feigns Retreat
    const centerRetreatPos = calculateGeodesicOffset(centerLat, centerLng, this.lureDistance, retreatBearing);
    centerMarker.setHeading((retreatBearing + 180) % 360); // Facing back while retreating
    centerMarker.animateTo(centerRetreatPos.lat, centerRetreatPos.lng, durationMs);

    // Phase 2: Enemy Advances into Corridor
    const enemyTrapPos = calculateGeodesicOffset(enemyLat, enemyLng, this.baitAdvanceDistance, advanceBearing);
    enemyMarker.setHeading(advanceBearing);
    enemyMarker.animateTo(enemyTrapPos.lat, enemyTrapPos.lng, durationMs * 0.8);

    // Phase 3: Crescent Encirclement by Flanks
    if (leftMarker) {
      const leftEncircleBearing = (advanceBearing + 135) % 360; // Rear left flank angle
      const leftTargetPos = calculateGeodesicOffset(enemyTrapPos.lat, enemyTrapPos.lng, this.encircleRadius, leftEncircleBearing);
      leftMarker.setHeading((leftEncircleBearing + 180) % 360);
      leftMarker.animateTo(leftTargetPos.lat, leftTargetPos.lng, durationMs);
    }

    if (rightMarker) {
      const rightEncircleBearing = (advanceBearing + 225) % 360; // Rear right flank angle
      const rightTargetPos = calculateGeodesicOffset(enemyTrapPos.lat, enemyTrapPos.lng, this.encircleRadius, rightEncircleBearing);
      rightMarker.setHeading((rightEncircleBearing + 180) % 360);
      rightMarker.animateTo(rightTargetPos.lat, rightTargetPos.lng, durationMs);
    }
  }
}

/**
 * 5. RaidCommand
 * Fast cavalry hit-and-run strike vector: Rapid advance to target -> engagement -> immediate retreat vector.
 */
export class RaidCommand extends TacticalCommand {
  /**
   * @param {string} raiderUnitId 
   * @param {string} targetUnitId 
   * @param {Object} params 
   */
  constructor(raiderUnitId, targetUnitId, params = {}) {
    super();
    this.raiderUnitId = raiderUnitId;
    this.targetUnitId = targetUnitId;
    this.strikeDist = params.strikeDistanceMeters || 300;
    this.retreatDist = params.retreatDistanceMeters || 600;
  }

  execute(markerMap, durationMs = 4000) {
    const raiderMarker = markerMap.get(this.raiderUnitId);
    const targetMarker = markerMap.get(this.targetUnitId);

    if (!raiderMarker || !targetMarker) return;

    const rLat = raiderMarker.unit.lat;
    const rLng = raiderMarker.unit.lng;
    const tLat = targetMarker.unit.lat;
    const tLng = targetMarker.unit.lng;

    const dLat = tLat - rLat;
    const dLng = tLng - rLng;
    const strikeBearing = (Math.atan2(dLng, dLat) * (180 / Math.PI) + 360) % 360;

    // Step 1: Strike position near target
    const strikePos = calculateGeodesicOffset(tLat, tLng, this.strikeDist, (strikeBearing + 180) % 360);
    raiderMarker.setHeading(strikeBearing);
    
    // Animate to strike position first, then retreat
    raiderMarker.animateTo(strikePos.lat, strikePos.lng, durationMs * 0.4, () => {
      // Step 2: High-speed retreat vector perpendicular to attack line
      const retreatBearing = (strikeBearing + 135) % 360;
      const retreatPos = calculateGeodesicOffset(strikePos.lat, strikePos.lng, this.retreatDist, retreatBearing);
      raiderMarker.setHeading(retreatBearing);
      raiderMarker.animateTo(retreatPos.lat, retreatPos.lng, durationMs * 0.6);
    });
  }
}
