export type Mood = 'Lo-fi' | 'Ambient / Piano' | 'Nature-blended';

export interface TrackInfo {
  id: string;
  mood: Mood;
  title: string;
  artist: string;
  url: string;
}

export const STUDY_TRACKS: TrackInfo[] = [
  // Lo-fi (4)
  { id: 'quiet-hours', mood: 'Lo-fi', title: 'Quiet Hours', artist: 'Valuable', url: '/audio/study-tunes/lofi/lofi-focus.mp3' },
  { id: 'study-window', mood: 'Lo-fi', title: 'Study Window', artist: 'Valuable', url: '/audio/study-tunes/lofi/lofi-calm.mp3' },
  { id: 'slow-morning', mood: 'Lo-fi', title: 'Slow Morning', artist: 'Valuable', url: '/audio/study-tunes/lofi/study-music.mp3' },
  { id: 'paper-and-ink', mood: 'Lo-fi', title: 'Paper and Ink', artist: 'Valuable', url: '/audio/study-tunes/ambient/soothing-handpan.mp3' },

  // Ambient / Piano (4)
  { id: 'still-air', mood: 'Ambient / Piano', title: 'Still Air', artist: 'Valuable', url: '/audio/study-tunes/piano/focus-piano.mp3' },
  { id: 'soft-focus', mood: 'Ambient / Piano', title: 'Soft Focus', artist: 'Valuable', url: '/audio/study-tunes/ambient/meditation-andriig.mp3' },
  { id: 'first-light', mood: 'Ambient / Piano', title: 'First Light', artist: 'Valuable', url: '/audio/study-tunes/ambient/meditation-verclub.mp3' },
  { id: 'low-hum', mood: 'Ambient / Piano', title: 'Low Hum', artist: 'Valuable', url: '/audio/study-tunes/piano/night-music.mp3' },

  // Nature-blended (4)
  { id: 'rain-on-glass', mood: 'Nature-blended', title: 'Rain on Glass', artist: 'Valuable', url: '/audio/study-tunes/nature/rain.mp3' },
  { id: 'forest-breath', mood: 'Nature-blended', title: 'Forest Breath', artist: 'Valuable', url: '/audio/study-tunes/nature/celtic-forest.mp3' },
  { id: 'river-line', mood: 'Nature-blended', title: 'River Line', artist: 'Valuable', url: '/audio/study-tunes/nature/morning-forest.mp3' },
  { id: 'night-garden', mood: 'Nature-blended', title: 'Night Garden', artist: 'Valuable', url: '/audio/study-tunes/piano/i-need-you.mp3' },
];
