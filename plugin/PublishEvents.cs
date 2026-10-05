using System.Text;
using System.Text.Json;
using CounterStrikeSharp.API;


namespace Fragstack
{
    public partial class Fragstack
    {
        // One client for all events (a new HttpClient per event can exhaust sockets on a busy server). Headers are set per
        // request because each match can have its own remote log URL and header.
        private static readonly HttpClient eventHttpClient = new() { Timeout = TimeSpan.FromSeconds(60) };

        private const int EventMaxAttempts = 3;

        // target: where to send the event. Pass CurrentRemoteLogTarget() captured before a match reset, so the event still goes to
        // the match's URL; by default the current match's settings are used.
        public async Task SendEventAsync(FragstackEvent @event, RemoteLogTarget? target = null)
        {
            try
            {
                target ??= CurrentRemoteLogTarget();
                if (string.IsNullOrEmpty(target.Url)) return;

                string jsonString = JsonSerializer.Serialize(@event, @event.GetType());
                await PostEventWithRetriesAsync(@event.EventName, jsonString, target);

                if (matchConfig.FragstackCompatEvents)
                {
                    FragstackCompatEvent? compat = BuildFragstackCompatEvent(@event);
                    if (compat != null)
                    {
                        string compatJson = JsonSerializer.Serialize(compat);
                        await PostEventWithRetriesAsync($"fragstack:{compat.Event}", compatJson, target);
                    }
                }
            }
            catch (Exception e)
            {
                Log($"[SendEventAsync FATAL] Sending {@event.EventName} failed: {e.Message}");
            }
        }

        private async Task PostEventWithRetriesAsync(string eventName, string jsonString, RemoteLogTarget target)
        {
            for (int attempt = 1; attempt <= EventMaxAttempts; attempt++)
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, target.Url)
                    {
                        Content = new StringContent(jsonString, Encoding.UTF8, "application/json")
                    };
                    if (!string.IsNullOrEmpty(target.HeaderKey) && !string.IsNullOrEmpty(target.HeaderValue))
                    {
                        request.Headers.TryAddWithoutValidation(target.HeaderKey, target.HeaderValue);
                    }

                    using var httpResponseMessage = await eventHttpClient.SendAsync(request);

                    if (httpResponseMessage.IsSuccessStatusCode)
                    {
                        Log($"[SendEventAsync] Sent {eventName} to {FragstackSecurity.RedactUrl(target.Url)} ({(int)httpResponseMessage.StatusCode}) attempt={attempt}");
                        return;
                    }

                    string body = await httpResponseMessage.Content.ReadAsStringAsync();
                    Log($"[SendEventAsync] Sending {eventName} failed status={httpResponseMessage.StatusCode} attempt={attempt}/{EventMaxAttempts} body={body}");
                }
                catch (Exception e)
                {
                    Log($"[SendEventAsync] Sending {eventName} exception attempt={attempt}/{EventMaxAttempts}: {e.Message}");
                }

                if (attempt < EventMaxAttempts)
                    await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt));
            }
        }

        private FragstackCompatEvent? BuildFragstackCompatEvent(FragstackEvent @event)
        {
            string? pfMatchId = string.IsNullOrWhiteSpace(matchConfig.FragstackMatchId)
                ? liveMatchId.ToString()
                : matchConfig.FragstackMatchId;

            switch (@event)
            {
                case GoingLiveEvent goingLive:
                    return new FragstackCompatEvent
                    {
                        Event = "match_started",
                        MatchId = pfMatchId,
                        NumericMatchId = liveMatchId,
                        LobbyId = NullIfEmpty(matchConfig.FragstackLobbyId),
                        TournamentMatchId = NullIfEmpty(matchConfig.FragstackTournamentMatchId),
                        DathostMatchId = NullIfEmpty(matchConfig.FragstackDathostMatchId),
                        Map = Server.MapName,
                        MapNumber = goingLive.MapNumber,
                        FragstackEvent = goingLive.EventName,
                    };

                case FragstackRoundEndedEvent roundEnded:
                    return new FragstackCompatEvent
                    {
                        Event = "round_end",
                        MatchId = pfMatchId,
                        NumericMatchId = liveMatchId,
                        LobbyId = NullIfEmpty(matchConfig.FragstackLobbyId),
                        TournamentMatchId = NullIfEmpty(matchConfig.FragstackTournamentMatchId),
                        DathostMatchId = NullIfEmpty(matchConfig.FragstackDathostMatchId),
                        Map = Server.MapName,
                        MapNumber = roundEnded.MapNumber,
                        Team1Score = roundEnded.StatsTeam1.Score,
                        Team2Score = roundEnded.StatsTeam2.Score,
                        FragstackEvent = roundEnded.EventName,
                    };

                case MapResultEvent mapResult:
                    return new FragstackCompatEvent
                    {
                        Event = "match_ended",
                        MatchId = pfMatchId,
                        NumericMatchId = liveMatchId,
                        LobbyId = NullIfEmpty(matchConfig.FragstackLobbyId),
                        TournamentMatchId = NullIfEmpty(matchConfig.FragstackTournamentMatchId),
                        DathostMatchId = NullIfEmpty(matchConfig.FragstackDathostMatchId),
                        Map = Server.MapName,
                        MapNumber = mapResult.MapNumber,
                        Team1Score = mapResult.StatsTeam1.Score,
                        Team2Score = mapResult.StatsTeam2.Score,
                        FragstackEvent = mapResult.EventName,
                    };

                case FragstackSeriesResultEvent seriesResult:
                    return new FragstackCompatEvent
                    {
                        Event = "series_end",
                        MatchId = pfMatchId,
                        NumericMatchId = liveMatchId,
                        LobbyId = NullIfEmpty(matchConfig.FragstackLobbyId),
                        TournamentMatchId = NullIfEmpty(matchConfig.FragstackTournamentMatchId),
                        DathostMatchId = NullIfEmpty(matchConfig.FragstackDathostMatchId),
                        Map = Server.MapName,
                        SeriesTeam1Score = seriesResult.Team1SeriesScore,
                        SeriesTeam2Score = seriesResult.Team2SeriesScore,
                        FragstackEvent = seriesResult.EventName,
                    };

                case FragstackSeriesStartedEvent:
                    return new FragstackCompatEvent
                    {
                        Event = "server_ready_for_players",
                        MatchId = pfMatchId,
                        NumericMatchId = liveMatchId,
                        LobbyId = NullIfEmpty(matchConfig.FragstackLobbyId),
                        TournamentMatchId = NullIfEmpty(matchConfig.FragstackTournamentMatchId),
                        DathostMatchId = NullIfEmpty(matchConfig.FragstackDathostMatchId),
                        Map = Server.MapName,
                        FragstackEvent = @event.EventName,
                    };

                default:
                    return null;
            }
        }

        private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
