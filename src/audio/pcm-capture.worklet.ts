// AudioWorklet processor that copies the input channel into a transferable
// Float32Array and posts it back to the main thread on every audio quantum.
// Resampling to Whisper's 16 kHz happens on the main thread — keeps the
// worklet itself trivial and avoids needing to know the target rate here.

// Minimal type declarations: the AudioWorkletProcessor / registerProcessor
// globals aren't in the project's "DOM" lib, but they exist at runtime inside
// AudioWorkletGlobalScope.
declare const registerProcessor: (
  name: string,
  ctor: new () => AudioWorkletProcessorImpl,
) => void;

interface AudioWorkletProcessorImpl {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare const AudioWorkletProcessor: {
  new (): AudioWorkletProcessorImpl;
};

class PcmCaptureProcessor
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0];
    if (!ch0 || ch0.length === 0) return true;
    // Copy: the audio thread reuses the underlying buffer between callbacks,
    // so we can't post the raw view — it would be overwritten before the main
    // thread reads it. Transfer the copy to avoid a second allocation.
    const copy = new Float32Array(ch0);
    this.port.postMessage(copy, [copy.buffer]);
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
