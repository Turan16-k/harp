/**
 * Unit.js - Historical Military Unit Domain Model
 * Manages unit state, attributes, morale, stamina, and tactical properties.
 */

export class Unit {
  /**
   * @param {Object} config - Unit configuration object from scenario JSON
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.faction = config.faction;
    this.type = config.type || 'Infantry'; // Infantry, Cavalry, Archery, Siege Engine, Naval
    this.subType = config.subType || 'Standard';
    this.lat = parseFloat(config.lat);
    this.lng = parseFloat(config.lng);
    this.heading = config.heading || 0; // Degrees (0-360)
    this.strength = config.strength || 1000;
    this.maxStrength = config.maxStrength || config.strength || 1000;
    this.morale = config.morale !== undefined ? config.morale : 100; // 0 - 100
    this.stamina = config.stamina !== undefined ? config.stamina : 100; // 0 - 100
    this.commander = config.commander || { name: 'Unknown Officer', rank: 'Captain', tacticalSkill: 50 };
    this.stats = Object.assign({ speed: 30, attack: 50, defense: 50, range: 50 }, config.stats || {});
    this.customSvgIcon = config.customSvgIcon || 'infantry';
    this.isSelected = false;
    this.pathHistory = [[this.lat, this.lng]];
  }

  /**
   * Updates unit coordinates and logs movement trajectory
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} [heading] - Optional heading angle
   */
  setPosition(lat, lng, heading = null) {
    this.lat = parseFloat(lat);
    this.lng = parseFloat(lng);
    if (heading !== null) {
      this.heading = heading;
    }
    this.pathHistory.push([this.lat, this.lng]);
  }

  /**
   * Applies damage to unit strength and morale
   * @param {number} amount - Damage strength
   */
  takeDamage(amount) {
    this.strength = Math.max(0, this.strength - amount);
    const moraleLoss = (amount / this.maxStrength) * 50;
    this.morale = Math.max(0, this.morale - moraleLoss);
  }

  /**
   * Calculates combat strength taking morale and stamina into account
   * @returns {number} Effective combat power
   */
  getEffectiveCombatPower() {
    const moraleFactor = this.morale / 100;
    const staminaFactor = 0.5 + (this.stamina / 200);
    return this.strength * (this.stats.attack / 100) * moraleFactor * staminaFactor;
  }

  /**
   * Returns serializable JSON state snapshot
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      faction: this.faction,
      type: this.type,
      lat: this.lat,
      lng: this.lng,
      heading: this.heading,
      strength: this.strength,
      morale: this.morale,
      stamina: this.stamina,
      commander: this.commander,
      stats: this.stats
    };
  }
}
