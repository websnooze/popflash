using Fragstack;
using Newtonsoft.Json.Linq;

namespace Fragstack.Tests;

public class FragstackSettingsTests
{
    [Fact]
    public void ParsesUuidMatchId()
    {
        string uuid = "550e8400-e29b-41d4-a716-446655440000";
        Assert.True(FragstackSettings.TryParseMatchId(JToken.Parse($"\"{uuid}\""), out long numeric, out string? str));
        Assert.Equal(uuid, str);
        Assert.True(numeric > 0);
        Assert.True(numeric <= int.MaxValue);
    }

    [Fact]
    public void ParsesIntegerMatchId()
    {
        Assert.True(FragstackSettings.TryParseMatchId(JToken.Parse("42"), out long numeric, out string? str));
        Assert.Equal(42, numeric);
        Assert.Equal("42", str);
    }

    [Fact]
    public void MapsKnifeAndMoneySettings()
    {
        var root = JObject.Parse("""
        {
          "fragstack": { "lobby_id": "lob-1", "tournament_match_id": "tm-1" },
          "settings": {
            "knifeRound": true,
            "maxRounds": 24,
            "overtime": true,
            "startMoney": 800,
            "maxMoney": 16000,
            "overtimeMoney": 10000,
            "freezeTime": 15,
            "voiceChat": "allies_only",
            "enableTechPause": true
          }
        }
        """);

        FragstackSettings.ApplyToMatchConfig(root, out string? sideType, out var cvars, out var meta);
        Assert.Equal("always_knife", sideType);
        Assert.Equal("lob-1", meta.LobbyId);
        Assert.Equal("tm-1", meta.TournamentMatchId);
        Assert.Equal("24", cvars["mp_maxrounds"]);
        Assert.Equal("1", cvars["mp_overtime_enable"]);
        Assert.Equal("800", cvars["mp_startmoney"]);
        Assert.Equal("15", cvars["mp_freezetime"]);
        Assert.Equal("0", cvars["sv_talk_enemy_living"]);
        Assert.Equal("true", cvars["fragstack_enable_tech_pause"]);
    }

    [Fact]
    public void KnifeOffMapsToNeverKnife()
    {
        var root = JObject.Parse("""{ "settings": { "knifeRound": false } }""");
        FragstackSettings.ApplyToMatchConfig(root, out string? sideType, out _, out _);
        Assert.Equal("never_knife", sideType);
    }
}
