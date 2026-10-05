using System.Reflection;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Cvars;

namespace Fragstack
{
    public partial class Fragstack
    {
        // A Fragstack setting that is a console command (not a convar), so its value cannot be read with ConVar.Find.
        // IsValid: checks a value before Set (restored values can come from a backup file).
        private record PluginSetting(Func<string> Get, Action<string> Set, Func<string, bool>? IsValid = null);

        private Dictionary<string, PluginSetting>? pluginSettings;

        // The Fragstack / Get5 settings a match config's "cvars" can change, read and written directly so that their values from
        // before the match can be restored at series end. (Remote log settings are per match already, see RemoteLogConfig.)
        private Dictionary<string, PluginSetting> GetPluginSettings()
        {
            if (pluginSettings != null) return pluginSettings;
            PluginSetting Bool(Func<bool> get, Action<bool> set) => new(() => get() ? "true" : "false", value => set(ParseBoolSetting(value, get())));
            PluginSetting Int(Func<int> get, Action<int> set) => new(() => get().ToString(), value => { if (int.TryParse(value, out int number)) set(number); });
            PluginSetting Text(Func<string> get, Action<string> set) => new(get, set);
            PluginSetting Url(Func<string> get, Action<string> set) => new(get, set, value => value == "" || IsValidUrl(value));
            PluginSetting RelativePath(Func<string> get, Action<string> set) => new(get, set, FragstackSecurity.IsSafeRelativePath);

            var settings = new Dictionary<string, PluginSetting>(StringComparer.OrdinalIgnoreCase)
            {
                ["fragstack_whitelist_enabled_default"] = Bool(() => isWhitelistRequired, v => isWhitelistRequired = v),
                ["fragstack_knife_enabled_default"] = Bool(() => isKnifeRequired, v => isKnifeRequired = v),
                ["fragstack_playout_enabled_default"] = Bool(() => isPlayOutEnabled, v => isPlayOutEnabled = v),
                ["fragstack_save_nades_as_global_enabled"] = Bool(() => isSaveNadesAsGlobalEnabled, v => isSaveNadesAsGlobalEnabled = v),
                ["fragstack_kick_when_no_match_loaded"] = Bool(() => matchModeOnly, v => matchModeOnly = v),
                ["fragstack_reset_cvars_on_series_end"] = Bool(() => resetCvarsOnSeriesEnd, v => resetCvarsOnSeriesEnd = v),
                ["fragstack_minimum_ready_required"] = Int(() => minimumReadyRequired, v => minimumReadyRequired = v),
                ["fragstack_demo_path"] = RelativePath(() => demoPath, v => demoPath = v),
                ["fragstack_demo_name_format"] = RelativePath(() => demoNameFormat, v => demoNameFormat = v),
                ["fragstack_demo_recording_enabled"] = Bool(() => isDemoRecordingEnabled, v => isDemoRecordingEnabled = v),
                ["fragstack_demo_upload_url"] = Url(() => demoUploadURL, v => demoUploadURL = v),
                ["fragstack_demo_upload_header_key"] = Text(() => demoUploadHeaderKey, v => demoUploadHeaderKey = v),
                ["fragstack_demo_upload_header_value"] = Text(() => demoUploadHeaderValue, v => demoUploadHeaderValue = v),
                ["fragstack_stop_command_available"] = Bool(() => isStopCommandAvailable, v => isStopCommandAvailable = v),
                ["fragstack_use_pause_command_for_tactical_pause"] = Bool(() => isPauseCommandForTactical, v => isPauseCommandForTactical = v),
                ["fragstack_pause_after_restore"] = Bool(() => pauseAfterRoundRestore, v => pauseAfterRoundRestore = v),
                ["fragstack_chat_messages_timer_delay"] = Int(() => chatTimerDelay, v => chatTimerDelay = v),
                // Stored with the colors already applied, so they are written back as they were.
                ["fragstack_chat_prefix"] = Text(() => chatPrefix, v => chatPrefix = v),
                ["fragstack_admin_chat_prefix"] = Text(() => adminChatPrefix, v => adminChatPrefix = v),
                ["fragstack_autostart_mode"] = Int(() => autoStartMode, v => autoStartMode = v),
                ["fragstack_allow_force_ready"] = Bool(() => allowForceReady, v => allowForceReady = v),
                ["fragstack_max_saved_last_grenades"] = Int(() => maxLastGrenadesSavedLimit, v => maxLastGrenadesSavedLimit = v),
                ["fragstack_remote_backup_url"] = Url(() => backupUploadURL, v => backupUploadURL = v),
                ["fragstack_remote_backup_header_key"] = Text(() => backupUploadHeaderKey, v => backupUploadHeaderKey = v),
                ["fragstack_remote_backup_header_value"] = Text(() => backupUploadHeaderValue, v => backupUploadHeaderValue = v),
                ["fragstack_time_to_start"] = Int(() => timeToStart, v => timeToStart = Math.Max(0, v)),
                ["fragstack_time_to_start_veto"] = Int(() => timeToStartVeto, v => timeToStartVeto = Math.Max(0, v)),
                ["fragstack_ready_mode"] = Int(() => readyMode, v => readyMode = v == 1 ? 1 : 0),
                ["fragstack_join_start_delay"] = Int(() => joinStartDelay, v => joinStartDelay = Math.Max(0, v)),
                ["fragstack_max_tech_pauses"] = Int(() => maxTechPauses, v => maxTechPauses = Math.Max(0, v)),
                ["fragstack_tech_pause_time"] = Int(() => techPauseTime, v => techPauseTime = Math.Max(0, v)),
                ["get5_allow_technical_pause"] = Bool(() => techPauseEnabled.Value, v => techPauseEnabled.Value = v),
            };
            // Get5 names of the same settings
            foreach (string name in new[] { "demo_upload_url", "demo_upload_header_key", "demo_upload_header_value", "allow_force_ready", "time_to_start", "time_to_start_veto", "max_tech_pauses", "tech_pause_time",
                "remote_backup_url", "remote_backup_header_key", "remote_backup_header_value" })
            {
                settings["get5_" + name] = settings["fragstack_" + name];
            }
            pluginSettings = settings;
            return settings;
        }

