import React, {useState, useEffect} from 'react';
import Sound from 'react-sound';
import {useSoundManager} from '@/common/utils/SoundManager';

export const SoundRenderer = () => {
    const soundManager = useSoundManager();
    const [currentlyPlaying, setCurrentlyPlaying] = useState([]);

    useEffect(() => {
        const updateSounds = () => {
            const playing = soundManager.getCurrentlyPlaying();
            setCurrentlyPlaying(playing);
        };

        updateSounds();

        soundManager.addListener(updateSounds);

        return () => {
            soundManager.removeListener(updateSounds);
        };
    }, [soundManager]);

    return (
        <>
            {currentlyPlaying.map(([soundId, config]) => (
                <Sound
                    key={soundId}
                    url={config.url}
                    playStatus={config.playStatus}
                    volume={config.effectiveVolume}
                    loop={config.loop}
                    onFinishedPlaying={config.onFinishedPlaying}
                    onError={config.onError}
                />
            ))}
        </>
    );
};