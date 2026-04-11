import os
from pathlib import Path
from tempfile import mkdtemp

import jupyterlab

# No authentication — tests need passwordless access
c.IdentityProvider.token = ""
c.ServerApp.password = ""

# Don't open a browser tab when the server starts
c.ServerApp.open_browser = False

# Bind on all interfaces so Toxiproxy can forward to it
c.ServerApp.ip = "127.0.0.1"
c.ServerApp.port = 8888

# Use the notebooks directory as the root
c.ServerApp.root_dir = os.path.join(os.path.dirname(__file__), "notebooks")

# Allow all origins — Playwright pages connect from a different port
c.ServerApp.allow_origin = "*"
c.ServerApp.allow_credentials = True

# Disable XSRF checks so Playwright can make API calls without a browser cookie
c.ServerApp.disable_check_xsrf = True

# Collaboration settings
c.YDocExtension.disable_rtc = False

# Required by Galata: exposes window.jupyterapp in the browser so Galata's
# waitForAppStarted() can detect when JupyterLab has finished loading.
c.LabApp.expose_app_in_browser = True

# Load Galata's in-page test helpers as a lab extension (needed for hookHelpersUp).
c.LabServerApp.extra_labextensions_path = str(Path(jupyterlab.__file__).parent / "galata")
