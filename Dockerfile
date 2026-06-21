# Eldenmoor multiplayer server — pure Python standard library, no dependencies.
FROM python:3.12-slim
WORKDIR /app
COPY . /app
# Cloud hosts inject $PORT; mpserver.py reads it. Defaults to 8000 locally.
EXPOSE 8000
CMD ["python", "mpserver.py"]