        private Dictionary<string, (object FakeConVar, PropertyInfo Value)>? fakeConVarsByName;

        // Current value of a FakeConVar setting (e.g. fragstack_enable_damage_report), or null if there is none with that name.
        private Dictionary<string, (object FakeConVar, PropertyInfo Value)> GetFakeConVarsByName()
        {
            if (fakeConVarsByName == null)
            {
                fakeConVarsByName = new(StringComparer.OrdinalIgnoreCase);
                foreach (var field in GetType().GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
                {
                    if (!field.FieldType.IsGenericType || field.FieldType.GetGenericTypeDefinition() != typeof(FakeConVar<>)) continue;
                    object? fakeConVar = field.GetValue(this);
                    PropertyInfo? valueProperty = field.FieldType.GetProperty("Value");
                    if (fakeConVar == null || valueProperty == null) continue;
                    if (field.FieldType.GetProperty("Name")?.GetValue(fakeConVar) is string fakeConVarName) fakeConVarsByName[fakeConVarName] = (fakeConVar, valueProperty);
                }
            }
            return fakeConVarsByName;
        }

        // Current value of a FakeConVar setting (e.g. fragstack_enable_damage_report), or null if there is none with that name.
        private string? GetFakeConVarValue(string name)
        {
            if (!GetFakeConVarsByName().TryGetValue(name, out var entry)) return null;
            object? value = entry.Value.GetValue(entry.FakeConVar);
            return value is bool flag ? (flag ? "true" : "false") : Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture);
        }

        // The value of a setting before a match config changes it: a real convar, a Fragstack setting command or a FakeConVar.
        private string? GetCurrentSettingValue(string name)
        {
            if (GetPluginSettings().TryGetValue(name, out var setting)) return setting.Get();
            ConVar? cvar = ConVar.Find(name);
            if (cvar != null) return GetConvarStringValue(cvar);
            return GetFakeConVarValue(name);
        }

        // The value of a setting command without surrounding quotes: match config cvars are run as name "value", and the
        // commands read the raw argument string (unquoted multi-word values from config.cfg keep working).
        private static string GetSettingArgument(CommandInfo command)
        {
            string args = command.ArgString.Trim();
            if (args.Length >= 2 && args[0] == '"' && args[^1] == '"') args = args[1..^1].Trim();
            return args;
        }

        // On/off settings accept true/false as well as 1/0, also quoted (match config cvars are run as name "value", and the
        // commands read the raw argument string). Anything else keeps the current value.
        public static bool ParseBoolSetting(string value, bool current)
        {
            return value.Trim().Trim('"').Trim().ToLowerInvariant() switch
            {
                "true" or "1" => true,
                "false" or "0" => false,
                _ => current,
            };
        }
    }
}
