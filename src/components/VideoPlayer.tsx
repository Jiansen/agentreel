"use client";

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

export interface VideoPlayerHandle {
  seekTo: (timeSeconds: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ src, onTimeUpdate, onPlay, onPause, onEnded }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo(t: number) {
        if (videoRef.current) videoRef.current.currentTime = t;
      },
      getCurrentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
      play() {
        videoRef.current?.play();
      },
      pause() {
        videoRef.current?.pause();
      },
    }));

    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current && onTimeUpdate) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    }, [onTimeUpdate]);

    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      el.addEventListener("timeupdate", handleTimeUpdate);
      return () => el.removeEventListener("timeupdate", handleTimeUpdate);
    }, [handleTimeUpdate]);

    const isYouTube =
      src.includes("youtube.com") || src.includes("youtu.be");

    if (isYouTube) {
      const videoId = extractYouTubeId(src);
      if (videoId) {
        return (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video replay"
            />
          </div>
        );
      }
    }

    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          controls
          className="max-w-full max-h-full"
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }
);

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export default VideoPlayer;
