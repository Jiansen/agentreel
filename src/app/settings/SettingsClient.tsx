"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Config {
  visibility: string;
  live_token: string;
  port: string;
  relay_port: string;
  watch_dir: string;
  twitch_key: string;
  youtube_key: string;
  resolution: string;
  bitrate: string;
}

const DEFAULT_CONFIG: Config = {
  visibility: "public",
  live_token: "",
  port: "3000",
  relay_port: "8765",
  watch_dir: "~/.openclaw/agents/main/sessions/",
  twitch_key: "",
  youtube_key: "",
  resolution: "1920x1080",
  bitrate: "6500k",
};

interface FieldDef {
  key: string;
  label: string;
  type: string;
  help: string;
  options?: string[];
  visibleWhen?: (config: Config) => boolean;
}

interface FieldGroup {
  title: string;
  fields: FieldDef[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Access Control",
    fields: [
      {
        key: "visibility",
        label: "Live Page Visibility",
        type: "radio",
        options: ["public", "private"],
        help: "Public: anyone can view /live. Private: viewers need a token.",
      },
      {
        key: "live_token",
        label: "Viewer Token",
        type: "text",
        help: "Short token viewers enter to access /live. Share links include it automatically.",
        visibleWhen: (c) => c.visibility === "private",
      },
    ],
  },
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
];

function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return (
    document.cookie.replace(
      /(?:(?:^|.*;\s*)agentreel_token\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    ) ||
    localStorage.getItem("agentreel_token") ||
    ""
  );
}

function storeToken(token: string) {
  document.cookie = `agentreel_token=${token}; path=/; max-age=31536000; SameSite=Strict`;
  localStorage.setItem("agentreel_token", token);
}

export default function SettingsClient() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [newAdminToken, setNewAdminToken] = useState("");
  const [showAdminToken, setShowAdminToken] = useState(false);

  const loadConfig = useCallback((token?: string) => {
    const t = token || getStoredToken();
    const headers: Record<string, string> = {};
    if (t) headers["Authorization"] = `Bearer ${t}`;

    fetch("/api/settings", { headers })
      .then((r) => {
        if (r.status === 401) {
          setAuthError(true);
          setLoading(false);
          return null;
        }
        setAuthError(false);
        return r.ok ? r.json() : DEFAULT_CONFIG;
      })
      .then((data) => {
        if (data) {
          setConfig({ ...DEFAULT_CONFIG, ...data });
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleChange = useCallback((key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const t = getStoredToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (t) headers["Authorization"] = `Bearer ${t}`;

      const payload: Record<string, string> = { ...config };
      if (newAdminToken.trim()) {
        payload._admin_token = newAdminToken.trim();
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        setSaved(true);
        if (newAdminToken.trim()) {
          storeToken(newAdminToken.trim());
          setNewAdminToken("");
        }
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      /* Save failed */
    }
  }, [config, newAdminToken]);

  if (authError) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-white mb-2">
            Admin Token Required
          </h1>
          <p className="text-gray-400 text-sm mb-4">
            Enter the token from your installation to access settings.
            <br />
            Find it with:{" "}
            <code className="text-cyan-400">
              agentreel config get _admin_token
            </code>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tokenInput.trim()) {
                storeToken(tokenInput.trim());
                setAuthError(false);
                setLoading(true);
                loadConfig(tokenInput.trim());
              }
            }}
            className="flex gap-2"
          >
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste admin token..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Unlock
            </button>
          </form>
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
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        </div>

        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="mb-8">
            <h2 className="text-lg font-semibold text-cyan-400 mb-4 pb-2 border-b border-gray-800">
              {group.title}
            </h2>
            <div className="space-y-4">
              {group.fields.map((field) => {
                if (field.visibleWhen && !field.visibleWhen(config)) {
                  return null;
                }
                return (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-300">
                      {field.label}
                    </label>
                    {field.type === "radio" && field.options ? (
                      <div className="flex gap-3">
                        {field.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleChange(field.key, opt)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              config[field.key as keyof Config] === opt
                                ? "bg-cyan-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                          </button>
                        ))}
                      </div>
                    ) : field.type === "toggle" ? (
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
                );
              })}
            </div>
          </div>
        ))}

        {/* Security section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-cyan-400 mb-4 pb-2 border-b border-gray-800">
            Security
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">
                Change Admin Token
              </label>
              <div className="flex gap-2">
                <input
                  type={showAdminToken ? "text" : "password"}
                  value={newAdminToken}
                  onChange={(e) => {
                    setNewAdminToken(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Leave blank to keep current token"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={() => setShowAdminToken(!showAdminToken)}
                  className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs hover:text-white transition-colors"
                  type="button"
                >
                  {showAdminToken ? "Hide" : "Show"}
                </button>
              </div>
              <span className="text-xs text-gray-500">
                This token protects your settings page. Save to apply.
              </span>
            </div>
          </div>
        </div>

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

        <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-2">
            Need more features?
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            Task automation, custom overlays, and more are on our roadmap.
          </p>
          <a
            href="https://github.com/Jiansen/agentreel/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            File a feature request on GitHub →
          </a>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-gray-600">
          <span>Powered by</span>
          <a
            href="https://github.com/Jiansen/agentreel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-400 transition-colors"
          >
            AgentReel
          </a>
          <span>·</span>
          <span>Open Source (MIT)</span>
        </div>
      </div>
    </div>
  );
}
