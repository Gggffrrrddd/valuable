export type Mood = 'Lo-fi' | 'Piano' | 'Ambient' | 'Nature';

export interface TrackInfo {
  id: string;
  mood: Mood;
  title: string;
  artist: string;
  url: string;
}

export const STUDY_TRACKS: TrackInfo[] = [
  // Lo-fi
  { id: 'lofi-focus', mood: 'Lo-fi', title: 'Lofi Focus', artist: 'ZephiraMusic', url: '/audio/study-tunes/lofi/lofi-focus.mp3' },
  { id: 'lofi-calm', mood: 'Lo-fi', title: 'Lofi Calm', artist: 'ZephiraMusic', url: '/audio/study-tunes/lofi/lofi-calm.mp3' },
  { id: 'study-music', mood: 'Lo-fi', title: 'Study Music', artist: 'Leberch', url: '/audio/study-tunes/lofi/study-music.mp3' },
  // Piano
  { id: 'focus-piano', mood: 'Piano', title: 'Focus', artist: 'AtlasAudio', url: '/audio/study-tunes/piano/focus-piano.mp3' },
  { id: 'i-need-you', mood: 'Piano', title: 'I Need You', artist: 'PrabajithK', url: '/audio/study-tunes/piano/i-need-you.mp3' },
  { id: 'night-music', mood: 'Piano', title: 'Night Music', artist: 'Leberch', url: '/audio/study-tunes/piano/night-music.mp3' },
  // Ambient
  { id: 'meditation-andriig', mood: 'Ambient', title: 'Meditation', artist: 'Andriig', url: '/audio/study-tunes/ambient/meditation-andriig.mp3' },
  { id: 'meditation-verclub', mood: 'Ambient', title: 'Deep Meditation', artist: 'Verclub Music', url: '/audio/study-tunes/ambient/meditation-verclub.mp3' },
  { id: 'soothing-handpan', mood: 'Ambient', title: 'Soothing Handpan', artist: 'Poorartistt', url: '/audio/study-tunes/ambient/soothing-handpan.mp3' },
  // Nature
  { id: 'rain', mood: 'Nature', title: 'Gentle Rain', artist: 'AlexRockBeat', url: '/audio/study-tunes/nature/rain.mp3' },
  { id: 'celtic-forest', mood: 'Nature', title: 'Mystical Forest', artist: 'VJGalaxy', url: '/audio/study-tunes/nature/celtic-forest.mp3' },
  { id: 'morning-forest', mood: 'Nature', title: 'Morning Forest', artist: 'Clavier Music', url: '/audio/study-tunes/nature/morning-forest.mp3' },
];
