# Compatibilité Fragstack ↔ Fragstack

Audit des **deux systèmes Fragstack** (lobbies pickup + tournois) face au plugin Fragstack (fork local dans `plugin/`).

## Verdict

**Pont Fragstack ↔ Fragstack en place** (backend + plugin patché). Le provisioning reste DatHost ; le contrôle match (rosters, knife, cvars Advanced Settings, events score) passe par Fragstack.

| Couche | Lobby pickup / Tournois | Fragstack (fork `plugin/`) |
|---|---|---|
| Provisioning | DatHost duplicate + `createMatch` | Serveur up → console `fragstack_loadmatch_url` |
| Config match | `GET /matches/:id/fragstack.json` | Charge JSON Get5 + bloc `fragstack` / `settings` |
| Roster / sides | Steam64 dans le JSON | Lock teams Fragstack |
| Knife / Advanced Settings | Mappés → `side_type` + `cvars` | Appliqués au load |
| Fin de match | Webhooks DatHost **et** `POST /webhooks/fragstack` | Events Get5 + enveloppes Fragstack (`match_ended`, scores) |
| Plugin | Template DatHost avec Fragstack CSS installé | Build `net10.0` + CounterStrikeSharp `1.0.376` |

### Flux runtime

1. `launchFromLobby` → duplicate serveur + `POST /cs2-matches` (webhooks DatHost inchangés).
2. Sur `server_ready_for_players` → console DatHost :  
   `fragstack_loadmatch_url "<PUBLIC_URL>/matches/<uuid>/fragstack.json" "Authorization" "<DATHOST_WEBHOOK_SECRET>"`
3. Fragstack fetch le JSON (auth header), applique Fragstack extensions, poste les events vers `/webhooks/fragstack`.

### Build plugin

```bash
# Prérequis : .NET SDK 10 + package CounterStrikeSharp.API 1.0.376
cd plugin && dotnet build -c Release
cd tests/Fragstack.Tests && dotnet test -c Release
```

Artefact : `plugin/bin/Release/net10.0/Fragstack.dll` (+ `lang/`, `spawns/`).

---

## Endpoints Fragstack

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| GET | `/matches/:matchId/fragstack.json` | `Authorization: <DATHOST_WEBHOOK_SECRET>` | JSON Get5/Fragstack + `settings` + `fragstack` |
| POST | `/webhooks/fragstack` | idem | Events compat (`match_started`, `match_ended`, `series_end`, `round_end`, `match_canceled`) |
| POST | `/webhooks/dathost` | idem | Boot / connect / teardown DatHost (inchangé) |

Fichiers : `fragstack-bridge.service.ts`, `match.service.ts` (`loadFragstackConfig`), `dathost/client.ts` (`sendConsole`).

---

## Ce que DatHost reçoit encore au launch

Fichier : `backend/src/services/match.service.ts` → `createMatch`.

```ts
settings: {
  map,
  password,
  connect_time,
  match_begin_countdown,
  team_size,
  wait_for_gotv,
  enable_plugin,
  enable_tech_pause,
}
webhooks: {
  event_url: `${PUBLIC_URL}/webhooks/dathost`,
  enabled_events: ['*'],
  authorization_header: DATHOST_WEBHOOK_SECRET,
}
```

Les Advanced Settings complets sont dans le JSON Fragstack (`cvars` + `settings`), pas dans ce payload DatHost.

---

## Écarts restants

1. **Séries BO3/BO5 natives** : Fragstack joue encore 1 map DatHost = +1 score série fixture ; `num_maps` Fragstack reste à 1.
2. **Conflit possible** DatHost Match API (`enable_plugin`) vs Fragstack loadmatch — à valider sur template réel.
3. **Coaches** tournoi : pas encore dans le JSON Fragstack.
4. **Teardown** après event Fragstack seul : le delete serveur reste surtout déclenché par webhooks DatHost (`match_ended` / `gotv_stopped`).

---

## Prompt — adapter Fragstack pour Fragstack

> Copier le bloc ci-dessous dans une session agent / issue pour forker ou patcher Fragstack afin qu’il soit pilotable par Fragstack (lobbies + tournois) sur DatHost.

````markdown
# Prompt : rendre Fragstack compatible avec Fragstack (CS2)

## Contexte

Fragstack est une plateforme CS2 (Bun/Hono + Postgres) avec deux flux :

1. **Lobby pickup** : joueurs dans un lobby → `launchFromLobby` → DatHost duplicate server → `POST /cs2-matches` → webhooks DatHost sur `/webhooks/dathost`.
2. **Tournois** : fixtures → `createLobbyForTournamentMatch` (lobby privé pré-rempli) → même lancement DatHost → à la fin, `tournament.service.onMatchFinished` met à jour le score de série.

Repo plugin à adapter : https://github.com/shobhit-pathak/Fragstack  
Docs Fragstack : match setup JSON Get5-like, events HTTP, Get5/G5API.

