"""StudyScribe app entrypoint."""

from studyscribe.app import app


if __name__ == "__main__":
    app.run(debug=True)
