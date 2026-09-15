from .app import create_app
from .institution import install_institution

app=create_app()
install_institution(app)

# Render serves the static UI from a catch-all '/' mount. Starlette evaluates
# routes in registration order, so institution routes installed after
# create_app() must be moved ahead of that catch-all mount.
routes=app.router.routes
for route in [r for r in routes if getattr(r,'name',None)=='website']:
    routes.remove(route)
    routes.append(route)

app.version='5.0.1'
