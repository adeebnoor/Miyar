from .app import create_app

# create_app installs all API modules before any optional static UI catch-all.
app=create_app()
