/**
 * MapMarker.js - Custom SVG Rendering & Smooth Linear Interpolation (lerp) Engine
 * Supports Leaflet map layers, dual interaction modes (drag-and-drop & timeline lerp), and NATO APP-6D styled icons.
 */

export class MapMarker {
  /**
   * @param {Unit} unit - Unit instance
   * @param {Object} mapInstance - Leaflet or MapLibre Map instance
   * @param {Function} onSelectCallback - Click handler for unit selection
   * @param {Function} onDragEndCallback - Drag handler for manual Lat/Lng editing
   */
  constructor(unit, mapInstance, onSelectCallback, onDragEndCallback) {
    this.unit = unit;
    this.map = mapInstance;
    this.onSelect = onSelectCallback;
    this.onDragEnd = onDragEndCallback;
    this.animating = false;
    this.animationFrameId = null;

    this.leafletMarker = null;
    this.initMarker();
  }

  /**
   * Generates custom SVG icon markup for historical units based on unit type and faction
   * @param {Unit} unit 
   * @returns {string} SVG HTML string
   */
  static generateSvgIconMarkup(unit) {
    const isSeljuk = unit.faction.includes('Seljuk') || unit.faction.includes('Turk');
    const primaryColor = isSeljuk ? '#00ff88' : '#ff3366';
    const secondaryColor = isSeljuk ? '#004d28' : '#66001a';
    const glowColor = primaryColor;

    let symbolPath = '';

    switch (unit.customSvgIcon || unit.type.toLowerCase()) {
      case 'cavalry_archer':
      case 'cavalry':
        // NATO styleslash cavalry symbol (slash) + bow arc
        symbolPath = `
          <line x1="8" y1="32" x2="32" y2="8" stroke="${primaryColor}" stroke-width="3" stroke-linecap="round"/>
          <path d="M12 12 Q20 4 28 12" fill="none" stroke="${primaryColor}" stroke-width="2"/>
        `;
        break;
      case 'archery':
        // Bow and Arrow
        symbolPath = `
          <path d="M10 8 Q26 20 10 32" fill="none" stroke="${primaryColor}" stroke-width="3"/>
          <line x1="8" y1="20" x2="30" y2="20" stroke="${primaryColor}" stroke-width="2"/>
          <polygon points="30,20 24,17 24,23" fill="${primaryColor}"/>
        `;
        break;
      case 'heavy_infantry':
      case 'infantry':
        // NATO Infantry X pattern + Shield
        symbolPath = `
          <line x1="10" y1="10" x2="30" y2="30" stroke="${primaryColor}" stroke-width="2.5"/>
          <line x1="30" y1="10" x2="10" y2="30" stroke="${primaryColor}" stroke-width="2.5"/>
          <rect x="14" y="14" width="12" height="12" fill="none" stroke="${primaryColor}" stroke-width="1.5"/>
        `;
        break;
      case 'siege':
      case 'siege_engine':
        // Catapult / Trebuchet icon
        symbolPath = `
          <polygon points="8,30 20,10 32,30" fill="none" stroke="${primaryColor}" stroke-width="2.5"/>
          <circle cx="20" cy="10" r="4" fill="${primaryColor}"/>
          <line x1="8" y1="30" x2="32" y2="30" stroke="${primaryColor}" stroke-width="3"/>
        `;
        break;
      case 'naval':
        // Anchor / Galley Ship icon
        symbolPath = `
          <path d="M8 22 Q20 32 32 22 L28 14 L12 14 Z" fill="${secondaryColor}" stroke="${primaryColor}" stroke-width="2"/>
          <line x1="20" y1="8" x2="20" y2="24" stroke="${primaryColor}" stroke-width="2"/>
          <line x1="14" y1="12" x2="26" y2="12" stroke="${primaryColor}" stroke-width="2"/>
        `;
        break;
      default:
        symbolPath = `
          <circle cx="20" cy="20" r="8" fill="${primaryColor}"/>
        `;
    }

    return `
      <div class="military-svg-marker" data-unit-id="${unit.id}" style="transform: rotate(${unit.heading}deg);">
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="glow-${unit.id}" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <!-- Tactical Outer Badge Frame -->
          <rect x="2" y="2" width="36" height="36" rx="6" ry="6" 
                fill="${secondaryColor}" fill-opacity="0.85" 
                stroke="${primaryColor}" stroke-width="2" 
                filter="url(#glow-${unit.id})" />
          
          <!-- Inner Symbol -->
          <g filter="url(#glow-${unit.id})">
            ${symbolPath}
          </g>
          
          <!-- Unit Morale Status Indicator Bar -->
          <rect x="4" y="34" width="${(unit.morale / 100) * 32}" height="3" rx="1" fill="${unit.morale > 50 ? '#00ff88' : '#ffcc00'}"/>
        </svg>
        <div class="marker-unit-label">${unit.name}</div>
      </div>
    `;
  }

