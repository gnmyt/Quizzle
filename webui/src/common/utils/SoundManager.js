import Sound from 'react-sound';

import questionAppear from '@/pages/InGameHost/assets/sounds/transitions/question-appear.wav';
import toResults from '@/pages/InGameHost/assets/sounds/transitions/to-results.wav';
import toScoreboard from '@/pages/InGameHost/assets/sounds/transitions/to-scoreboard.wav';
import answerRevealed from '@/pages/InGameHost/assets/sounds/feedback/answer-revealed.wav';
import playerJoined from '@/pages/InGameHost/assets/sounds/feedback/player-joined.wav';
import playerLeft from '@/pages/InGameHost/assets/sounds/feedback/player-left.wav';
import timerTick from '@/pages/InGameHost/assets/sounds/feedback/timer-tick.wav';
import gameComplete from '@/pages/InGameHost/assets/sounds/celebrations/game-complete.wav';
import lobbyAmbient from '@/pages/InGameHost/assets/sounds/ambience/lobby-ambient.mp3';
import questionAmbient from '@/pages/InGameHost/assets/sounds/ambience/question-ambient.mp3';

export const SOUNDS = {
    QUESTION_APPEAR: questionAppear,
    TO_RESULTS: toResults,
    TO_SCOREBOARD: toScoreboard,

    ANSWER_REVEALED: answerRevealed,
    PLAYER_JOINED: playerJoined,
    PLAYER_LEFT: playerLeft,
    TIMER_TICK: timerTick,

    GAME_COMPLETE: gameComplete,

    LOBBY_AMBIENT: lobbyAmbient,
    QUESTION_AMBIENT: questionAmbient,
    INGAME_MUSIC: questionAmbient,
};

export class SoundManager {
    constructor() {
        this.soundEnabled = this.loadSoundEnabledFromStorage();
        this.currentlyPlaying = new Map();
        this.volume = 50;
        this.listeners = new Set();
    }

    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback());
    }

    loadSoundEnabledFromStorage() {
        const stored = localStorage.getItem('quizzle_sound_enabled');
        return stored !== null ? JSON.parse(stored) : true;
    }

    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        localStorage.setItem('quizzle_sound_enabled', JSON.stringify(enabled));

        this.updateAllSoundsVolume();
    }

    getSoundEnabled() {
        return this.soundEnabled;
    }

    getEffectiveVolume(originalVolume) {
        return this.soundEnabled ? originalVolume : 0;
    }

    updateAllSoundsVolume() {
        this.currentlyPlaying.forEach((config) => {
            config.effectiveVolume = this.getEffectiveVolume(config.originalVolume);
        });
        this.notifyListeners();
    }

    playSound(soundKey, options = {}) {
        const soundUrl = SOUNDS[soundKey];
        if (!soundUrl) {
            console.warn(`Sound ${soundKey} not found`);
            return null;
        }

        const soundId = `${soundKey}_${Date.now()}`;
        const originalVolume = options.volume !== undefined ? options.volume : this.volume;
        const effectiveVolume = this.getEffectiveVolume(originalVolume);

        const soundConfig = {
            url: soundUrl,
            playStatus: Sound.status.PLAYING,
            originalVolume: originalVolume,
            effectiveVolume: effectiveVolume,
            loop: options.loop || false,
            onFinishedPlaying: () => {
                this.currentlyPlaying.delete(soundId);
                this.notifyListeners();
                if (options.onFinished) options.onFinished();
            },
            onError: (errorCode, description) => {
                console.error(`Sound error for ${soundKey}:`, errorCode, description);
                this.currentlyPlaying.delete(soundId);
                this.notifyListeners();
            }
        };

        this.currentlyPlaying.set(soundId, soundConfig);
        this.notifyListeners();
        return soundId;
    }

    stopSound(soundId) {
        if (this.currentlyPlaying.has(soundId)) {
            const soundConfig = this.currentlyPlaying.get(soundId);
            soundConfig.playStatus = Sound.status.STOPPED;
            this.currentlyPlaying.delete(soundId);
            this.notifyListeners();
        }
    }

    getCurrentlyPlaying() {
        return Array.from(this.currentlyPlaying.entries());
    }

    playTransition(type) {
        switch (type) {
            case 'QUESTION':
                return this.playSound('QUESTION_APPEAR');
            case 'RESULTS':
                return this.playSound('TO_RESULTS');
            case 'SCOREBOARD':
                return this.playSound('TO_SCOREBOARD');
            default:
                console.warn(`Unknown transition type: ${type}`);
                return null;
        }
    }

    playFeedback(type) {
        switch (type) {
            case 'ANSWER_REVEALED':
                return this.playSound('ANSWER_REVEALED');
            case 'PLAYER_JOINED':
                return this.playSound('PLAYER_JOINED');
            case 'PLAYER_LEFT':
                return this.playSound('PLAYER_LEFT');
            case 'TIMER_TICK':
                return this.playSound('TIMER_TICK');
            default:
                console.warn(`Unknown feedback type: ${type}`);
                return null;
        }
    }

    playCelebration(type) {
        switch (type) {
            case 'GAME_COMPLETE':
                return this.playSound('GAME_COMPLETE');
            default:
                console.warn(`Unknown celebration type: ${type}`);
                return null;
        }
    }

    playAmbient(type, options = {}) {
        switch (type) {
            case 'LOBBY':
                return this.playSound('LOBBY_AMBIENT', {
                    loop: true,
                    volume: (options.volume || this.volume) * 0.7,
                    ...options
                });
            case 'QUESTION':
                return this.playSound('QUESTION_AMBIENT', {
                    loop: true,
                    volume: (options.volume || this.volume) * 0.7,
                    ...options
                });
            case 'INGAME':
                return this.playSound('INGAME_MUSIC', {
                    loop: true,
                    volume: (options.volume || this.volume) * 0.8,
                    ...options
                });
            default:
                console.warn(`Unknown ambient type: ${type}`);
                return null;
        }
    }
}

export const soundManager = new SoundManager();

export const useSoundManager = () => {
    return soundManager;
};