Aujourd’hui Fragstack **ne** charge **pas** de match via `fragstack_loadmatch_url` et **ne** consomme **pas** les events Fragstack. Il compte sur l’API Match DatHost (`enable_plugin`, lock teams, webhooks DatHost).

Objectif : faire en sorte que **Fragstack**, installé sur le template DatHost Fragstack, exécute correctement les matchs Fragstack (pickup + tournoi) avec les réglages Advanced Settings, knife, series BO si possible, et un reporting score fiable.

## Contraintes Fragstack (ne pas casser)

Backend actuel envoie à DatHost :

- `players[]` : `{ steam_id_64, team: team1|team2|spectator, nickname_override }`
- `team1.name` / `team2.name`
- `settings` : `map`, `password`, `connect_time`, `match_begin_countdown`, `team_size`, `wait_for_gotv`, `enable_plugin`, `enable_tech_pause`
- `webhooks.event_url` + `authorization_header` + `enabled_events: ["*"]`

Events **attendus côté Fragstack** (noms DatHost) :

- `server_ready_for_players` → connect IP/port
- `match_started` → status live
- `match_ended` / `gotv_stopped` → finished + scores `team1.stats.score` / `team2.stats.score`
- `match_canceled`
- stats joueurs (kills, deaths, etc.) sur le payload match

IDs utiles stockés côté Fragstack :

- `matches.id` (UUID) aussi passé en `user_data` du game server DatHost
- `matches.dathostMatchId`
- `matches.tournamentMatchId` (nullable) pour avancer le bracket

Réglages Advanced Settings Fragstack à honorer (aujourd’hui souvent ignorés par DatHost) :

```
knifeRound, maxRounds (16|24|30|60), overtime,
startMoney, maxMoney, overtimeMoney,
armor (default|kevlar|kevlar_helmet), headshotOnly,
pauseCount, pauseDuration, freezeTime,
voiceChat (allies_only|all_players),
enableTechPause, waitForGotv, connectTime, matchBeginCountdown
```

Tournoi V1 : `bestOf` 1|3|5 au niveau **fixture** ; chaque map DatHost = +1 au score de série. Idéalement Fragstack peut soit (A) jouer une map et reporter le score map, soit (B) gérer toute la série et reporter map + series.

## Travail demandé sur Fragstack

### 1. Mode « Fragstack / DatHost Match API » (priorité haute)

Ajouter un mode d’intégration où Fragstack :

1. Détecte qu’un match DatHost est actif **ou** reçoit une config Fragstack (via convar / fichier / HTTP).
2. Whitelist / lock les joueurs selon les Steam64 des deux teams (et spectators).
3. Applique knife selon `knifeRound` / `side_type`.
4. Applique les cvars dérivés des Advanced Settings Fragstack (money, maxrounds, OT, freezetime, pauses, armor/HS-only si supportés).
5. Remonte le score map de façon fiable pour que DatHost (ou Fragstack directement) voie `team1`/`team2` scores.

Si DatHost ne propage pas assez d’infos au plugin (pas de JSON Fragstack), implémenter **au moins une** des options :

- **Option A (préférée)** : Fragstack expose `fragstack_fragstack_config_url` ; Fragstack servira plus tard `GET /matches/:id/fragstack.json`. En attendant, documenter le schéma exact attendu.
- **Option B** : Fragstack lit un fichier / userdata / RCON bootstrap injecté au start.
- **Option C** : Bridge DatHost → Fragstack : quand `enable_plugin` lance le match DatHost, Fragstack consomme la même assignation teams/password/map.

### 2. Schéma JSON Fragstack → Fragstack (à supporter)

Accepter (en plus du JSON Get5 classique) un document du type :

```json
{
  "matchid": "<fragstack-match-uuid>",
  "fragstack": {
    "lobby_id": "<uuid>",
    "tournament_match_id": "<uuid|null>",
    "dathost_match_id": "<id>"
  },
  "num_maps": 1,
  "players_per_team": 5,
  "skip_veto": true,
  "side_type": "always_knife",
  "maplist": ["de_mirage"],
  "team1": {
    "name": "Team A",
    "players": { "7656…": "Nick1" }
  },
  "team2": {
    "name": "Team B",
    "players": { "7656…": "Nick2" }
  },
  "spectators": { "players": {} },
  "cvars": {
    "mp_maxrounds": "24",
    "mp_overtime_enable": "1",
    "mp_startmoney": "800",
    "mp_maxmoney": "16000",
    "mp_overtime_startmoney": "10000",
    "mp_freezetime": "15",
    "sv_talk_enemy_living": "0"
  }
}
```

Mapper explicitement :

| Fragstack setting | Fragstack / cvar |
|---|---|
| knifeRound true | `side_type: always_knife` (ou knife map_sides) |
| knifeRound false | `side_type: never_knife` |
| maxRounds | `mp_maxrounds` |
| overtime | `mp_overtime_enable` |
| startMoney / maxMoney / overtimeMoney | cvars money |
| freezeTime | `mp_freezetime` |
| pauseCount / pauseDuration | convars / settings Fragstack pause tech |
| enableTechPause | autoriser `!tech` |
| voiceChat allies_only | bloquer voice ennemis |
| teamSize | `players_per_team` |
| bestOf / num_maps | `num_maps` + `maplist` (longueur) |

