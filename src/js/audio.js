// 브라우저 소리 입출력.
// 마이크 → input → 고역통과(50Hz, 웅웅거리는 잡음 제거) → analyser. 녹음할 때만 tap을 붙인다.

export function micErrorMessage(err) {
  const name = err && err.name;
  if (name === 'InsecureContext') return '이 주소에서는 브라우저가 마이크를 허락하지 않아요. https:// 로 시작하는 주소나 PC의 localhost 주소로 열어 주세요.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '마이크 사용이 거부됐어요. 주소창 옆 자물쇠(사이트 설정)에서 마이크를 허용한 뒤 다시 눌러 주세요.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '마이크를 찾지 못했어요. 마이크가 연결돼 있는지 확인해 주세요.';
  if (name === 'NotReadableError') return '다른 앱이 마이크를 쓰고 있어요. 그 앱을 닫고 다시 눌러 주세요.';
  if (name === 'NoWebAudio') return '이 브라우저는 소리 분석 기능을 지원하지 않아요. 최신 Chrome이나 Safari로 열어 주세요.';
  return '마이크를 켜지 못했어요. (' + (name || '알 수 없는 오류') + ')';
}

export function createAudio() {
  let ctx = null, input = null, filter = null, analyser = null, tap = null, sink = null;
  let micStream = null, micNode = null, micSettings = null, onChunk = null;
  const frame = new Float32Array(4096);

  function micSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw Object.assign(new Error('Web Audio 미지원'), { name: 'NoWebAudio' });
      ctx = new AC({ latencyHint: 'interactive' });
      input = ctx.createGain();
      filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 50;
      analyser = ctx.createAnalyser();
      analyser.fftSize = frame.length;
      analyser.smoothingTimeConstant = 0;
      input.connect(filter);
      filter.connect(analyser);
    }
    if (ctx.state !== 'running') await ctx.resume();
    return ctx;
  }

  async function openMic() {
    if (micStream) return micSettings;
    if (!micSupported()) throw Object.assign(new Error('보안 연결 아님'), { name: 'InsecureContext' });
    // 권한 창이 뜨기 전에, 사용자가 누른 그 동작 안에서 소리 장치를 먼저 깨운다(iOS 대비).
    await ensureContext();
    // 통화용 보정 세 가지는 악기 소리를 망가뜨리므로 모두 끈다.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    micStream = stream;
    micNode = ctx.createMediaStreamSource(stream);
    micNode.connect(input);
    const track = stream.getAudioTracks()[0];
    micSettings = track && track.getSettings ? track.getSettings() : {};
    return micSettings;
  }

  function closeMic() {
    if (!micStream) return;
    try { micNode.disconnect(); } catch (e) { /* 이미 끊김 */ }
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
    micNode = null;
  }

  function readFrame() {
    if (!analyser) return null;
    analyser.getFloatTimeDomainData(frame);
    return frame;
  }

  // target: 'speakers'면 스피커로, 'input'이면 분석 경로로만 넣는다(개발용 시험 신호).
  function play(samples, target = 'speakers') {
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(target === 'input' ? input : ctx.destination);
    source.start();
    return source;
  }

  function record(seconds) {
    return new Promise((resolve) => {
      const total = Math.floor(ctx.sampleRate * seconds);
      const out = new Float32Array(total);
      let pos = 0;
      if (!tap) {
        tap = ctx.createScriptProcessor(4096, 1, 1);
        sink = ctx.createGain();
        sink.gain.value = 0;
        tap.onaudioprocess = (e) => { if (onChunk) onChunk(e.inputBuffer.getChannelData(0)); };
      }
      filter.connect(tap);
      tap.connect(sink);
      sink.connect(ctx.destination);
      onChunk = (chunk) => {
        const n = Math.min(chunk.length, total - pos);
        out.set(chunk.subarray(0, n), pos);
        pos += n;
        if (pos >= total) {
          onChunk = null;
          try { filter.disconnect(tap); tap.disconnect(); sink.disconnect(); } catch (e) { /* 이미 끊김 */ }
          resolve(out);
        }
      };
    });
  }

  return {
    micSupported, ensureContext, openMic, closeMic, readFrame, play, record,
    get sampleRate() { return ctx ? ctx.sampleRate : 0; },
    get micOpen() { return !!micStream; },
    get micSettings() { return micSettings; },
    get ready() { return !!ctx; },
  };
}
