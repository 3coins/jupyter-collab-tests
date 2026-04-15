"""Server configuration for chat integration tests.

Launches JupyterLab with Galata helpers, no auth, and low yroom drain
timeouts so browser tests can verify chat session behavior quickly.

!! Never use this configuration in production !!
"""
import os
from pathlib import Path

import jupyterlab
from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)  # noqa: F821 — `c` is injected by traitlets

# File management
c.FileContentsManager.delete_to_trash = False

# YRoom drain settings (low values for testing)
c.YRoom.inactivity_timeout = 10       # seconds before room is considered inactive
c.YRoomManager.auto_free_interval = 60  # seconds between drain checks

c.MCPExtensionApp.mcp_port = 18741
c.MCPExtensionApp.mcp_name = "Jupyter MCP Server"

# Galata in-page helpers
c.LabServerApp.extra_labextensions_path = str(
    Path(jupyterlab.__file__).parent / "galata"
)
