(function () {
  "use strict";

  var MAX_POLL = 200;
  var POLL_MS = 25;

  function poll() {
    var SDK = window.__HERMES_PLUGIN_SDK__;
    if (!SDK || !window.__HERMES_PLUGINS__) {
      if (--MAX_POLL > 0) return setTimeout(poll, POLL_MS);
      console.error("[honcho] SDK never became available after 5s");
      return;
    }

    var R = SDK.React;
    var hooks = SDK.hooks;
    var C = SDK.components || {};
    var token = window.__HERMES_SESSION_TOKEN__ || "";
    var BASE = "/api/plugins/honcho-dashboard";

    console.log("[honcho] SDK ready. components:", Object.keys(C), "has token:", !!token);

    // ── API helper ──────────────────────────────────────────────────────
    function api(path) {
      return fetch(BASE + path, {
        headers: token ? { "Authorization": "Bearer " + token } : {}
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " " + r.statusText);
        return r.json();
      });
    }

    // ── Stat card (numeric) ─────────────────────────────────────────────
    function StatCard(props) {
      return R.createElement("div", {
        style: {
          padding: "1.2rem", borderRadius: "12px",
          background: "var(--theme-midground, #f0ece8)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          minWidth: "180px", flex: "1"
        }
      },
        R.createElement("div", { style: { fontSize: "0.8rem", opacity: 0.6, marginBottom: "4px" } }, props.label),
        R.createElement("div", { style: { fontSize: "1.6rem", fontWeight: 700 } }, props.value ?? "\u2014")
      );
    }

    // ── Profile card (text repr) ────────────────────────────────────────
    function ProfileCard(props) {
      var text = props.value || "";
      // Truncate to ~600 chars for the card view
      var truncated = text.length > 600 ? text.substring(0, 600) + "\u2026" : text;
      return R.createElement("div", {
        style: {
          padding: "1.2rem", borderRadius: "12px",
          background: "var(--theme-midground, #f0ece8)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          flex: "1 1 340px", minWidth: "260px", maxWidth: "100%"
        }
      },
        R.createElement("div", { style: { fontSize: "0.8rem", opacity: 0.6, marginBottom: "8px" } }, props.label),
        truncated
          ? R.createElement("div", {
              style: {
                fontSize: "0.8rem", lineHeight: "1.55", whiteSpace: "pre-wrap",
                maxHeight: "220px", overflowY: "auto",
                color: "var(--theme-foreground, #333)"
              }
            }, truncated)
          : R.createElement("div", { style: { fontSize: "0.85rem", opacity: 0.4, fontStyle: "italic" } },
              "No profile generated yet \u2014 Honcho\u2019s dialectic process will populate this over time.")
      );
    }

    // ── Main component ─────────────────────────────────────────────────
    function HonchoDashboard() {
      var _s = hooks.useState("loading"), state = _s[0], setState = _s[1];
      var _d = hooks.useState(null), data = _d[0], setData = _d[1];
      var _e = hooks.useState(null), error = _e[0], setError = _e[1];

      hooks.useEffect(function () {
        api("/health")
          .then(function (d) { setData(d); setState("ok"); })
          .catch(function (e) { setError(e.message); setState("error"); });
      }, []);

      // Loading
      if (state === "loading") {
        return R.createElement("div", { style: { padding: "3rem", textAlign: "center", opacity: 0.6 } },
          R.createElement("p", null, "\u27f3 Connecting to Honcho\u2026"));
      }

      // Error
      if (state === "error") {
        return R.createElement("div", {
          style: { padding: "2rem", margin: "1rem", borderRadius: "12px",
                   background: "rgba(255,0,0,0.08)", color: "var(--theme-foreground, #333)" }
        },
          R.createElement("h3", null, "\u26a0\ufe0f Memory Service Unavailable"),
          R.createElement("p", { style: { opacity: 0.7 } }, error || "Could not reach Honcho.")
        );
      }

      // Success — render dashboard
      return R.createElement("div", {
        style: { padding: "2rem", maxWidth: "960px", margin: "0 auto" }
      },
        // Header
        R.createElement("div", { style: { marginBottom: "2rem" } },
          R.createElement("h2", { style: { marginBottom: "0.3rem" } }, "\ud83e\udde0 Honcho Memory"),
          R.createElement("p", { style: { opacity: 0.6, margin: 0 } },
            "AI-native memory. Reasoning: Gemma-4 | Embed: gemini-embedding-2")
        ),

        // Profile cards (span full width, stacked vertically on narrow screens)
        R.createElement("div", {
          style: { display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }
        },
          R.createElement(ProfileCard, { label: "User Profile \u2014 " + (data.user_peer_name || "you"), value: data.user_representation }),
          R.createElement(ProfileCard, { label: "AI Profile \u2014 " + (data.ai_peer_name || "hermes"), value: data.ai_representation })
        ),

        // Stat cards (numeric)
        R.createElement("div", {
          style: { display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }
        },
          R.createElement(StatCard, { label: "Active Sessions", value: data.active_sessions }),
          R.createElement(StatCard, { label: "Total Peers", value: data.total_peers })
        ),

        // Refresh button
        R.createElement("button", {
          onClick: function () {
            setState("loading"); setError(null);
            api("/health").then(function (d) { setData(d); setState("ok"); })
              .catch(function (e) { setError(e.message); setState("error"); });
          },
          style: {
            padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--theme-accent, #ff8c00)",
            background: "transparent", color: "var(--theme-foreground, #333)", cursor: "pointer",
            fontSize: "0.85rem"
          }
        }, "\ud83d\udd04 Refresh")
      );
    }

    window.__HERMES_PLUGINS__.register("honcho-dashboard", HonchoDashboard);
    console.log("[honcho] Plugin registered");
  }

  poll();
})();