  /**
   * Initializes Leaflet HTML marker with drag-and-drop listener
   */
  initMarker() {
    const customIconHtml = MapMarker.generateSvgIconMarkup(this.unit);

    const customIcon = L.divIcon({
      html: customIconHtml,
      className: 'custom-military-div-icon',
      iconSize: [44, 54],
      iconAnchor: [22, 27]
    });

    this.leafletMarker = L.marker([this.unit.lat, this.unit.lng], {
      icon: customIcon,
      draggable: true,
      autoPan: true
    }).addTo(this.map);

    // Event Listeners
    this.leafletMarker.on('click', () => {
      if (this.onSelect) this.onSelect(this.unit);
    });

    this.leafletMarker.on('dragend', (event) => {
      const newPos = event.target.getLatLng();
      this.unit.setPosition(newPos.lat, newPos.lng);
      if (this.onDragEnd) this.onDragEnd(this.unit, newPos.lat, newPos.lng);
    });
  }

  /**
   * Updates marker rotation heading
   * @param {number} angleDeg 
   */
  setHeading(angleDeg) {
    this.unit.heading = angleDeg;
    const markerEl = this.leafletMarker.getElement();
    if (markerEl) {
      const svgEl = markerEl.querySelector('.military-svg-marker');
      if (svgEl) {
        svgEl.style.transform = `rotate(${angleDeg}deg)`;
      }
    }
  }

  /**
   * Smoothly animates unit from current position to target Lat/Lng using linear interpolation (lerp)
   * @param {number} targetLat 
   * @param {number} targetLng 
   * @param {number} durationMs 
   * @param {Function} [onComplete] 
   */
  animateTo(targetLat, targetLng, durationMs = 2000, onComplete = null) {
    if (this.animating && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const startLat = this.unit.lat;
    const startLng = this.unit.lng;
    const startTime = performance.now();
    this.animating = true;

    // Calculate heading angle to target position
    const dLat = targetLat - startLat;
    const dLng = targetLng - startLng;
    if (Math.abs(dLat) > 0.0001 || Math.abs(dLng) > 0.0001) {
      const headingDeg = (Math.atan2(dLng, dLat) * (180 / Math.PI) + 360) % 360;
      this.setHeading(headingDeg);
    }

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);

      // Smooth Easing Function (easeInOutCubic)
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Linear Interpolation (lerp)
      const currentLat = startLat + (targetLat - startLat) * easeProgress;
      const currentLng = startLng + (targetLng - startLng) * easeProgress;

      this.unit.setPosition(currentLat, currentLng);
      this.leafletMarker.setLatLng([currentLat, currentLng]);

      if (progress < 1.0) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animating = false;
        if (onComplete) onComplete();
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  /**
   * Removes marker from map
   */
  destroy() {
    if (this.leafletMarker) {
      this.map.removeLayer(this.leafletMarker);
    }
  }
}
