# Installation

Willkommen zur Quizzle Installation. Diese Anleitung führt Sie Schritt für Schritt durch die Installation der
Quiz-Plattform.

## Option 1: Installation mit Docker (Empfohlen)

Docker bietet den einfachsten Installationsweg. Falls Sie Docker noch nicht installiert haben, können Sie es
von [docker.com](https://docker.com) herunterladen.

### Docker Compose Setup

Erstellen Sie ein neues Verzeichnis und legen Sie darin eine `docker-compose.yml` Datei an:

```yaml
services:
  quizzle:
    image: germannewsmaker/quizzle:latest
    container_name: quizzle
    ports:
      - "6412:6412"
    volumes:
      - ./data:/quizzle/data
    environment:
      - TZ=Europe/Berlin
      # Optional: Passwort für Quiz-Upload
      # - PASSWORD_PROTECTION=ihr-sicheres-passwort
    restart: unless-stopped
```

Führen Sie anschließend folgenden Befehl aus:

```bash
docker-compose up -d
```

Quizzle ist nun unter `http://localhost:6412` erreichbar.

## Option 2: Manuelle Installation

Für erweiterte Konfigurationsmöglichkeiten können Sie Quizzle auch manuell installieren:

### 1. Repository herunterladen

```bash
git clone https://github.com/gnmyt/Quizzle.git
cd Quizzle
```

### 2. Abhängigkeiten installieren

```bash
npm install
cd webui
npm install
cd ..
```

### 3. Frontend erstellen

```bash
cd webui
npm run build
cd ..
```

### 4. Server starten

```bash
npm start
```

Der Server läuft standardmäßig auf Port 6412. Sie können den Port über die `PORT` Umgebungsvariable anpassen.

## Konfiguration

Folgende Umgebungsvariablen stehen zur Verfügung:

| Variable              | Beschreibung                        | Standardwert |
|-----------------------|-------------------------------------|--------------|
| `PORT`                | Port für den Webserver              | 6412         |
| `PASSWORD_PROTECTION` | Passwort für Quiz-Upload (optional) | -            |
| `TZ`                  | Zeitzone                            | UTC          |


## Freigabe

Wie Quizzle freigegeben wird hängt stark von Ihrer Netzwerkinfrastruktur ab.

Bedenken Sie, dass sich nicht jeder Schüler im Netzwerk der Schule befinden könnte. Zudem funktionieren Features wie der
Self-Practice-Modus nicht Zuhause, was es schwieriger macht.

## Lehrerpasswort

Es wird stark empfohlen, ein Lehrerpasswort zu setzen. Hiermit lassen sich Quizzes auf den Schulserver hochladen, um sie
einfacher zu starten.

Sie dienen ebenfalls dem Self-Practice-Modus, um Ergebnisse zu sehen.

Das Lehrerpasswort sollte regelmäßig rotiert werden.