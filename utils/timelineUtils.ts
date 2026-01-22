
import { AnimationMarker } from "../types";

const CHARS_PER_SECOND = 4.5;

/**
 * Parses raw narration text containing [M] tags.
 * Example: "Hello [M] world [M]!"
 * Returns: 
 *  - cleanText: "Hello world !"
 *  - markers: Array of timestamps estimated by character position
 */
export const parseScriptAndAlign = (rawText: string, totalDuration: number = 0): { cleanText: string, markers: AnimationMarker[] } => {
    if (!rawText) return { cleanText: '', markers: [] };

    const regex = /\[M\]|\[M:\d+\]|\[Next\]/gi;
    const parts = rawText.split(regex);
    const matches = rawText.match(regex);
    
    let cleanText = '';
    const markers: AnimationMarker[] = [];
    
    // Recalculate duration if 0 passed (based on length)
    const estimatedDuration = totalDuration > 0 ? totalDuration : Math.ceil(rawText.replace(regex, '').length / CHARS_PER_SECOND);
    
    let currentCharCount = 0;
    const totalChars = parts.join('').length;

    parts.forEach((part, index) => {
        cleanText += part;
        currentCharCount += part.length;

        // If there is a marker after this part
        if (matches && index < matches.length) {
            // Calculate percentage position
            const percent = totalChars > 0 ? currentCharCount / totalChars : 0;
            // Map to time
            const time = percent * estimatedDuration;
            
            markers.push({
                id: index + 1,
                time: Number(time.toFixed(2)),
                label: `Step ${index + 1}`
            });
        }
    });

    return { cleanText, markers };
};

export const insertMarkersIntoText = (cleanText: string, count: number): string => {
    // Naively distribute markers if they are missing
    if (count <= 0) return cleanText;
    const chunkLen = Math.floor(cleanText.length / (count + 1));
    let result = '';
    for(let i = 0; i < count; i++) {
        result += cleanText.substr(i * chunkLen, chunkLen) + ' [M] ';
    }
    result += cleanText.substr(count * chunkLen);
    return result;
}
