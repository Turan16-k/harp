/**
 * app.js - Main Application Orchestration Module
 * Initializes GIS vector map, historical boundary layers, military unit markers, 
 * interactive tactical drawers, and AI SyncPlayer narration timeline.
 */

import { Unit } from './Unit.js';
import { MapMarker } from './MapMarker.js';
import { SyncPlayer } from './SyncPlayer.js';
import { 
  LineFormationCommand, 
  WedgeFormationCommand, 
  SiegeCommand, 
  FeignedRetreatCommand, 
  RaidCommand 
} from './TacticsEngine.js';

class HistoricalWarEngineApp {
  constructor() {
    this.map = null;
    this.scenarioData = null;
    this.unitsMap = new Map();
    this.markerMap = new Map();
    this.selectedUnit = null;
    this.syncPlayer = null;

    this.init();
  }

  async init() {
    try {
      // 1. Fetch Scenario JSON
      const response = await fetch('./BattleScenario.json');
      this.scenarioData = await response.json();

      // 2. Initialize Leaflet Map Viewport
      this.initMap();

      // 3. Render Historical GeoJSON Boundary Features
      this.renderHistoricalBoundaries();

      // 4. Instantiate Unit & Marker Models
      this.initUnitsAndMarkers();

      // 5. Initialize AI SyncPlayer Timeline Engine
      this.initSyncPlayer();

      // 6. Bind DOM UI Controls & Drawer Listeners
      this.bindUIControls();

      console.log('[HistoricalWarEngine] Application initialized successfully.');
    } catch (err) {
      console.error('[HistoricalWarEngine] Initialization error:', err);
    }
  }

