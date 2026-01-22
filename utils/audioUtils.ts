
// Utility to decode raw PCM data returned by Gemini TTS

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const decodeAudioData = async (
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000 // Gemini default
): Promise<AudioBuffer> => {
  const data = decodeBase64(base64Data);
  // Gemini returns raw PCM 16-bit mono
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    // Convert int16 to float32 [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
};

export class AudioController {
    private ctx: AudioContext | null = null;
    private source: AudioBufferSourceNode | null = null;
    private startTime: number = 0;

    constructor() {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            this.ctx = new AudioContextClass({ sampleRate: 24000 });
        }
    }

    async play(base64Data: string, onEnded?: () => void) {
        if (!this.ctx) return;
        
        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Stop previous sound
        this.stop();

        const buffer = await decodeAudioData(base64Data, this.ctx);
        
        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.connect(this.ctx.destination);
        
        if (onEnded) {
            this.source.onended = onEnded;
        }

        this.source.start();
        return buffer.duration;
    }

    stop() {
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.source = null;
        }
    }

    getDuration(base64Data: string): number {
        // Approximate calculation for PCM 16bit 24kHz mono
        // 1 sample = 2 bytes. 24000 samples/sec.
        // bytes / 2 / 24000
        const bytes = decodeBase64(base64Data).length;
        return bytes / 2 / 24000;
    }
}

export const audioController = new AudioController();
