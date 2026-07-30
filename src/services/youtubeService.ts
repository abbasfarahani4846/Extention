import { SubtitleItem } from '../types';

export interface YouTubeVideoData {
  id: string;
  title: string;
  channel: string;
  duration: number; // in seconds
  subtitles: SubtitleItem[];
}

export const DEMO_YOUTUBE_VIDEOS: YouTubeVideoData[] = [
  {
    id: 'M576WGiDBdQ', // Popular AI / Tech Tutorial Video ID
    title: 'How AI Agents and LLMs Work Under the Hood',
    channel: 'Tech & AI Insights',
    duration: 180,
    subtitles: [
      { id: 1, start: 2, end: 6, originalText: 'Welcome back to another video!' },
      { id: 2, start: 7, end: 12, originalText: 'Today we are building an AI Chrome extension.' },
      { id: 3, start: 13, end: 18, originalText: 'It connects to OpenRouter, NVIDIA, and Gemini.' },
      { id: 4, start: 19, end: 25, originalText: 'You can auto-translate YouTube subtitles in real time.' },
      { id: 5, start: 26, end: 32, originalText: 'Let us get started with the code tutorial.' },
      { id: 6, start: 33, end: 39, originalText: 'First, open your browser extension settings.' },
      { id: 7, start: 40, end: 46, originalText: 'Select your favorite AI model and target language.' },
      { id: 8, start: 47, end: 54, originalText: 'Now click play on any YouTube video to see real-time subtitles.' },
      { id: 9, start: 55, end: 62, originalText: 'The AI translates captions line-by-line using your API key.' },
      { id: 10, start: 63, end: 70, originalText: 'Enjoy seamless AI-powered learning on YouTube!' }
    ]
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Building Next-Gen Web Applications with React & AI',
    channel: 'DevMastery',
    duration: 120,
    subtitles: [
      { id: 1, start: 1, end: 5, originalText: 'In this session, we explore modern web tools.' },
      { id: 2, start: 6, end: 11, originalText: 'Chrome Extensions give superpowers to your browser.' },
      { id: 3, start: 12, end: 17, originalText: 'By embedding AI directly into the YouTube player, you save time.' },
      { id: 4, start: 18, end: 24, originalText: 'Custom subtitle overlays make learning global content effortless.' },
      { id: 5, start: 25, end: 30, originalText: 'You can customize font size, position, and background transparency.' }
    ]
  }
];

export const YouTubeService = {
  extractVideoId(urlOrId: string): string {
    if (!urlOrId) return 'M576WGiDBdQ';
    
    // Check if it's already an ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId.trim())) {
      return urlOrId.trim();
    }

    // Try URL regex
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlOrId.match(regExp);

    if (match && match[2].length === 11) {
      return match[2];
    }

    return 'M576WGiDBdQ'; // default fallback
  },

  getDemoVideo(videoId: string): YouTubeVideoData {
    const found = DEMO_YOUTUBE_VIDEOS.find(v => v.id === videoId);
    if (found) return found;

    // Generate synthetic subtitle track for any requested custom video ID
    return {
      id: videoId,
      title: `YouTube Video (${videoId})`,
      channel: 'YouTube Video Creator',
      duration: 300,
      subtitles: [
        { id: 1, start: 2, end: 6, originalText: 'Welcome back to another video!' },
        { id: 2, start: 7, end: 12, originalText: 'Today we are building an AI Chrome extension.' },
        { id: 3, start: 13, end: 18, originalText: 'It connects to OpenRouter, NVIDIA, and Gemini.' },
        { id: 4, start: 19, end: 25, originalText: 'You can auto-translate YouTube subtitles in real time.' },
        { id: 5, start: 26, end: 32, originalText: 'Let us get started with the code tutorial.' },
        { id: 6, start: 33, end: 39, originalText: 'First, open your browser extension settings.' },
        { id: 7, start: 40, end: 46, originalText: 'Select your favorite AI model and target language.' },
      ]
    };
  },

  getActiveSubtitle(subtitles: SubtitleItem[], currentTime: number): SubtitleItem | null {
    return subtitles.find(s => currentTime >= s.start && currentTime <= s.end) || null;
  }
};
