from .app import create_app
from .institution import install_institution

app=create_app()
install_institution(app)
