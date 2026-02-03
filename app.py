"""StudyScribe app entrypoint."""

from studyscribe.app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=app.config.get("DEV_MODE", False))
