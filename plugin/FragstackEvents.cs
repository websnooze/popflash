using System.Text.Json.Serialization;

namespace Fragstack
{
    /// <summary>
    /// Fragstack / DatHost-friendly webhook envelopes (in addition to native Fragstack Get5 events).
    /// </summary>
    public class FragstackCompatEvent
    {
        [JsonPropertyName("event")]
        public required string Event { get; init; }

        [JsonPropertyName("matchid")]
        public string? MatchId { get; init; }

        [JsonPropertyName("numeric_matchid")]
        public long NumericMatchId { get; init; }

        [JsonPropertyName("lobby_id")]
        public string? LobbyId { get; init; }

        [JsonPropertyName("tournament_match_id")]
        public string? TournamentMatchId { get; init; }

        [JsonPropertyName("dathost_match_id")]
        public string? DathostMatchId { get; init; }

        [JsonPropertyName("map")]
        public string? Map { get; init; }

        [JsonPropertyName("map_number")]
        public int? MapNumber { get; init; }

        [JsonPropertyName("team1_score")]
        public int? Team1Score { get; init; }

        [JsonPropertyName("team2_score")]
        public int? Team2Score { get; init; }

        [JsonPropertyName("series_team1_score")]
        public int? SeriesTeam1Score { get; init; }

        [JsonPropertyName("series_team2_score")]
        public int? SeriesTeam2Score { get; init; }

        [JsonPropertyName("source")]
        public string Source { get; init; } = "fragstack_fragstack";

        [JsonPropertyName("fragstack_event")]
        public string? FragstackEvent { get; init; }
    }
}
