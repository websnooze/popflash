# Compatibilité MatchZy ↔ PopFlash

Audit des **deux systèmes PopFlash** (lobbies pickup + tournois) face au plugin [MatchZy](https://github.com/shobhit-pathak/MatchZy).

## Verdict

**Pas pleinement compatible aujourd’hui.**

PopFlash orchestre les matchs via l’**API DatHost CS2 Matches** (`POST /cs2-matches` + webhooks DatHost). MatchZy, lui, attend un **JSON Get5-like** (`matchzy_loadmatch` / `matchzy_loadmatch_url`) et envoie des **events Get5/MatchZy** vers `matchzy_remote_log_url`.

| Couche | Lobby pickup | Tournois | MatchZy natif |
|---|---|---|---|
| Provisioning serveur | DatHost duplicate + createMatch | Idem (via lobby de fixture) | Serveur déjà up + loadmatch |
| Roster / sides | Joueurs DatHost `team1`/`team2`/`spectator` | Rosters équipes → lobby | JSON `team1.players` / `team2.players` Steam64 |
| Knife / règles map | UI `knifeRound`, money, maxRounds… **non envoyés** à DatHost | Copiés dans `tournament.settings` puis lobby, **même gap** | `side_type`, `map_sides`, `cvars` |
| Série BO3/BO5 | Lobby `bestOf` non poussé en série plugin | Fixture `bestOf` = score série **manuel/orga** + 1 map DatHost | `num_maps` + `maplist` + veto |
| Fin de match | Webhook DatHost `match_ended` / `gotv_stopped` | → `tournament.service.onMatchFinished` | Events Get5 `map_result` / `series_end` |
| Plugin on server | `settings.enable_plugin` (plugin CSS DatHost, lock teams) | Idem | MatchZy installé (1-click DatHost possible) |

Conclusion : avec `enable_plugin: true` sur un template DatHost qui a **MatchZy installé**, on obtient au mieux un lock d’équipes / match DatHost — **pas** le contrôle MatchZy (loadmatch, knife PopFlash, cvars Advanced Settings, series, events Get5). Les réglages Advanced Settings hors champs DatHost (`knifeRound`, `maxRounds`, `overtime`, money, armor, pauses, freezeTime, voiceChat) **ne sont pas appliqués** côté serveur aujourd’hui.

---

## Ce que PopFlash envoie réellement (aujourd’hui)

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

Events consommés : `booting_server`, `loading_map`, `server_ready_for_players`, `all_players_connected`, `match_started`, `match_ended`, `gotv_stopped`, `match_canceled` (+ stats joueurs DatHost).

## Ce que MatchZy attend

Voir [Match Setup](https://shobhit-pathak.github.io/MatchZy/match_setup/) et [Events](https://shobhit-pathak.github.io/MatchZy/events_and_forwards/).

- Load : `matchzy_loadmatch_url "https://…/match.json" "Authorization" "Bearer …"`
- JSON requis : `maplist`, `team1`, `team2`, `num_maps`
- Optionnel : `matchid`, `spectators`, `skip_veto`, `side_type` (`always_knife`…), `map_sides`, `players_per_team`, `clinch_series`, `cvars`
- Events HTTP : payload Get5-like vers `matchzy_remote_log_url` (+ header custom)

---

## Écarts bloquants

1. **Pas d’endpoint PopFlash** qui sert un JSON MatchZy / Get5 pour `loadmatch_url`.
2. **Pas de RCON** PopFlash pour `matchzy_loadmatch_url` après boot (le flux passe uniquement par DatHost Match API).
3. **Schéma webhook différent** : backend PopFlash parse l’enveloppe DatHost (`events[].event`, `team1.stats.score`), pas les events MatchZy (`GoingLive`, `MapResult`, `SeriesEnd`, etc.).
4. **Advanced Settings incomplets** : knife / money / rounds / OT / pauses ne sont pas mappés vers DatHost ni vers des `cvars` MatchZy.
5. **Séries tournoi** : PopFlash joue 1 map DatHost et gère le BO côté fixture ; MatchZy peut gérer toute la série (`num_maps`).
6. **Veto** : PopFlash fait le veto **dans le lobby** (hors serveur) puis lance une map déjà choisie ; MatchZy peut aussi veto in-game si `skip_veto: false`.

---

## Prompt — adapter MatchZy pour PopFlash

> Copier le bloc ci-dessous dans une session agent / issue pour forker ou patcher MatchZy afin qu’il soit pilotable par PopFlash (lobbies + tournois) sur DatHost.

````markdown
# Prompt : rendre MatchZy compatible avec PopFlash (CS2)

## Contexte

PopFlash est une plateforme CS2 (Bun/Hono + Postgres) avec deux flux :

1. **Lobby pickup** : joueurs dans un lobby → `launchFromLobby` → DatHost duplicate server → `POST /cs2-matches` → webhooks DatHost sur `/webhooks/dathost`.
2. **Tournois** : fixtures → `createLobbyForTournamentMatch` (lobby privé pré-rempli) → même lancement DatHost → à la fin, `tournament.service.onMatchFinished` met à jour le score de série.

Repo plugin à adapter : https://github.com/shobhit-pathak/MatchZy  
Docs MatchZy : match setup JSON Get5-like, events HTTP, Get5/G5API.

Aujourd’hui PopFlash **ne** charge **pas** de match via `matchzy_loadmatch_url` et **ne** consomme **pas** les events MatchZy. Il compte sur l’API Match DatHost (`enable_plugin`, lock teams, webhooks DatHost).

Objectif : faire en sorte que **MatchZy**, installé sur le template DatHost PopFlash, exécute correctement les matchs PopFlash (pickup + tournoi) avec les réglages Advanced Settings, knife, series BO si possible, et un reporting score fiable.

## Contraintes PopFlash (ne pas casser)

Backend actuel envoie à DatHost :

- `players[]` : `{ steam_id_64, team: team1|team2|spectator, nickname_override }`
- `team1.name` / `team2.name`
- `settings` : `map`, `password`, `connect_time`, `match_begin_countdown`, `team_size`, `wait_for_gotv`, `enable_plugin`, `enable_tech_pause`
- `webhooks.event_url` + `authorization_header` + `enabled_events: ["*"]`

Events **attendus côté PopFlash** (noms DatHost) :

- `server_ready_for_players` → connect IP/port
- `match_started` → status live
- `match_ended` / `gotv_stopped` → finished + scores `team1.stats.score` / `team2.stats.score`
- `match_canceled`
- stats joueurs (kills, deaths, etc.) sur le payload match

IDs utiles stockés côté PopFlash :

- `matches.id` (UUID) aussi passé en `user_data` du game server DatHost
- `matches.dathostMatchId`
- `matches.tournamentMatchId` (nullable) pour avancer le bracket

Réglages Advanced Settings PopFlash à honorer (aujourd’hui souvent ignorés par DatHost) :

```
knifeRound, maxRounds (16|24|30|60), overtime,
startMoney, maxMoney, overtimeMoney,
armor (default|kevlar|kevlar_helmet), headshotOnly,
pauseCount, pauseDuration, freezeTime,
voiceChat (allies_only|all_players),
enableTechPause, waitForGotv, connectTime, matchBeginCountdown
```

Tournoi V1 : `bestOf` 1|3|5 au niveau **fixture** ; chaque map DatHost = +1 au score de série. Idéalement MatchZy peut soit (A) jouer une map et reporter le score map, soit (B) gérer toute la série et reporter map + series.

## Travail demandé sur MatchZy

### 1. Mode « PopFlash / DatHost Match API » (priorité haute)

Ajouter un mode d’intégration où MatchZy :

1. Détecte qu’un match DatHost est actif **ou** reçoit une config PopFlash (via convar / fichier / HTTP).
2. Whitelist / lock les joueurs selon les Steam64 des deux teams (et spectators).
3. Applique knife selon `knifeRound` / `side_type`.
4. Applique les cvars dérivés des Advanced Settings PopFlash (money, maxrounds, OT, freezetime, pauses, armor/HS-only si supportés).
5. Remonte le score map de façon fiable pour que DatHost (ou PopFlash directement) voie `team1`/`team2` scores.

Si DatHost ne propage pas assez d’infos au plugin (pas de JSON MatchZy), implémenter **au moins une** des options :

- **Option A (préférée)** : MatchZy expose `matchzy_popflash_config_url` ; PopFlash servira plus tard `GET /matches/:id/matchzy.json`. En attendant, documenter le schéma exact attendu.
- **Option B** : MatchZy lit un fichier / userdata / RCON bootstrap injecté au start.
- **Option C** : Bridge DatHost → MatchZy : quand `enable_plugin` lance le match DatHost, MatchZy consomme la même assignation teams/password/map.

### 2. Schéma JSON PopFlash → MatchZy (à supporter)

Accepter (en plus du JSON Get5 classique) un document du type :

```json
{
  "matchid": "<popflash-match-uuid>",
  "popflash": {
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

| PopFlash setting | MatchZy / cvar |
|---|---|
| knifeRound true | `side_type: always_knife` (ou knife map_sides) |
| knifeRound false | `side_type: never_knife` |
| maxRounds | `mp_maxrounds` |
| overtime | `mp_overtime_enable` |
| startMoney / maxMoney / overtimeMoney | cvars money |
| freezeTime | `mp_freezetime` |
| pauseCount / pauseDuration | convars / settings MatchZy pause tech |
| enableTechPause | autoriser `!tech` |
| voiceChat allies_only | bloquer voice ennemis |
| teamSize | `players_per_team` |
| bestOf / num_maps | `num_maps` + `maplist` (longueur) |

### 3. Events vers PopFlash (priorité haute)

Deux chemins acceptables (implémenter le plus robuste) :

**Chemin 1 — rester compatible DatHost webhooks**  
S’assurer que fin de map / scores / cancel mettent à jour l’état que DatHost relaie déjà (`match_ended`, scores teams). Documenter toute dépendance serveur DatHost.

**Chemin 2 — webhook MatchZy natif vers PopFlash**  
Poster vers une URL configurable (`matchzy_remote_log_url`) des events **aussi** mappés vers une enveloppe PopFlash/DatHost-friendly, par ex. :

```json
{
  "event": "match_ended",
  "matchid": "<popflash-match-uuid>",
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

Auth : header configurable (PopFlash utilisera le même secret que `DATHOST_WEBHOOK_SECRET` ou un `MATCHZY_WEBHOOK_SECRET`).

### 4. Tournois / séries

- Si `num_maps == 1` : une map, report score map (PopFlash incrémente la série côté backend).
- Si `num_maps > 1` : gérer la série MatchZy (veto optionnel `skip_veto`) et reporter **map + series scores** ; inclure `tournament_match_id` dans chaque event.

Coaches : PopFlash a des rôles `coach` sur `team_members` — si possible, supporter coaches dans le JSON (limitation MatchZy actuelle : coach via `.coach` in-game). Documenter le workaround.

### 5. Sécurité / robustesse

- Ignorer les cvars dangereux (déjà le cas MatchZy) ; permettre la liste PopFlash ci-dessus.
- Ne pas kick les joueurs avant `server_ready` si PopFlash affiche le connect string à ce moment.
- Retry HTTP events (au moins N retries) — le MatchZy upstream n’a pas de retry ; PopFlash a besoin de fiabilité pour advance bracket.

### 6. Livrables

1. Patch / fork MatchZy avec changelog.
2. Doc d’install sur **template DatHost** PopFlash (plugins CSS + MatchZy, convars bootstrap).
3. Exemple de JSON `matchzy.json` pour un lobby 5v5 BO1 knife on.
4. Exemple d’events HTTP pour un BO3 tournoi (3 maps).
5. Matrice de tests :
   - Lobby 1v1 / 5v5, knife on/off
   - Tech pause
   - Fin de map → scores corrects
   - Cancel mid-match
   - Tournoi fixture BO3 (1 map à la fois **et** série native si implémentée)
6. Liste des changements **côté PopFlash** encore nécessaires (endpoint JSON, RCON loadmatch, parser events MatchZy) — ne pas les implémenter ici sauf s’ils sont triviaux côté plugin.

## Hors scope

- Réécrire le frontend PopFlash
- Upload demos R2
- Remplacer entièrement DatHost
- Prize pool / paiement

## Definition of done

Un serveur DatHost avec ce MatchZy patché, lancé comme le fait PopFlash aujourd’hui (ou via loadmatch_url documenté), permet :

1. Lock des rosters Steam64 PopFlash
2. Application knife + cvars Advanced Settings
3. Score map visible / reporté jusqu’à PopFlash (via DatHost webhook ou webhook MatchZy documenté)
4. Cancel propre
5. Doc claire pour brancher ensuite le backend PopFlash (`/matches/:id/matchzy.json` + ingest events)
````

---

## Suite recommandée côté PopFlash (hors ce prompt)

Une fois MatchZy adapté (ou en parallèle) :

1. Exposer `GET /matches/:id/matchzy.json` (Get5/MatchZy schema) à partir de lobby + settings.
2. Après boot serveur : RCON `matchzy_loadmatch_url` + config remote log vers PopFlash.
3. Ajouter `POST /webhooks/matchzy` (ou élargir `/webhooks/dathost`) pour parser events MatchZy et unifier `onMatchFinished`.
4. Mapper **tous** les Advanced Settings → `cvars` du JSON (aujourd’hui perdus).
5. Option tournoi : soit rester « 1 DatHost match = 1 map », soit déléguer la série à MatchZy (`num_maps = bestOf`).

## Références

- MatchZy : https://github.com/shobhit-pathak/MatchZy  
- Match setup : https://shobhit-pathak.github.io/MatchZy/match_setup/  
- Events : https://shobhit-pathak.github.io/MatchZy/events_and_forwards/  
- DatHost CS2 Match webhooks : https://dathost.com/docs/cs2-match-api-webhooks  
- Code PopFlash : `backend/src/services/match.service.ts`, `backend/src/services/tournament.service.ts`, `backend/src/routes/webhooks.ts`
