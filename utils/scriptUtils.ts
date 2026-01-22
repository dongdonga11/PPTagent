
// Average speaking rate: characters per second (Chinese)
// Usually broadcast speed is around 4-5 chars/sec
const CHARS_PER_SECOND = 4.5;

export const calculateDuration = (text: string): number => {
  if (!text) return 3;
  // Remove punctuation/spaces for accurate word count
  const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const length = cleanText.length;
  // Minimum 3 seconds per slide
  return Math.max(3, Math.ceil(length / CHARS_PER_SECOND));
};

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const getLayoutIcon = (layout: string): string => {
    switch (layout) {
        case 'Cover': return 'fa-solid fa-image';
        case 'SectionTitle': return 'fa-solid fa-heading';
        case 'Bullets': return 'fa-solid fa-list-ul';
        case 'SplitLeft': return 'fa-solid fa-table-columns';
        case 'SplitRight': return 'fa-solid fa-table-columns fa-flip-horizontal';
        case 'BigNumber': return 'fa-solid fa-7';
        case 'Quote': return 'fa-solid fa-quote-left';
        case 'GridFeatures': return 'fa-solid fa-border-all';
        default: return 'fa-regular fa-square';
    }
};