### 3. Events vers Fragstack (priorité haute)

Deux chemins acceptables (implémenter le plus robuste) :

**Chemin 1 — rester compatible DatHost webhooks**  
S’assurer que fin de map / scores / cancel mettent à jour l’état que DatHost relaie déjà (`match_ended`, scores teams). Documenter toute dépendance serveur DatHost.

**Chemin 2 — webhook Fragstack natif vers Fragstack**  
Poster vers une URL configurable (`fragstack_remote_log_url`) des events **aussi** mappés vers une enveloppe Fragstack/DatHost-friendly, par ex. :

```json
{
  "event": "match_ended",
  "matchid": "<fragstack-match-uuid>",
  "team1_score": 13,
  "team2_score": 7,
  "map": "de_mirage",
  "series_team1_score": 1,
  "series_team2_score": 0
}
```

Events minimum à émettre (noms stables, documentés OpenAPI) :

- `server_ready_for_players` (ou équivalent going live warmup)
- `match_started` / `GoingLive`
- `round_end` (scores)
- `match_ended` / `MapResult` (scores map finaux)
- `series_end` (si BO > 1)
- `match_canceled`

Auth : header configurable (Fragstack utilisera le même secret que `DATHOST_WEBHOOK_SECRET` ou un `FRAGSTACK_WEBHOOK_SECRET`).

### 4. Tournois / séries

- Si `num_maps == 1` : une map, report score map (Fragstack incrémente la série côté backend).
- Si `num_maps > 1` : gérer la série Fragstack (veto optionnel `skip_veto`) et reporter **map + series scores** ; inclure `tournament_match_id` dans chaque event.

Coaches : Fragstack a des rôles `coach` sur `team_members` — si possible, supporter coaches dans le JSON (limitation Fragstack actuelle : coach via `.coach` in-game). Documenter le workaround.

### 5. Sécurité / robustesse

- Ignorer les cvars dangereux (déjà le cas Fragstack) ; permettre la liste Fragstack ci-dessus.
- Ne pas kick les joueurs avant `server_ready` si Fragstack affiche le connect string à ce moment.
- Retry HTTP events (au moins N retries) — le Fragstack upstream n’a pas de retry ; Fragstack a besoin de fiabilité pour advance bracket.

### 6. Livrables

1. Patch / fork Fragstack avec changelog.
2. Doc d’install sur **template DatHost** Fragstack (plugins CSS + Fragstack, convars bootstrap).
3. Exemple de JSON `fragstack.json` pour un lobby 5v5 BO1 knife on.
4. Exemple d’events HTTP pour un BO3 tournoi (3 maps).
5. Matrice de tests :
   - Lobby 1v1 / 5v5, knife on/off
   - Tech pause
   - Fin de map → scores corrects
   - Cancel mid-match
   - Tournoi fixture BO3 (1 map à la fois **et** série native si implémentée)
6. Liste des changements **côté Fragstack** encore nécessaires (endpoint JSON, RCON loadmatch, parser events Fragstack) — ne pas les implémenter ici sauf s’ils sont triviaux côté plugin.

## Hors scope

- Réécrire le frontend Fragstack
- Upload demos R2
- Remplacer entièrement DatHost
- Prize pool / paiement

## Definition of done

Un serveur DatHost avec ce Fragstack patché, lancé comme le fait Fragstack aujourd’hui (ou via loadmatch_url documenté), permet :

1. Lock des rosters Steam64 Fragstack
2. Application knife + cvars Advanced Settings
3. Score map visible / reporté jusqu’à Fragstack (via DatHost webhook ou webhook Fragstack documenté)
4. Cancel propre
5. Doc claire pour brancher ensuite le backend Fragstack (`/matches/:id/fragstack.json` + ingest events)
````

---

## Suite / checklist template DatHost

1. Installer le DLL Fragstack Fragstack (`plugin/bin/Release/net10.0/`) + CounterStrikeSharp sur le template.
2. Vérifier qu’un launch lobby déclenche `fragstack_loadmatch_url` (console DatHost) puis un event `match_started` sur `/webhooks/fragstack`.
3. Option tournoi : soit rester « 1 DatHost match = 1 map », soit déléguer la série à Fragstack (`num_maps = bestOf`).

## Références

- Fragstack upstream : https://github.com/shobhit-pathak/Fragstack  
- Match setup : https://shobhit-pathak.github.io/Fragstack/match_setup/  
- Events : https://shobhit-pathak.github.io/Fragstack/events_and_forwards/  
- DatHost console : `POST /api/0.1/game-servers/{id}/console`  
- Code Fragstack : `fragstack-bridge.service.ts`, `match.service.ts`, `routes/webhooks.ts`, `routes/matches.ts`
