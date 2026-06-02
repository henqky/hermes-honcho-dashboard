"""
Honcho Dashboard — backend API routes.

Mounted at /api/plugins/honcho-dashboard/ by the Hermes dashboard plugin system.
Provides endpoints for the Memory tab: peer cards, semantic search, session
timeline, memory health stats, and Honcho LLM model info.
"""

from __future__ import annotations

import json
import logging
import subprocess
from typing import Any

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Honcho client helpers
# ---------------------------------------------------------------------------

_HONCHO_AVAILABLE = False

try:
    import sys
    from pathlib import Path
    _HERMES_SRC = Path.home() / ".hermes" / "hermes-agent"
    if str(_HERMES_SRC) not in sys.path:
        sys.path.insert(0, str(_HERMES_SRC))
    from plugins.memory.honcho.client import HonchoClientConfig, get_honcho_client
    from plugins.memory.honcho.session import HonchoSessionManager
    _HONCHO_AVAILABLE = True
except Exception as e:
    logger.warning("Honcho client import failed: %s", e)


def _get_client():
    """Return (Honcho, HonchoClientConfig) or (None, None) if unavailable."""
    if not _HONCHO_AVAILABLE:
        return None, None
    try:
        cfg = HonchoClientConfig.from_global_config()
        if not cfg.enabled or not (cfg.api_key or cfg.base_url):
            return None, None
        client = get_honcho_client(cfg)
        return client, cfg
    except Exception as e:
        logger.warning("Honcho client init failed: %s", e)
        return None, None


def _get_peer_card(client: Any, peer: str) -> dict[str, Any]:
    """Fetch a peer card, returning a normalized dict.

    Honcho SDK uses ``peer.get_card()`` (singular), which returns a single
    Card object or None — NOT a list.
    """
    try:
        card = client.peer(peer).get_card()
        if card is not None:
            content = card.content if hasattr(card, "content") else str(card)
            return {"id": peer, "facts": [content], "count": 1}
        return {"id": peer, "facts": [], "count": 0}
    except Exception as e:
        return {"id": peer, "facts": [], "count": 0, "error": str(e)}


def _get_representation(client: Any, peer: str) -> str:
    """Get Honcho's evolving representation of a peer."""
    try:
        rep = client.peer(peer).representation()
        return str(rep) if rep else ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Model info (from Docker + Honcho config)
# ---------------------------------------------------------------------------