  initMap() {
    const center = this.scenarioData.metadata.centerCoordinates || [39.1436, 42.5442];
    const zoom = this.scenarioData.metadata.defaultZoom || 11;

    this.map = L.map('map-viewport', {
      center: center,
      zoom: zoom,
      zoomControl: false
    });

    // Dark GIS Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> historical GIS engine',
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);
  }

  renderHistoricalBoundaries() {
    if (this.scenarioData.historicalBoundaries) {
      L.geoJSON(this.scenarioData.historicalBoundaries, {
        style: (feature) => {
          return {
            color: feature.properties.stroke || '#00ff88',
            weight: feature.properties.strokeWidth || 2,
            fillColor: feature.properties.fill || '#00ff88',
            fillOpacity: feature.properties.fillOpacity || 0.15,
            dashArray: '4, 4'
          };
        }
      }).addTo(this.map);
    }
  }

  initUnitsAndMarkers() {
    if (!this.scenarioData.units) return;

    this.scenarioData.units.forEach(unitConfig => {
      const unit = new Unit(unitConfig);
      this.unitsMap.set(unit.id, unit);

      const marker = new MapMarker(
        unit,
        this.map,
        (selectedUnit) => this.onUnitSelected(selectedUnit),
        (draggedUnit, lat, lng) => this.onUnitDragged(draggedUnit, lat, lng)
      );

      this.markerMap.set(unit.id, marker);
    });
  }

  initSyncPlayer() {
    this.syncPlayer = new SyncPlayer(
      this.scenarioData,
      this.markerMap,
      this.map,
      {
        onTimeUpdate: (current, total) => this.updateTimelineUI(current, total),
        onNarration: (text) => this.updateNarrationUI(text),
        onStateChange: (state) => this.updatePlaybackStateUI(state)
      }
    );
  }

  onUnitSelected(unit) {
    this.selectedUnit = unit;
    this.renderUnitCardDetails(unit);
  }

  onUnitDragged(unit, lat, lng) {
    console.log(`[Unit Dragged] ${unit.name} updated coordinates to Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
    if (this.selectedUnit && this.selectedUnit.id === unit.id) {
      this.renderUnitCardDetails(unit);
    }
  }

  renderUnitCardDetails(unit) {
    const cardEl = document.getElementById('unit-details-card');
    if (!cardEl) return;

    cardEl.innerHTML = `
      <div class="unit-card-details">
        <div class="stat-row">
          <span>FACTION:</span>
          <span style="color: ${unit.faction.includes('Seljuk') ? '#00ff88' : '#ff3366'}">${unit.faction}</span>
        </div>
        <div class="stat-row">
          <span>COMMANDER:</span>
          <span>${unit.commander.name} (${unit.commander.rank})</span>
        </div>
        <div class="stat-row">
          <span>STRENGTH:</span>
          <span>${unit.strength.toLocaleString()} / ${unit.maxStrength.toLocaleString()}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${(unit.strength / unit.maxStrength) * 100}%;"></div>
        </div>

        <div class="stat-row">
          <span>MORALE:</span>
          <span>${Math.round(unit.morale)}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${unit.morale}%; background: ${unit.morale > 50 ? '#00ff88' : '#ffcc00'};"></div>
        </div>

        <div class="stat-row">
          <span>COORDINATES:</span>
          <span>${unit.lat.toFixed(4)}, ${unit.lng.toFixed(4)}</span>
        </div>
        <div class="stat-row">
          <span>HEADING:</span>
          <span>${Math.round(unit.heading)}°</span>
        </div>
      </div>
    `;
  }

  updateTimelineUI(current, total) {
    const slider = document.getElementById('timeline-slider');
    const timeDisplay = document.getElementById('time-display');

    if (slider) {
      slider.max = Math.round(total);
      slider.value = Math.round(current);
    }

    if (timeDisplay) {
      const formatTime = (s) => {
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };
      timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
    }
  }

  updateNarrationUI(text) {
    const box = document.getElementById('ai-narration-box');
    if (box) {
      box.textContent = text;
    }
  }

  updatePlaybackStateUI(state) {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.textContent = (state === 'PLAYING') ? '⏸' : '▶';
    }
  }

  bindUIControls() {
    // Play/Pause Button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.syncPlayer.isPlaying) {
          this.syncPlayer.pause();
        } else {
          this.syncPlayer.play();
        }
      });
    }

    // Timeline Slider Drag
    const slider = document.getElementById('timeline-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const seconds = parseFloat(e.target.value);
        this.syncPlayer.seek(seconds);
      });
    }

    // Manual Tactical Command Triggers
    const btnTuran = document.getElementById('btn-turan-tactic');
    if (btnTuran) {
      btnTuran.addEventListener('click', () => {
        const cmd = new FeignedRetreatCommand(
          'seljuk_center_vanguard',
          'seljuk_left_flank',
          'seljuk_right_flank',
          'byzantine_vanguard',
          { lureDistanceMeters: 2500, baitAdvanceDistanceMeters: 2000, encircleRadiusMeters: 1200 }
        );
        cmd.execute(this.markerMap, 6000);
        this.updateNarrationUI("EXECUTION: Turan Tactic (Feigned Retreat) triggered manually! Center withdraws while flanks close crescent encirclement.");
      });
    }

    const btnWedge = document.getElementById('btn-wedge-formation');
    if (btnWedge) {
      btnWedge.addEventListener('click', () => {
        const leader = this.markerMap.get('seljuk_center_vanguard');
        if (leader) {
          const cmd = new WedgeFormationCommand(
            'seljuk_center_vanguard',
            ['seljuk_left_flank', 'seljuk_right_flank'],
            leader.unit.lat,
            leader.unit.lng,
            90,
            150,
            120
          );
          cmd.execute(this.markerMap, 3000);
          this.updateNarrationUI("EXECUTION: Wedge Spearhead Formation assumed by Seljuk Vanguard!");
        }
      });
    }

    const btnSiege = document.getElementById('btn-siege-orbit');
    if (btnSiege) {
      btnSiege.addEventListener('click', () => {
        const cmd = new SiegeCommand(
          ['seljuk_left_flank', 'seljuk_right_flank', 'seljuk_center_vanguard'],
          39.1450,
          42.5050,
          900
        );
        cmd.execute(this.markerMap, 5000);
        this.updateNarrationUI("EXECUTION: Rotational Siege Orbit initiated around target coordinates!");
      });
    }
  }
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new HistoricalWarEngineApp();
});
