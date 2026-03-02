"use client";

import { useState, useEffect, useCallback } from "react";

interface Config {
  port: string;
  relay_port: string;
  watch_dir: string;
  twitch_key: string;
  youtube_key: string;
  resolution: string;
  bitrate: string;
  watermark_text: string;
  watermark_visible: string;
  qr_url: string;
  task_timeout: string;
  task_pause: string;
}

const DEFAULT_CONFIG: Config = {
  port: "3000",
  relay_port: "8765",
  watch_dir: "~/.openclaw/agents/main/sessions/",
  twitch_key: "",
  youtube_key: "",
  resolution: "1920x1080",
  bitrate: "6500k",
  watermark_text: "AgentReel",
  watermark_visible: "true",
  qr_url: "",
  task_timeout: "300",
  task_pause: "120",
};

const FIELD_GROUPS = [
  {
    title: "Viewer",
    fields: [
      { key: "port", label: "Port", type: "text", help: "Viewer HTTP port" },
      {
        key: "relay_port",
        label: "Relay Port",
        type: "text",
        help: "SSE relay server port",
      },
      {
        key: "watch_dir",
        label: "Sessions Directory",
        type: "text",
        help: "Path to OpenClaw JSONL sessions",
      },
    ],
  },
  {
    title: "Streaming (RTMP)",
    fields: [
      {
        key: "twitch_key",
        label: "Twitch Stream Key",
        type: "password",
        help: "Get from twitch.tv/dashboard/settings",
      },
      {
        key: "youtube_key",
        label: "YouTube Stream Key",
        type: "password",
        help: "Get from studio.youtube.com",
      },
      {
        key: "resolution",
        label: "Resolution",
        type: "select",
        options: ["1280x720", "1920x1080", "2560x1440"],
        help: "Stream resolution",
      },
      {
        key: "bitrate",
        label: "Bitrate",
        type: "select",
        options: ["4500k", "6500k", "8000k", "12000k"],
        help: "Higher = better quality, more bandwidth",
      },
    ],
  },
  {
    title: "Overlay",
    fields: [
      {
        key: "watermark_text",
        label: "Watermark Text",
        type: "text",
        help: "Displayed on broadcast overlay",
      },
      {
        key: "watermark_visible",
        label: "Show Watermark",
        type: "toggle",
        help: "Toggle watermark visibility",
      },
      {
        key: "qr_url",
        label: "QR Code URL",
        type: "text",
        help: "URL encoded in the feedback QR code",
      },
    ],
  },
  {
    title: "Task Loop",
    fields: [
      {
        key: "task_timeout",
        label: "Task Timeout (s)",
        type: "text",
        help: "Max seconds per task",
      },
      {
        key: "task_pause",
        label: "Pause Between Tasks (s)",
        type: "text",
        help: "Seconds to wait between tasks",
      },
    ],
  },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname;
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.");
    setIsLocal(local);

    if (local) {
      fetch("/api/settings")
        .then((r) => (r.ok ? r.json() : DEFAULT_CONFIG))
        .then((data) => {
          setConfig({ ...DEFAULT_CONFIG, ...data });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (key: string, value: string) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    []
  );

  const handleSave = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Save failed
    }
  }, [config]);

  if (!isLocal) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-white mb-2">
            Settings — Local Access Only
          </h1>
          <p className="text-gray-400 text-sm">
            Configuration is only available when accessing from localhost.
            <br />
            Use <code className="text-cyan-400">agentreel config</code> via CLI
            instead.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-400">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">AgentReel Settings</h1>
            <p className="text-gray-400 text-sm mt-1">
              Configure your local AgentReel instance
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </a>
        </div>

        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="mb-8">
            <h2 className="text-lg font-semibold text-cyan-400 mb-4 pb-2 border-b border-gray-800">
              {group.title}
            </h2>
            <div className="space-y-4">
              {group.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">
                    {field.label}
                  </label>
                  {field.type === "toggle" ? (
                    <button
                      onClick={() =>
                        handleChange(
                          field.key,
                          config[field.key as keyof Config] === "true"
                            ? "false"
                            : "true"
                        )
                      }
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        config[field.key as keyof Config] === "true"
                          ? "bg-cyan-500"
                          : "bg-gray-700"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          config[field.key as keyof Config] === "true"
                            ? "translate-x-6"
                            : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  ) : field.type === "select" ? (
                    <select
                      value={config[field.key as keyof Config]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={config[field.key as keyof Config]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={DEFAULT_CONFIG[field.key as keyof Config]}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-600"
                    />
                  )}
                  <span className="text-xs text-gray-500">{field.help}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Save Configuration
          </button>
          {saved && (
            <span className="text-green-400 text-sm">✓ Saved</span>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            Config file: ~/.agentreel/config.json
          </span>
        </div>

        <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-2">
            CLI Alternative
          </h3>
          <code className="text-xs text-cyan-400 block">
            agentreel config set port 3001
            <br />
            agentreel config set twitch_key YOUR_KEY
            <br />
            agentreel config get port
          </code>
        </div>
      </div>
    </div>
  );
}