def _fetch_docker_model_env() -> dict[str, str]:
    """Extract Honcho model configuration from Docker container env vars."""
    try:
        result = subprocess.run(
            [
                "docker", "inspect", "honcho-deriver-1",
                "--format", "{{range .Config.Env}}{{println .}}{{end}}",
            ],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return {}
        env_vars: dict[str, str] = {}
        for line in result.stdout.strip().split("\n"):
            line = line.strip()
            if "=" in line:
                key, val = line.split("=", 1)
                env_vars[key] = val
        return env_vars
    except Exception as e:
        logger.debug("Docker model env fetch failed: %s", e)
        return {}


def _build_model_info(env: dict[str, str]) -> dict[str, Any]:
    """Parse Docker env vars into a structured model info dict."""
    models: dict[str, str] = {}
    transport: dict[str, str] = {}

    for key, val in env.items():
        if key.endswith("_MODEL_CONFIG__MODEL") or key.endswith("_MODEL_CONFIG__MODELS"):
            # e.g. DERIVER_MODEL_CONFIG__MODEL → deriver
            prefix = key.rsplit("_MODEL_CONFIG__MODEL", 1)[0].lower().rstrip("_")
            models[prefix] = val
        if key.endswith("_MODEL_CONFIG__TRANSPORT"):
            prefix = key.rsplit("_MODEL_CONFIG__TRANSPORT", 1)[0].lower().rstrip("_")
            transport[prefix] = val

    # Handle dialectic levels like DIALECTIC_LEVELS__low__MODEL_CONFIG__MODEL
    dialectic_levels: dict[str, dict[str, str]] = {}
    for key, val in env.items():
        if key.startswith("DIALECTIC_LEVELS__"):
            rest = key[len("DIALECTIC_LEVELS__"):]
            parts = rest.split("__", 1)
            if len(parts) == 2:
                level_name = parts[0]
                suffix = parts[1]
                if level_name not in dialectic_levels:
                    dialectic_levels[level_name] = {}
                dialectic_levels[level_name][suffix.split("__")[-1].lower()] = val

    return {
        "primary_model": models.get("deriver", "unknown"),
        "transport": transport.get("deriver", "unknown"),
        "embedding_model": models.get("embedding", "unknown"),
        "embedding_transport": transport.get("embedding", "unknown"),
        "summary_model": models.get("summary", "unknown"),
        "dream_model": models.get("dream_induction", "unknown"),
        "dialectic_levels": dialectic_levels,
        "all_models": models,
        "all_transports": transport,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/profile")
async def get_profile():
    """Return user and AI peer cards + representations."""
    client, cfg = _get_client()
    if not client or not cfg:
        return {"error": "Honcho not configured or unreachable"}

    user_peer = cfg.peer_name or "user"
    ai_peer = cfg.ai_peer or "hermes"

    return {
        "user": _get_peer_card(client, user_peer),
        "ai": _get_peer_card(client, ai_peer),
        "user_representation": _get_representation(client, user_peer),
        "ai_representation": _get_representation(client, ai_peer),
        "user_peer_name": user_peer,
        "ai_peer_name": ai_peer,
    }


@router.get("/search")
async def search_memory(q: str = "", limit: int = 20):
    """Semantic search over Honcho's stored context about the user.

    The Honcho SDK ``peer.search()`` accepts (query, limit) — NOT
    (q, max_tokens).  The ``q`` query-parameter is mapped into ``query``
    for the SDK call.
    """
    if not q.strip():
        return {"query": "", "results": [], "hint": "Provide a ?q= parameter to search"}

    client, cfg = _get_client()
    if not client:
        return {"error": "Honcho not configured or unreachable"}

    try:
        peer_name = cfg.peer_name or "user"
        results = client.peer(peer_name).search(q, limit=min(limit, 100))
        return {
            "query": q,
            "peer": peer_name,
            "results": (
                [{"content": r.content, "relevance": getattr(r, "relevance", None)}
                 for r in results]
                if results else []
            ),
        }
    except Exception as e:
        return {"query": q, "results": [], "error": str(e)}


@router.get("/sessions")
async def list_sessions(limit: int = 20):
    """List recent Honcho sessions.

    Honcho SDK ``Session`` objects expose ``id``, ``workspace_id``, and
    ``metadata`` — there is NO ``name`` or ``message_count`` attribute.
    ``sessions()`` returns a ``SyncPage`` (no ``limit`` parameter) — we
    slice to the requested limit ourselves.
    """
    client, cfg = _get_client()
    if not client:
        return {"error": "Honcho not configured or unreachable", "sessions": []}

    try:
        page = client.sessions()
        raw = list(page.items)[:min(limit, len(page.items))]
        return {
            "sessions": [
                {
                    "id": s.id,
                    "workspace_id": s.workspace_id,
                    "metadata": s.metadata if hasattr(s, "metadata") else {},
                }
                for s in raw
            ],
            "total": len(page.items),
        }
    except Exception as e:
        return {"sessions": [], "error": str(e)}


@router.get("/health")
async def memory_health():
    """Stats on Honcho's state: config, sessions, peer facts."""
    client, cfg = _get_client()
    if not client:
        return {
            "error": "Honcho not configured or unreachable",
            "honcho_available": False,
        }

    user_peer = cfg.peer_name or "user"
    ai_peer = cfg.ai_peer or "hermes"

    try:
        user_card = _get_peer_card(client, user_peer)
        ai_card = _get_peer_card(client, ai_peer)
        sessions_page = client.sessions()
        session_count = len(sessions_page)
        peers_page = client.peers()
        peer_count = len(peers_page)
    except Exception as e:
        return {"error": str(e), "honcho_available": True}

    return {
        "honcho_available": True,
        "workspace": cfg.workspace_id,
        "base_url": cfg.base_url or "(cloud)",
        "recall_mode": cfg.recall_mode,
        "observation_mode": cfg.observation_mode,
        "session_strategy": cfg.session_strategy,
        "dialectic_cadence": cfg.dialectic_cadence if cfg.dialectic_cadence is not None else 1,
        "dialectic_depth": cfg.dialectic_depth,
        "dialectic_reasoning_level": cfg.dialectic_reasoning_level,
        "write_frequency": cfg.write_frequency,
        "user_peer_facts": user_card.get("count", 0),
        "ai_peer_facts": ai_card.get("count", 0),
        "active_sessions": session_count,
        "total_peers": peer_count,
    }


@router.get("/model")
async def model_info():
    """Return Honcho's LLM model configuration (from Docker + SDK)."""
    # Get model info from Docker container
    docker_env = _fetch_docker_model_env()
    model_data = _build_model_info(docker_env) if docker_env else {}

    # Also get Honcho SDK configuration
    client, _ = _get_client()
    honcho_config: dict[str, Any] = {}
    if client:
        try:
            conf = client.get_configuration()
            reasoning = conf.reasoning
            if reasoning:
                honcho_config["reasoning"] = (
                    reasoning.model_dump() if hasattr(reasoning, "model_dump")
                    else str(reasoning)
                )
            peer_card = conf.peer_card
            if peer_card:
                honcho_config["peer_card"] = (
                    peer_card.model_dump() if hasattr(peer_card, "model_dump")
                    else str(peer_card)
                )
        except Exception as e:
            honcho_config["error"] = str(e)

    return {
        "container_name": "honcho-deriver-1",
        "docker_models": model_data,
        "honcho_sdk_config": honcho_config,
    }
