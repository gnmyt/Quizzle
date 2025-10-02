<div align="center">
  <img src="docs/docs/public/quizzle-title.png" alt="Quizzle Logo" width="400"/>
  
  **Die kostenlose, open-source Quiz-Plattform für Schulen**
  
  *Self-hosted • Datenschutz-konform • Keine monatlichen Kosten*
  
  [![GitHub stars](https://img.shields.io/github/stars/gnmyt/Quizzle?style=for-the-badge)](https://github.com/gnmyt/Quizzle/stargazers)
  [![GitHub license](https://img.shields.io/github/license/gnmyt/Quizzle?style=for-the-badge)](https://github.com/gnmyt/Quizzle/blob/main/LICENSE)
  [![Docker Pulls](https://img.shields.io/docker/pulls/germannewsmaker/quizzle?style=for-the-badge)](https://hub.docker.com/r/germannewsmaker/quizzle)
  
</div>

---

## 🚀 Was ist Quizzle?

Quizzle ist nur selbst hostbar, kostenlos und ohne Datenschutz-Sorgen! 

- **🎮 Live-Quizze** - Schüler joinen per QR-Code, keine Accounts nötig
- **📚 Übungsquizze** - Für selbständige Vorbereitung auf Klausuren  
- **🏠 Self-hosted** - Läuft auf deinem Server, deine Daten bleiben bei dir
- **💰 Kostenlos** - Open Source, keine Limitierungen, keine Abo-Fallen
- **📱 Mobile-friendly** - Funktioniert perfekt auf allen Geräten

## ⚡ Schnellstart mit Docker

```bash
# docker-compose.yml erstellen
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

# Starten
docker-compose up -d
```

## 🛠️ Entwicklung

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

## 🤝 Beitragen

Contributions sind willkommen! 

- 🐛 **Bug Reports** - [Issues erstellen](https://github.com/gnmyt/Quizzle/issues)
- 💡 **Feature Requests** - Ideen einreichen
- 🔀 **Pull Requests** - Code beitragen

## 📄 Lizenz

Dieses Projekt steht unter der [MIT Lizenz](LICENSE).

