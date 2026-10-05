using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Fragstack
{
    /// <summary>
    /// Fragstack-specific match config helpers (no CounterStrikeSharp dependency — unit-testable).
    /// </summary>
    public static class FragstackSettings
    {
        public static bool TryParseMatchId(JToken? token, out long numericId, out string? stringId)
        {
            numericId = -1;
            stringId = null;
            if (token == null) return false;

            if (token.Type == JTokenType.Integer)
            {
                long value = token.Value<long>();
                if (value < 0 || value > int.MaxValue) return false;
                numericId = value;
                stringId = value.ToString();
                return true;
            }

            string text = token.ToString().Trim();
            if (text == "") return false;

            if (long.TryParse(text, out long asLong) && asLong >= 0 && asLong <= int.MaxValue)
            {
                numericId = asLong;
                stringId = text;
                return true;
            }

            // Fragstack UUID (or any opaque string id) → stable positive int for Fragstack DB / event matchid.
            if (Guid.TryParse(text, out Guid guid))
            {
                numericId = StablePositiveIntFromBytes(guid.ToByteArray());
                stringId = text;
                return true;
            }

            numericId = StablePositiveIntFromBytes(Encoding.UTF8.GetBytes(text));
            stringId = text;
            return true;
        }

        public static int StablePositiveIntFromBytes(byte[] bytes)
        {
            byte[] hash = SHA256.HashData(bytes);
            int value = BitConverter.ToInt32(hash, 0) & 0x7FFFFFFF;
            return value == 0 ? 1 : value;
        }

        /// <summary>
        /// Maps a Fragstack Advanced Settings object (and optional top-level fields) into Fragstack side_type + cvars.
        /// </summary>
        public static void ApplyToMatchConfig(
            JObject root,
            out string? sideType,
            out Dictionary<string, string> cvars,
            out FragstackMeta meta)
        {
            sideType = null;
            cvars = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            meta = new FragstackMeta();

            JObject? fragstack = root["fragstack"] as JObject;
            if (fragstack != null)
            {
                meta.LobbyId = fragstack["lobby_id"]?.ToString();
                meta.TournamentMatchId = fragstack["tournament_match_id"]?.ToString();
                meta.DathostMatchId = fragstack["dathost_match_id"]?.ToString();
                meta.MatchId = fragstack["match_id"]?.ToString() ?? root["matchid"]?.ToString();
            }

            JObject? settings = root["settings"] as JObject ?? fragstack?["settings"] as JObject;
            if (settings == null) return;

            if (MatchConfigJson.TryParseBool(settings["knifeRound"], out bool knifeRound))
            {
                sideType = knifeRound ? "always_knife" : "never_knife";
            }

            if (settings["maxRounds"] != null && int.TryParse(settings["maxRounds"]!.ToString(), out int maxRounds))
            {
                cvars["mp_maxrounds"] = maxRounds.ToString();
            }

            if (MatchConfigJson.TryParseBool(settings["overtime"], out bool overtime))
            {
                cvars["mp_overtime_enable"] = overtime ? "1" : "0";
            }

            if (settings["startMoney"] != null)
                cvars["mp_startmoney"] = settings["startMoney"]!.ToString();
            if (settings["maxMoney"] != null)
                cvars["mp_maxmoney"] = settings["maxMoney"]!.ToString();
            if (settings["overtimeMoney"] != null)
                cvars["mp_overtime_startmoney"] = settings["overtimeMoney"]!.ToString();
            if (settings["freezeTime"] != null)
                cvars["mp_freezetime"] = settings["freezeTime"]!.ToString();

            string? voice = settings["voiceChat"]?.ToString();
            if (voice == "allies_only")
            {
                cvars["sv_alltalk"] = "0";
                cvars["sv_deadtalk"] = "0";
                cvars["sv_talk_enemy_living"] = "0";
                cvars["sv_talk_enemy_dead"] = "0";
            }
            else if (voice == "all_players")
            {
                cvars["sv_alltalk"] = "1";
            }

            string? armor = settings["armor"]?.ToString();
            if (armor == "kevlar" || armor == "kevlar_helmet")
            {
                // Competitive-style start armor is typically handled by configs; keep as documentation hook.
                cvars["mp_free_armor"] = armor == "kevlar_helmet" ? "2" : "1";
            }

            if (MatchConfigJson.TryParseBool(settings["headshotOnly"], out bool hsOnly) && hsOnly)
            {
                cvars["mp_damage_headshot_only"] = "1";
            }

            if (MatchConfigJson.TryParseBool(settings["enableTechPause"], out bool techPause))
            {
                cvars["fragstack_enable_tech_pause"] = techPause ? "true" : "false";
            }
        }

        public static void MergeCvars(Dictionary<string, string> into, Dictionary<string, string> from)
        {
            foreach (var pair in from)
            {
                if (!into.ContainsKey(pair.Key))
                    into[pair.Key] = pair.Value;
            }
        }
    }

    public class FragstackMeta
    {
        public string? MatchId { get; set; }
        public string? LobbyId { get; set; }
        public string? TournamentMatchId { get; set; }
        public string? DathostMatchId { get; set; }
    }
}
