import { NextRequest } from "next/server";

const YT_API_KEY = process.env.YOUTUBE_AGENTREEL_API_KEY;
const YT_CHANNEL_ID = process.env.YOUTUBE_AGENTREEL_CHANNEL_ID;
const TWITCH_CLIENT_ID = process.env.TWITCH_AGENTREEL_CLIENT_ID;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_AGENTREEL_ACCESS_TOKEN;
const TWITCH_LOGIN = "jiansenhe";

interface LiveStatus {
  youtube: { live: boolean; url?: string; title?: string };
  twitch: { live: boolean; url?: string; title?: string };
}

let cache: { data: LiveStatus; ts: number } | null = null;
const CACHE_TTL = 60_000; // 60s

async function checkYouTube(): Promise<LiveStatus["youtube"]> {
  if (!YT_API_KEY || !YT_CHANNEL_ID) return { live: false };
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YT_CHANNEL_ID}&eventType=live&type=video&key=${YT_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { live: false };
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        live: true,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        title: item.snippet?.title,
      };
    }
    return { live: false };
  } catch {
    return { live: false };
  }
}

async function checkTwitch(): Promise<LiveStatus["twitch"]> {
  if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN) return { live: false };
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_LOGIN}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { live: false };
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const stream = data.data[0];
      return {
        live: true,
        url: `https://www.twitch.tv/${TWITCH_LOGIN}`,
        title: stream.title,
      };
    }
    return { live: false };
  } catch {
    return { live: false };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return Response.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  const [youtube, twitch] = await Promise.all([
    checkYouTube(),
    checkTwitch(),
  ]);

  const status: LiveStatus = { youtube, twitch };
  cache = { data: status, ts: Date.now() };

  return Response.json(status, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
