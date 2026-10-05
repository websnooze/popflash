using System.Text.Json.Serialization;

namespace Fragstack;
public class FragstackEvent
{
    public FragstackEvent(string eventName)
    {
        EventName = eventName;
    }

    [JsonPropertyName("event")]
    public string EventName { get; }
}

public class FragstackMatchEvent : FragstackEvent
{
    [JsonPropertyName("matchid")]
    public required long MatchId { get; init; }

    protected FragstackMatchEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackMatchTeamEvent : FragstackMatchEvent
{
    [JsonPropertyName("team")]
    public required string Team { get; init; }

    protected FragstackMatchTeamEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackMapEvent : FragstackMatchEvent
{
    [JsonPropertyName("map_number")]
    public required int MapNumber { get; init; }

    protected FragstackMapEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackMapTeamEvent : FragstackMapEvent
{
    [JsonPropertyName("team_int")]
    public required int TeamNumber { get; init; }

    protected FragstackMapTeamEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackRoundEvent : FragstackMapEvent
{
    [JsonPropertyName("round_number")]
    public required int RoundNumber { get; init; }

    protected FragstackRoundEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackTimedRoundEvent : FragstackRoundEvent
{
    [JsonPropertyName("round_time")]
    public required int RoundTime { get; init; }

    protected FragstackTimedRoundEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackPlayerRoundEvent : FragstackRoundEvent
{

    [JsonPropertyName("player")]
    public required FragstackPlayer Player { get; init; }

    protected FragstackPlayerRoundEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackPlayerTimedRoundEvent : FragstackTimedRoundEvent
{
    [JsonPropertyName("player")]
    public required FragstackPlayer Player { get; init; }

    protected FragstackPlayerTimedRoundEvent(string eventName) : base(eventName)
    {
    }
}

// Get5Player: a player in the live events.
public class FragstackPlayer
{
    // SteamID64, or BOT-<user_id> for bots.
    [JsonPropertyName("steamid")]
    public required string SteamId { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("user_id")]
    public required int UserId { get; init; }

    // "ct", "t", "spec", or null.
    [JsonPropertyName("side")]
    public string? Side { get; init; }

    [JsonPropertyName("is_bot")]
    public required bool IsBot { get; init; }
}

// Get5Weapon: the game's weapon name and SourceMod's weapon id (0 when it has none).
public class FragstackWeapon
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("id")]
    public required int Id { get; init; }
}

// Get5AssisterObject
public class FragstackAssist
{
    [JsonPropertyName("player")]
    public required FragstackPlayer Player { get; init; }

    [JsonPropertyName("friendly_fire")]
    public required bool FriendlyFire { get; init; }

    [JsonPropertyName("flash_assist")]
    public required bool FlashAssist { get; init; }
}

// Get5PlayerDeathEvent. player is the victim; attacker and assist are null when there is none.
public class FragstackPlayerDeathEvent : FragstackPlayerTimedRoundEvent
{
    [JsonPropertyName("weapon")]
    public required FragstackWeapon Weapon { get; init; }

    [JsonPropertyName("bomb")]
    public required bool Bomb { get; init; }

    [JsonPropertyName("headshot")]
    public required bool Headshot { get; init; }

    [JsonPropertyName("thru_smoke")]
    public required bool ThruSmoke { get; init; }

    // Number of objects (players or walls) the bullet went through.
    [JsonPropertyName("penetrated")]
    public required int Penetrated { get; init; }

    [JsonPropertyName("attacker_blind")]
    public required bool AttackerBlind { get; init; }

    [JsonPropertyName("no_scope")]
    public required bool NoScope { get; init; }

    [JsonPropertyName("suicide")]
    public required bool Suicide { get; init; }

    [JsonPropertyName("friendly_fire")]
    public required bool FriendlyFire { get; init; }

    [JsonPropertyName("attacker")]
    public FragstackPlayer? Attacker { get; init; }

    [JsonPropertyName("assist")]
    public FragstackAssist? Assist { get; init; }

    public FragstackPlayerDeathEvent() : base("player_death")
    {
    }
}

// Get5PlayerBombEvent: bomb_planted / bomb_defused. site is "a", "b" or null.
public class FragstackBombEvent : FragstackPlayerTimedRoundEvent
{
    [JsonPropertyName("site")]
    public string? Site { get; init; }

    public FragstackBombEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackBombDefusedEvent : FragstackBombEvent
{
    // Milliseconds left on the bomb timer.
    [JsonPropertyName("bomb_time_remaining")]
    public required int BombTimeRemaining { get; init; }

    public FragstackBombDefusedEvent() : base("bomb_defused")
    {
    }
}

// round_start: when freeze time begins.
public class FragstackRoundStartedEvent : FragstackRoundEvent
{
    public FragstackRoundStartedEvent() : base("round_start")
    {
    }
}

// backup_loaded: round_number is the round restored to.
public class FragstackBackupRestoredEvent : FragstackRoundEvent
{
    [JsonPropertyName("filename")]
    public required string FileName { get; init; }

    public FragstackBackupRestoredEvent() : base("backup_loaded")
    {
    }
}

// Get5PlayerDisconnectedEvent
public class FragstackPlayerDisconnectedEvent : FragstackMatchEvent
{
    [JsonPropertyName("player")]
    public required FragstackPlayer Player { get; init; }

    public FragstackPlayerDisconnectedEvent() : base("player_disconnect")
    {
    }
}

public class FragstackSeriesStartedEvent : FragstackMatchEvent
{
    [JsonPropertyName("team1")]
    public required FragstackTeamWrapper Team1 { get; init; }

    [JsonPropertyName("team2")]
    public required FragstackTeamWrapper Team2 { get; init; }

    [JsonPropertyName("num_maps")]
    public required int NumberOfMaps { get; init; }

    public FragstackSeriesStartedEvent() : base("series_start")
    {
    }
}

// game_paused / game_unpaused, as in Get5.
public class FragstackPauseEvent : FragstackMapEvent
{
    [JsonPropertyName("team")]
    public required string Team { get; init; }

    [JsonPropertyName("pause_type")]
    public required string PauseType { get; init; }

    public FragstackPauseEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackSeriesResultEvent : FragstackMatchEvent
{
    [JsonPropertyName("time_until_restore")]
    public required int TimeUntilRestore { get; init; }

    [JsonPropertyName("winner")]
    public required Winner Winner { get; init; }

    [JsonPropertyName("team1_series_score")]
    public required int Team1SeriesScore { get; init; }

    [JsonPropertyName("team2_series_score")]
    public required int Team2SeriesScore { get; init; }

    public FragstackSeriesResultEvent() : base("series_end")
    {
    }
}

public class GoingLiveEvent : FragstackMapEvent
{
    public GoingLiveEvent() : base("going_live")
    {
    }
}

public class FragstackRoundEndedEvent : FragstackTimedRoundEvent
{

    [JsonPropertyName("reason")]
    public required int Reason { get; init; }

    [JsonPropertyName("winner")]
    public required Winner Winner { get; init; }

    [JsonPropertyName("team1")]
    public required FragstackStatsTeam StatsTeam1 { get; init; }

    [JsonPropertyName("team2")]
    public required FragstackStatsTeam StatsTeam2 { get; init; }

    public FragstackRoundEndedEvent() : base("round_end")
    {
    }
}

public class MapResultEvent : FragstackMapEvent
{
    [JsonPropertyName("winner")]
    public required Winner Winner { get; init; }

    [JsonPropertyName("team1")]
    public required FragstackStatsTeam StatsTeam1 { get; init; }

    [JsonPropertyName("team2")]
    public required FragstackStatsTeam StatsTeam2 { get; init; }

    public MapResultEvent() : base("map_result")
    {
    }
}

public class FragstackMapSelectionEvent : FragstackMatchTeamEvent
{
    [JsonPropertyName("map_name")]
    public required string MapName { get; init; }

    protected FragstackMapSelectionEvent(string eventName) : base(eventName)
    {
    }
}

public class FragstackMapPickedEvent : FragstackMapSelectionEvent
{
    [JsonPropertyName("map_number")]
    public required int MapNumber { get; init; }

    public FragstackMapPickedEvent() : base("map_picked")
    {
    }
}

public class FragstackMapVetoedEvent : FragstackMapSelectionEvent
{
    public FragstackMapVetoedEvent() : base("map_vetoed")
    {
    }
}

public class FragstackSidePickedEvent : FragstackMapSelectionEvent
{
    [JsonPropertyName("map_number")]
    public required int MapNumber { get; init; }

    [JsonPropertyName("side")]
    public required string Side { get; init; }

    public FragstackSidePickedEvent() : base("side_picked")
    {
    }
}

public class FragstackDemoUploadedEvent : FragstackMatchEvent
{
    [JsonPropertyName("map_number")]
    public required int MapNumber { get; init; }

    [JsonPropertyName("filename")]
    public required string FileName { get; init; }

    [JsonPropertyName("success")]
    public bool Success { get; set; }

    public FragstackDemoUploadedEvent() : base("demo_upload_ended")
    {
    }
}