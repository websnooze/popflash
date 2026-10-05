# Fragstack

Plugin CS2 (Counter-Strike 2) adapté pour la plateforme Fragstack / services Fragstack — practice, pugs, scrims et matchs compétitifs.

Basé sur le travail open-source MatchZy (WD- / shobhit-pathak), renommé et intégré pour Fragstack.

## Points clés

* Mode pug / match avec loadmatch JSON Get5-like (`fragstack_loadmatch_url`)
* Extensions JSON `fragstack` + `settings` (knife, money, rounds, pauses, etc.)
* Events HTTP vers Fragstack (`/webhooks/fragstack`) avec retries
* Practice mode, knife, veto BO1/BO3/BO5, coaching, demos, stats DB

## Build

Prérequis : **.NET SDK 10** + CounterStrikeSharp.API `1.0.376`

```bash
cd plugin
dotnet build -c Release
cd tests/Fragstack.Tests
dotnet test -c Release
```

Artefact : `bin/Release/net10.0/Fragstack.dll`

## Déploiement DatHost / CSS

1. Copier `Fragstack.dll` (+ deps si besoin) dans `addons/counterstrikesharp/plugins/Fragstack/`
2. Copier `cfg/Fragstack/` → `csgo/cfg/Fragstack/`
3. Copier `gamedata/fragstack.json` → `addons/counterstrikesharp/gamedata/`
4. Copier `lang/` et `spawns/` avec le plugin

## Compatibilité Get5

Les commandes / alias `get5_*` restent disponibles pour les panels Get5. Les convars et commandes natives utilisent le préfixe `fragstack_*`.

## Doc d’intégration Fragstack

Voir `backend/docs/FRAGSTACK_COMPATIBILITY.md`.
