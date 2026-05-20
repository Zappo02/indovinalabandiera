# Bandiera Daily

Quiz giornaliero: indovina la bandiera del paese del giorno. 6 tentativi, bandiera nuova ogni giorno.

## Stack

- React 18 + Vite
- [flag-icons](https://github.com/lipis/flag-icons) per le bandiere SVG
- localStorage per salvare progresso e storico

## Sviluppo locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy su Vercel

1. Pusha la repo su GitHub
2. Importa il progetto su [vercel.com](https://vercel.com)
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

Il file `vercel.json` gestisce già il routing SPA.
