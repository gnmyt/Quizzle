<div align="center">
  <img src="landing/public/quizzle-title.png" alt="Quizzle Logo" width="400"/>
  
  **Eine kostenlose Open-Source-Quizplattform für Schulen**
  
  *Self-hosted • Datenschutz-konform • Keine monatlichen Kosten*
  
  [![GitHub stars](https://img.shields.io/github/stars/gnmyt/Quizzle?style=for-the-badge)](https://github.com/gnmyt/Quizzle/stargazers)
  [![GitHub license](https://img.shields.io/github/license/gnmyt/Quizzle?style=for-the-badge)](https://github.com/gnmyt/Quizzle/blob/main/LICENSE)
  [![Docker Pulls](https://img.shields.io/docker/pulls/germannewsmaker/quizzle?style=for-the-badge)](https://hub.docker.com/r/germannewsmaker/quizzle)
  
</div>

---

## Was ist Quizzle?

Quizzle ist eine self-hosted Quizplattform für Unterricht und Lernen.
Ihr könnt Live-Quizze im Klassenraum durchführen oder Übungsquizze zur Vorbereitung bereitstellen.

- **Live-Quizze** - Schüler treten per QR-Code bei, ohne Konto
- **Übungsquizze** - Für die selbstständige Vorbereitung
- **Self-hosted** - Läuft auf eurem Server, die Daten bleiben bei euch
- **Kostenlos** - Open Source ohne Abo-Modell
- **Wortwolken** - Begriffe live sammeln, häufige Antworten größer anzeigen und ähnliche Schreibweisen gruppieren, ohne Punkte
- **Mobil nutzbar** - Funktioniert auf Smartphone, Tablet und Desktop

## Schnellstart mit Docker

```bash
# docker-compose.yml anlegen
version: '3.8'
services:
  quizzle:
    image: germannewsmaker/quizzle:latest
    ports:
      - "6412:6412"
    volumes:
      - ./data:/quizzle/data
    environment:
      - TZ=Europe/Berlin
    restart: unless-stopped

# starten
docker-compose up -d
```

## Entwicklung

```bash
# Repository klonen
git clone https://github.com/gnmyt/Quizzle.git
cd Quizzle

# Backend starten
yarn install
yarn run dev

# Frontend (neues Terminal)
cd webui
yarn install  
yarn run dev
```

## Beitragen

Contributions sind willkommen!

- **Fehler melden** - [Issue erstellen](https://github.com/gnmyt/Quizzle/issues)
- **Features vorschlagen** - Ideen einreichen
- **Code beitragen** - Pull Request öffnen

## Lizenz

Dieses Projekt steht unter der [MIT Lizenz](LICENSE).

