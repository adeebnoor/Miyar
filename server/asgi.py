from .app import create_app
from .institution import install_institution

app=create_app()
install_institution(app)
app.version='5.0.0'
