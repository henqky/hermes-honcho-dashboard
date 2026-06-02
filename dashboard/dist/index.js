(function () {
  "use strict";

  var SDK = window.__HERMES_PLUGIN_SDK__;
  var React = SDK.React;
  var hooks = SDK.hooks;
  var useState = hooks.useState;
  var useEffect = hooks.useEffect;
  var useCallback = hooks.useCallback;
  var api = SDK.fetchJSON;
  var cn = SDK.utils.cn;

  var components = SDK.components;
  var Card = components.Card;
  var CardHeader = components.CardHeader;
  var CardTitle = components.CardTitle;
  var CardContent = components.CardContent;
  var Badge = components.Badge;
  var Button = components.Button;
  var Input = components.Input;
  var Separator = components.Separator;
  var Tabs = components.Tabs;
  var TabsList = components.TabsList;
  var TabsTrigger = components.TabsTrigger;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function StatCard(props) {
    return React.createElement(Card, { className: "honcho-stat-card" },
      React.createElement(CardHeader, { className: "honcho-stat-header" },
        React.createElement("div", { className: "honcho-stat-label" }, props.label),
        React.createElement("div", { className: "honcho-stat-value" }, props.value),
      ),
      props.subtitle && React.createElement(CardContent, { className: "honcho-stat-subtitle" }, props.subtitle)
    );
  }

  function LoadingSpinner() {
    return React.createElement("div", { className: "honcho-loading" },
      React.createElement("span", { className: "honcho-spinner" }, "⟳"),
      React.createElement("span", null, " Loading...")
    );
  }

  function ErrorBox(props) {
    return React.createElement("div", { className: "honcho-error" },
      React.createElement("p", null, "⚠ ", props.message)
    );
  }

  // -----------------------------------------------------------------------
  // 1. Peer Card Tab
  // -----------------------------------------------------------------------

  function PeerCardTab() {
    var dataRef = React.useRef(null);
    var loadRef = React.useRef(false);
    var _ = React.useState({});
    var setRender = _[1];
    
    useEffect(function () {
      if (loadRef.current) return;
      loadRef.current = true;
      api("/api/plugins/honcho-dashboard/profile")
        .then(function (d) { dataRef.current = d; setRender({}); })
        .catch(function (e) { dataRef.current = { error: e.message }; setRender({}); });
    }, []);

    if (!dataRef.current) return React.createElement(LoadingSpinner);
    var d = dataRef.current;
    if (d.error) return React.createElement(ErrorBox, { message: d.error });

    var userFacts = (d.user && d.user.facts) || [];
    var aiFacts = (d.ai && d.ai.facts) || [];

    return React.createElement("div", { className: "honcho-peer-grid" },

      // User Peer Card
      React.createElement("div", { className: "honcho-peer-section" },
        React.createElement("div", { className: "honcho-peer-header" },
          React.createElement("span", { className: "honcho-peer-avatar" }, "👤"),
          React.createElement("div", null,
            React.createElement("h3", { className: "honcho-peer-title" }, "Your Profile"),
            React.createElement("span", { className: "honcho-peer-name" }, d.user_peer_name || "user"),
            React.createElement(Badge, { className: "honcho-badge-count" }, userFacts.length + " facts"),
          ),
        ),
        userFacts.length > 0
          ? React.createElement("ul", { className: "honcho-fact-list" },
              userFacts.map(function (f, i) {
                return React.createElement("li", { key: i, className: "honcho-fact-item" }, f);
              })
            )
          : React.createElement("p", { className: "honcho-empty" }, "No facts learned yet. Honcho builds your profile as you chat."),
        d.user_representation
          ? React.createElement("div", { className: "honcho-representation" },
              React.createElement("strong", null, "Representation: "),
              d.user_representation
            )
          : null,
      ),

      // AI Peer Card
      React.createElement("div", { className: "honcho-peer-section" },
        React.createElement("div", { className: "honcho-peer-header" },
          React.createElement("span", { className: "honcho-peer-avatar" }, "🤖"),
          React.createElement("div", null,
            React.createElement("h3", { className: "honcho-peer-title" }, "AI Self-Model"),
            React.createElement("span", { className: "honcho-peer-name" }, d.ai_peer_name || "hermes"),
            React.createElement(Badge, { className: "honcho-badge-count" }, aiFacts.length + " facts"),
          ),
        ),
        aiFacts.length > 0
          ? React.createElement("ul", { className: "honcho-fact-list" },
              aiFacts.map(function (f, i) {
                return React.createElement("li", { key: i, className: "honcho-fact-item ai-fact" }, f);
              })
            )
          : React.createElement("p", { className: "honcho-empty" }, "No self-observations yet."),
        d.ai_representation
          ? React.createElement("div", { className: "honcho-representation ai-rep" },
              React.createElement("strong", null, "Representation: "),
              d.ai_representation
            )
          : null,
      ),
    );
  }

  // -----------------------------------------------------------------------
  // 2. Model Info Tab (embedded LLM model)
  // -----------------------------------------------------------------------

  function ModelTab() {
    var dataRef = React.useRef(null);
    var loadRef = React.useRef(false);
    var _ = React.useState({});
    var setRender = _[1];

    useEffect(function () {
      if (loadRef.current) return;
      loadRef.current = true;
      api("/api/plugins/honcho-dashboard/model")
        .then(function (d) { dataRef.current = d; setRender({}); })
        .catch(function (e) { dataRef.current = { error: e.message }; setRender({}); });
    }, []);

    if (!dataRef.current) return React.createElement(LoadingSpinner);
    var d = dataRef.current;
    if (d.error) return React.createElement(ErrorBox, { message: d.error });

    var dm = d.docker_models || {};
    var primary = dm.primary_model || "unknown";
    var transport = dm.transport || "unknown";
    var embedding = dm.embedding_model || "unknown";
    var summary = dm.summary_model || "unknown";
    var dream = dm.dream_model || "unknown";
    var levels = dm.dialectic_levels || {};

    return React.createElement("div", { className: "honcho-model-grid" },

      // Primary model card
      React.createElement(Card, { className: "honcho-model-hero" },
        React.createElement(CardHeader, null,
          React.createElement("div", { className: "honcho-model-icon" }, "🧠"),
          React.createElement(CardTitle, null, "Primary Reasoning Model"),
        ),
        React.createElement(CardContent, null,
          React.createElement("div", { className: "honcho-model-name" }, primary),
          React.createElement("div", { className: "honcho-model-meta" },
            React.createElement("span", null, "Transport: "),
            React.createElement(Badge, { className: "honcho-badge-transport" }, transport),
          ),
        ),
      ),

      // Supporting models
      React.createElement("div", { className: "honcho-model-side" },
        StatCard({ label: "Embedding", value: embedding }),
        StatCard({ label: "Summarization", value: summary }),
        StatCard({ label: "Dream Engine", value: dream }),
      ),

      // Dialectic levels
      Object.keys(levels).length > 0 && React.createElement(Card, { className: "honcho-model-levels" },
        React.createElement(CardHeader, null,
          React.createElement(CardTitle, null, "Dialectic Reasoning Levels"),
        ),
        React.createElement(CardContent, null,
          React.createElement("div", { className: "honcho-levels-grid" },
            Object.keys(levels).sort().map(function (level) {
              var l = levels[level];
              return React.createElement("div", { key: level, className: "honcho-level-card" },
                React.createElement("div", { className: "honcho-level-label" }, level),
                React.createElement("div", { className: "honcho-level-model" }, l.model || l.models || "—"),
                l.transport && React.createElement(Badge, { className: "honcho-badge-level" }, l.transport),
              );
            })
          ),
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // 3. Semantic Search Tab
  // -----------------------------------------------------------------------

  function SearchTab() {
    var queryRef = React.useRef("");
    var resultsRef = React.useRef(null);
    var loadingRef = React.useRef(false);
    var _ = React.useState({});
    var setRender = _[1];

    var doSearch = useCallback(function () {
      var q = queryRef.current.trim();
      if (!q) return;
      loadingRef.current = true;
      resultsRef.current = null;
      setRender({});
      api("/api/plugins/honcho-dashboard/search?q=" + encodeURIComponent(q) + "&max_tokens=800")
        .then(function (d) {
          resultsRef.current = d;
          loadingRef.current = false;
          setRender({});
        })
        .catch(function (e) {
          resultsRef.current = { error: e.message };
          loadingRef.current = false;
          setRender({});
        });
    }, []);

    return React.createElement("div", { className: "honcho-search" },
      React.createElement("div", { className: "honcho-search-bar" },
        React.createElement(Input, {
          placeholder: "Search your memory... (e.g. kanban, KidCore, Shopee)",
          onChange: function (e) { queryRef.current = e.target.value; },
          onKeyDown: function (e) { if (e.key === "Enter") doSearch(); },
          className: "honcho-search-input",
        }),
        React.createElement(Button, { onClick: doSearch, className: "honcho-search-btn" }, "Search"),
      ),

      loadingRef.current && React.createElement(LoadingSpinner),

      resultsRef.current && !loadingRef.current && (function () {
        var r = resultsRef.current;
        if (r.error) return React.createElement(ErrorBox, { message: r.error });
        var results = r.results || [];
        if (results.length === 0) {
          return React.createElement("p", { className: "honcho-empty" },
            "No results for \"" + r.query + "\". Honcho may not have observed this topic yet."
          );
        }
        return React.createElement("div", { className: "honcho-results" },
          React.createElement("p", { className: "honcho-results-count" },
            results.length + " result" + (results.length !== 1 ? "s" : "") + " for \"" + r.query + "\""
          ),
          results.map(function (res, i) {
            return React.createElement("div", { key: i, className: "honcho-result-card" },
              res.relevance !== undefined && res.relevance !== null && React.createElement("div", { className: "honcho-relevance" },
                React.createElement("div", {
                  className: "honcho-relevance-bar",
                  style: { width: Math.round((res.relevance || 0) * 100) + "%" }
                }),
                React.createElement("span", null, Math.round((res.relevance || 0) * 100) + "% match"),
              ),
              React.createElement("p", { className: "honcho-result-text" }, res.content),
            );
          })
        );
      })(),
    );
  }

  // -----------------------------------------------------------------------
  // 4. Health Tab
  // -----------------------------------------------------------------------

  function HealthTab() {
    var dataRef = React.useRef(null);
    var loadRef = React.useRef(false);
    var _ = React.useState({});
    var setRender = _[1];

    useEffect(function () {
      if (loadRef.current) return;
      loadRef.current = true;
      api("/api/plugins/honcho-dashboard/health")
        .then(function (d) { dataRef.current = d; setRender({}); })
        .catch(function (e) { dataRef.current = { error: e.message }; setRender({}); });
    }, []);

    if (!dataRef.current) return React.createElement(LoadingSpinner);
    var d = dataRef.current;
    if (d.error && !d.honcho_available) return React.createElement(ErrorBox, { message: d.error });

    return React.createElement("div", { className: "honcho-health" },

      // Status indicator
      React.createElement("div", { className: "honcho-health-status" },
        React.createElement("div", {
          className: "honcho-status-dot " + (d.honcho_available ? "status-online" : "status-offline")
        }),
        React.createElement("span", { className: "honcho-status-text" },
          d.honcho_available ? "Honcho Connected" : "Honcho Unavailable"
        ),
        d.base_url && React.createElement("span", { className: "honcho-status-url" }, d.base_url),
      ),

      Separator && React.createElement(Separator, null),

      // Stat grid
      React.createElement("div", { className: "honcho-stats-grid" },
        StatCard({ label: "User Peer Facts", value: d.user_peer_facts }),
        StatCard({ label: "AI Peer Facts", value: d.ai_peer_facts }),
        StatCard({ label: "Active Sessions", value: d.active_sessions }),
        StatCard({ label: "Total Peers", value: d.total_peers }),
      ),

      Separator && React.createElement(Separator, null),

      // Config grid
      React.createElement("div", { className: "honcho-config-section" },
        React.createElement("h3", { className: "honcho-section-title" }, "Configuration"),
        React.createElement("div", { className: "honcho-config-grid" },
          ConfigRow({ label: "Workspace", value: d.workspace }),
          ConfigRow({ label: "Recall Mode", value: d.recall_mode }),
          ConfigRow({ label: "Observation", value: d.observation_mode }),
          ConfigRow({ label: "Session Strategy", value: d.session_strategy }),
          ConfigRow({ label: "Dialectic Cadence", value: d.dialectic_cadence + " turns" }),
          ConfigRow({ label: "Dialectic Depth", value: d.dialectic_depth }),
          ConfigRow({ label: "Reasoning Level", value: d.dialectic_reasoning_level }),
          ConfigRow({ label: "Write Frequency", value: d.write_frequency }),
        ),
      ),
    );
  }

  function ConfigRow(props) {
    return React.createElement("div", { className: "honcho-config-row" },
      React.createElement("span", { className: "honcho-config-label" }, props.label),
      React.createElement("span", { className: "honcho-config-value" }, props.value),
    );
  }

  // -----------------------------------------------------------------------
  // Main component — 4-tab layout
  // -----------------------------------------------------------------------

  function HonchoDashboard() {
    var _ = useState("peers");
    var activeTab = _[0];
    var setActiveTab = _[1];

    return React.createElement("div", { className: "honcho-dashboard" },
      // Header
      React.createElement("div", { className: "honcho-header" },
        React.createElement("div", null,
          React.createElement("h2", { className: "honcho-title" }, "🧠 Honcho Memory"),
          React.createElement("p", { className: "honcho-subtitle" },
            "AI-native memory — peer cards, semantic search, LLM model info"
          ),
        ),
      ),

      // Tabs
      React.createElement(Tabs, { value: activeTab, onValueChange: setActiveTab, className: "honcho-tabs" },
        React.createElement(TabsList, { className: "honcho-tabs-list" },
          React.createElement(TabsTrigger, { value: "peers" }, "👤 Peer Cards"),
          React.createElement(TabsTrigger, { value: "model" }, "🧠 Model"),
          React.createElement(TabsTrigger, { value: "search" }, "🔍 Search"),
          React.createElement(TabsTrigger, { value: "health" }, "📊 Health"),
        ),

        // Tab panels
        React.createElement("div", { className: "honcho-tab-panel" },
          activeTab === "peers" && React.createElement(PeerCardTab),
          activeTab === "model" && React.createElement(ModelTab),
          activeTab === "search" && React.createElement(SearchTab),
          activeTab === "health" && React.createElement(HealthTab),
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Register
  // -----------------------------------------------------------------------

  window.__HERMES_PLUGINS__.register("honcho-dashboard", HonchoDashboard);
})();
