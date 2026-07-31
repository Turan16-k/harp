/**
 * SyncPlayer.js - AI Storytelling & Timeline Synchronization Engine
 * Concurrently coordinates playback of narration text, camera pan/zoom flights, 
 * audio/subtitle cues, and tactical command executions from time-stamped battle JSON payloads.
 */

import { 
  LineFormationCommand, 
  WedgeFormationCommand, 
  SiegeCommand, 
  FeignedRetreatCommand, 
  RaidCommand 
} from './TacticsEngine.js';

export class SyncPlayer {
  /**
   * @param {Object} scenarioPayload - BattleScenario JSON object
   * @param {Map<string, MapMarker>} markerMap - Map of unit IDs to MapMarker instances
   * @param {Object} mapInstance - Leaflet map instance
   * @param {Object} uiCallbacks - Callbacks for UI updates (narration, time, status)
   */
  constructor(scenarioPayload, markerMap, mapInstance, uiCallbacks = {}) {
    this.scenario = scenarioPayload;
    this.markerMap = markerMap;
    this.map = mapInstance;
    this.uiCallbacks = uiCallbacks;

    this.timelineEvents = scenarioPayload.timelineEvents || [];
    this.currentTime = 0;
    this.totalDuration = this.calculateTotalDuration();
    this.isPlaying = false;
    this.timerId = null;
    this.executedEvents = new Set();
    this.speechSynth = window.speechSynthesis || null;

    this.speedMultiplier = 1.0;
  }

  /**
   * Computes max duration of scenario timeline
   * @returns {number} Duration in seconds
   */
  calculateTotalDuration() {
    if (!this.timelineEvents.length) return 60;
    const lastEvent = this.timelineEvents[this.timelineEvents.length - 1];
    return lastEvent.timestamp + (lastEvent.duration || 10);
  }

  /**
   * Plays or resumes timeline simulation
   */
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    if (this.uiCallbacks.onStateChange) {
      this.uiCallbacks.onStateChange('PLAYING');
    }

    const intervalMs = 100 / this.speedMultiplier;
    this.timerId = setInterval(() => {
      this.tick(0.1 * this.speedMultiplier);
    }, 100);
  }

  /**
   * Pauses simulation
   */
  pause() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.speechSynth && this.speechSynth.speaking) {
      this.speechSynth.cancel();
    }
    if (this.uiCallbacks.onStateChange) {
      this.uiCallbacks.onStateChange('PAUSED');
    }
  }

  /**
   * Stops and resets timeline to 0
   */
  stop() {
    this.pause();
    this.currentTime = 0;
    this.executedEvents.clear();
    if (this.uiCallbacks.onTimeUpdate) {
      this.uiCallbacks.onTimeUpdate(0, this.totalDuration);
    }
    if (this.uiCallbacks.onStateChange) {
      this.uiCallbacks.onStateChange('STOPPED');
    }
  }

  /**
   * Seeks timeline to specific timestamp in seconds
   * @param {number} seconds 
   */
  seek(seconds) {
    this.currentTime = Math.max(0, Math.min(seconds, this.totalDuration));
    this.executedEvents.clear();

    // Re-evaluate past events up to current seek point
    this.timelineEvents.forEach((event, idx) => {
      if (event.timestamp <= this.currentTime) {
        this.executedEvents.add(idx);
      }
    });

    if (this.uiCallbacks.onTimeUpdate) {
      this.uiCallbacks.onTimeUpdate(this.currentTime, this.totalDuration);
    }
  }

  /**
   * Main time-step tick handler
   * @param {number} deltaSeconds 
   */
  tick(deltaSeconds) {
    this.currentTime += deltaSeconds;

    if (this.currentTime >= this.totalDuration) {
      this.stop();
      return;
    }

    if (this.uiCallbacks.onTimeUpdate) {
      this.uiCallbacks.onTimeUpdate(this.currentTime, this.totalDuration);
    }

    // Check for event triggers matching current timestamp
    this.timelineEvents.forEach((event, idx) => {
      if (this.currentTime >= event.timestamp && !this.executedEvents.has(idx)) {
        this.executedEvents.add(idx);
        this.triggerEvent(event);
      }
    });
  }

  /**
   * Triggers event actions (Camera Pan, Narration Text, Speech Synthesis, Tactical Commands)
   * @param {Object} event 
   */
  triggerEvent(event) {
    // 1. Narration Text Update & Speech Synthesis
    if (event.narrationText) {
      if (this.uiCallbacks.onNarration) {
        this.uiCallbacks.onNarration(event.narrationText);
      }
      this.speakNarration(event.narrationText);
    }

    // 2. Camera Flight Controls (Pan & Zoom)
    if (event.camera && this.map) {
      const { center, zoom, duration } = event.camera;
      const flyDuration = (duration || 3) / this.speedMultiplier;
      this.map.flyTo(center, zoom || 12, {
        duration: flyDuration,
        easeLinearity: 0.25
      });
    }

    // 3. Tactical Command Execution
    if (event.commands && Array.isArray(event.commands)) {
      event.commands.forEach(cmdSpec => {
        this.executeTacticalCommand(cmdSpec, event.duration * 1000);
      });
    }
  }

  /**
   * Instantiates and runs TacticalCommand strategy classes
   * @param {Object} cmdSpec 
   * @param {number} defaultDurationMs 
   */
  executeTacticalCommand(cmdSpec, defaultDurationMs = 4000) {
    const duration = (cmdSpec.params && cmdSpec.params.durationSeconds) 
      ? cmdSpec.params.durationSeconds * 1000 
      : defaultDurationMs;

    let commandInstance = null;

    switch (cmdSpec.type) {
      case 'FEIGNED_RETREAT':
        commandInstance = new FeignedRetreatCommand(
          cmdSpec.centerUnitId,
          cmdSpec.leftFlankId,
          cmdSpec.rightFlankId,
          cmdSpec.enemyUnitId,
          cmdSpec.params
        );
        break;

      case 'SIEGE_ORBIT':
        commandInstance = new SiegeCommand(
          cmdSpec.unitIds,
          cmdSpec.targetCoordinates[0],
          cmdSpec.targetCoordinates[1],
          cmdSpec.params ? cmdSpec.params.radiusMeters : 800
        );
        break;

      case 'FORM_LINE':
        {
          const leaderMarker = this.markerMap.get(cmdSpec.unitId);
          if (leaderMarker) {
            commandInstance = new LineFormationCommand(
              [cmdSpec.unitId],
              leaderMarker.unit.lat,
              leaderMarker.unit.lng,
              leaderMarker.unit.heading,
              cmdSpec.params ? cmdSpec.params.spacingMeters : 30
            );
          }
        }
        break;

      case 'RAID_STRIKE':
        commandInstance = new RaidCommand(
          cmdSpec.unitId,
          cmdSpec.targetUnitId,
          cmdSpec.params
        );
        break;

      default:
        console.warn(`[SyncPlayer] Unknown tactical command type: ${cmdSpec.type}`);
    }

    if (commandInstance) {
      commandInstance.execute(this.markerMap, duration / this.speedMultiplier);
    }
  }

  /**
   * Optional Web Speech Synthesis audio playback
   * @param {string} text 
   */
  speakNarration(text) {
    if (!this.speechSynth) return;
    try {
      this.speechSynth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0 * this.speedMultiplier;
      utterance.pitch = 0.9;
      this.speechSynth.speak(utterance);
    } catch (e) {
      console.warn('[SyncPlayer] Speech synthesis unavailable or muted', e);
    }
  }
}
