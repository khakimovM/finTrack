import { spawn } from 'node:child_process';

const TIMEOUT_MS = 20_000;

export type RawAudio = { format: 'wav' } | { format: 'pcm'; sampleRate: number };

/**
 * WAV or 16-bit mono PCM to OGG/Opus, the only format Telegram shows as a voice message, through
 * opusenc (Alpine's opus-tools, ~1 MB where ffmpeg would add ~120 MB to the image).
 */
export function toOggOpus(audio: Buffer, input: RawAudio, opusenc = 'opusenc'): Promise<Buffer> {
  const source =
    input.format === 'pcm'
      ? ['--raw', '--raw-bits', '16', '--raw-rate', String(input.sampleRate), '--raw-chan', '1']
      : [];
  const args = ['--quiet', '--speech', '--bitrate', '32', ...source, '-', '-'];

  return new Promise((resolve, reject) => {
    const child = spawn(opusenc, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let errors = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      errors = (errors + chunk.toString()).slice(-500);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && out.length > 0) resolve(Buffer.concat(out));
      else reject(new Error(`opusenc exited with ${code}: ${errors.trim()}`));
    });
    // The encoder may stop reading early on bad input; the close handler reports that.
    child.stdin.on('error', () => undefined);
    child.stdin.end(audio);
  });
}
