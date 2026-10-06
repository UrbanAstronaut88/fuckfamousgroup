"use client";
import { useLanguage } from "./language";
import { useEffect, useRef, useState } from "react";
const tracks = [
  {
    title: "Якби ви знали, паничі",
    artist: "FCK FAMOUS GROUP",
    src: "/audio/yakby-vy-znaly-panychi.mp3",
  },
  {
    title: "Розвідка",
    artist: "FCK FAMOUS GROUP × MOLODOY NORD DIVISION",
    src: "/audio/rozvidka.mp3",
  },
  { title: "Донька воїна", artist: "FCK FAMOUS", src: "/audio/donka-voina.mp3" },
  { title: "Чоловічі сльози", artist: "FCK FAMOUS", src: "/audio/cholovichi-slozy.mp3" },
  { title: "Пропорція", artist: "FCK FAMOUS GROUP", src: "/audio/proporcia.mp3" },
  { title: "Братам", artist: "FCK FAMOUS GROUP", src: "/audio/bratam.mp3" },
  { title: "Правдива", artist: "FCK FAMOUS GROUP", src: "/audio/pravdyva.mp3" },
  { title: "Франко", artist: "FCK FAMOUS GROUP", src: "/audio/franko.mp3" },
  { title: "Юрка", artist: "FCK FAMOUS GROUP", src: "/audio/yurka.mp3" },
  { title: "Fuck Famous", artist: "FCK FMS GROUP · prod. Sergio Tacchini", src: "/audio/fuck-famous.mp3" },
  { title: "850 днів і ночей", artist: "FCK FMS GROUP · prod. Sergio Tacchini", src: "/audio/850-dniv-i-nochei.mp3" },
  { title: "Живим і мертвим", artist: "FCK FMS GROUP · prod. Sergio Tacchini", src: "/audio/zhyvym-i-mertvym.mp3" },
  { title: "Складна ситуація", artist: "FCK FMS GROUP · prod. Sergio Tacchini", src: "/audio/skladna-sytuatsiia.mp3" },
  { title: "Люцифер", artist: "FFG", src: "/audio/lucifer.mp3" },
  { title: "Кохання", artist: "Sergio Tacchini", src: "/audio/kokhannia.mp3" },
  { title: "Марево", artist: "Sergio Tacchini", src: "/audio/marevo.mp3" },
  { title: "Проповідь", artist: "Sergio Tacchini", src: "/audio/propovid.mp3" },
  { title: "Страсті", artist: "Sergio Tacchini", src: "/audio/strasti.mp3" },
];
const timestamp = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export function MusicPlayer() {
  const { tr, t } = useLanguage();
  const audio = useRef<HTMLAudioElement>(null);
  const indexRef = useRef(0);
  const operation = useRef(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.35);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const track = tracks[index];
  function rememberPaused(paused: boolean) {
    try {
      localStorage.setItem("ffg-music-paused", String(paused));
    } catch {
      /* Optional preference. */
    }
  }
  async function play() {
    const element = audio.current;
    if (!element) return;
    const ticket = ++operation.current;
    setFailed(false);
    try {
      await element.play();
      if (ticket !== operation.current) return;
      setBlocked(false);
    } catch (error) {
      if (
        ticket !== operation.current ||
        (error as Error).name === "AbortError"
      )
        return;
      if ((error as Error).name === "NotAllowedError") setBlocked(true);
      else setFailed(true);
    }
  }
  function pause() {
    operation.current++;
    audio.current?.pause();
    rememberPaused(true);
    setBlocked(false);
  }
  function changeTrack(step: number) {
    const element = audio.current;
    if (!element) return;
    operation.current++;
    const next = (indexRef.current + step + tracks.length) % tracks.length;
    indexRef.current = next;
    setIndex(next);
    setCurrent(0);
    setDuration(0);
    element.src = tracks[next].src;
    element.load();
    rememberPaused(false);
    void play();
  }
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    let paused = false;
    try {
      paused = localStorage.getItem("ffg-music-paused") === "true";
      const stored = localStorage.getItem("ffg-music-volume");
      const saved = stored === null ? 0.35 : Number(stored);
      const level = Number.isFinite(saved)
        ? Math.max(0, Math.min(1, saved))
        : 0.35;
      element.volume = level;
      // Synchronize the UI with the persisted browser/audio setting on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVolume(level);
    } catch {
      element.volume = 0.35;
    }
    if (!paused) void play();
    return () => {
      operation.current++;
      element.pause();
    };
  }, []);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: "FCK FAMOUS GROUP",
    });
    navigator.mediaSession.setActionHandler("play", () => {
      rememberPaused(false);
      void play();
    });
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      changeTrack(-1),
    );
    navigator.mediaSession.setActionHandler("nexttrack", () => changeTrack(1));
    return () => {
      for (const action of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
      ] as const)
        navigator.mediaSession.setActionHandler(action, null);
    };
  }, [index]);
  return (
    <section className="music-player" aria-label={tr("Музичний плеєр FFG")}>
      <audio
        ref={audio}
        src={tracks[0].src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          setBlocked(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => changeTrack(1)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      <div className="player-controls">
        <button
          className="player-skip"
          aria-label={tr("Попередній трек")}
          onClick={() => changeTrack(-1)}
        >
          <span className="previous-icon" aria-hidden="true">
            ▮◀
          </span>
        </button>
        <button
          className="player-toggle"
          aria-label={
            playing ? tr("Призупинити музику") : tr("Увімкнути музику")
          }
          onClick={() => {
            if (playing) pause();
            else {
              rememberPaused(false);
              if (failed) audio.current?.load();
              void play();
            }
          }}
        >
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
        </button>
        <button
          className="player-skip"
          aria-label={tr("Наступний трек")}
          onClick={() => changeTrack(1)}
        >
          <span aria-hidden="true">▶▮</span>
        </button>
      </div>
      <div className="player-track">
        <span className="player-caption">
          {failed
            ? tr("Не вдалося завантажити трек")
            : blocked
              ? tr("Натисни ▶, щоб слухати")
              : playing
                ? tr("ЗАРАЗ ГРАЄ")
                : "FFG / KYIV"}
        </span>
        <span className="track-name" title={`${track.title} — ${track.artist}`}>
          {track.title}
        </span>
        <span className="track-artist">{track.artist}</span>
      </div>
      <div className="player-progress">
        <span>{timestamp(current)}</span>
        <input
          type="range"
          aria-label={tr("Позиція відтворення")}
          min="0"
          max={duration || 1}
          step="1"
          value={Math.min(current, duration || 0)}
          disabled={!duration}
          aria-valuetext={`${timestamp(current)} ${t("з", "of")} ${timestamp(duration)}`}
          onChange={(event) => {
            if (audio.current && duration) {
              audio.current.currentTime = Number(event.target.value);
              setCurrent(Number(event.target.value));
            }
          }}
        />
        <span>{timestamp(duration)}</span>
      </div>
      <div className="player-volume">
        <button
          aria-label={muted ? tr("Увімкнути звук") : tr("Вимкнути звук")}
          aria-pressed={muted}
          onClick={() => {
            if (audio.current) audio.current.muted = !audio.current.muted;
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="M14 16V3l6 3v4l-6-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <ellipse cx="10.5" cy="17.5" rx="3.5" ry="2.5" fill="currentColor" />
            {muted && <path d="M4 3l16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
          </svg>
        </button>
        <input
          type="range"
          aria-label={tr("Гучність")}
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => {
            const value = Number(event.target.value);
            setVolume(value);
            if (audio.current) {
              audio.current.volume = value;
              audio.current.muted = false;
            }
            try {
              localStorage.setItem("ffg-music-volume", String(value));
            } catch {}
          }}
        />
      </div>
      <span className="track-number">
        {index + 1} / {tracks.length}
      </span>
    </section>
  );
}
