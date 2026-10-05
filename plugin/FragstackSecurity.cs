using System.Text.RegularExpressions;

namespace Fragstack
{
    // Pure helpers for validating untrusted input and keeping secrets out of logs.
    // This file must not depend on CounterStrikeSharp so that it can be unit tested on its own (see tests/).
    public static class FragstackSecurity
    {
        // Fragstack / Get5 console commands that only change a setting and are therefore allowed in a match config's "cvars" block.
        // Commands that perform an action (loading a match or backup, adding players, ending the match, ...) are deliberately not listed.
        // Settings registered as FakeConVar are allowed automatically (see Fragstack.GetFragstackFakeConVarNames).
        public static readonly HashSet<string> MatchConfigSettingCommands = new(StringComparer.OrdinalIgnoreCase)
        {
            "fragstack_admin_chat_prefix", "fragstack_chat_prefix", "fragstack_chat_messages_timer_delay",
            "fragstack_allow_force_ready", "get5_allow_force_ready",
            "fragstack_autostart_mode",
            "fragstack_demo_name_format", "fragstack_demo_path", "fragstack_demo_recording_enabled",
            "fragstack_demo_upload_url", "fragstack_demo_upload_header_key", "fragstack_demo_upload_header_value",
            "get5_demo_upload_url", "get5_demo_upload_header_key", "get5_demo_upload_header_value",
            "fragstack_remote_backup_url", "fragstack_remote_backup_header_key", "fragstack_remote_backup_header_value",
            "get5_remote_backup_url", "get5_remote_backup_header_key", "get5_remote_backup_header_value",
            "fragstack_remote_log_url", "fragstack_remote_log_header_key", "fragstack_remote_log_header_value",
            "get5_remote_log_url", "get5_remote_log_header_key", "get5_remote_log_header_value",
            "fragstack_kick_when_no_match_loaded", "fragstack_whitelist_enabled_default",
            "fragstack_knife_enabled_default", "fragstack_playout_enabled_default",
            "fragstack_max_saved_last_grenades", "fragstack_save_nades_as_global_enabled",
            "fragstack_minimum_ready_required",
            "fragstack_pause_after_restore", "fragstack_use_pause_command_for_tactical_pause",
            "fragstack_reset_cvars_on_series_end", "fragstack_stop_command_available",
            "fragstack_time_to_start", "get5_time_to_start", "fragstack_time_to_start_veto", "get5_time_to_start_veto",
            "fragstack_ready_mode", "fragstack_join_start_delay",
            "fragstack_max_tech_pauses", "get5_max_tech_pauses", "fragstack_tech_pause_time", "get5_tech_pause_time", "get5_allow_technical_pause",
        };

        // Never settable from a match config, even though they are real convars / Fragstack settings.
        public static readonly HashSet<string> BlockedMatchCvars = new(StringComparer.OrdinalIgnoreCase)
        {
            "rcon_password",
            "fragstack_everyone_is_admin",
        };

        // Settings whose value is used as a file path or file name.
        private static readonly HashSet<string> PathCvars = new(StringComparer.OrdinalIgnoreCase)
        {
            "fragstack_demo_path", "fragstack_demo_name_format",
        };

        private static readonly char[] UnsafeValueChars = { '"', ';', '\r', '\n' };
        private static readonly Regex CvarNameRegex = new(@"^[A-Za-z0-9_]+$", RegexOptions.Compiled);

        // Match configs (and backups built from them) come from outside the server, so only real convars and Fragstack/Get5 settings
        // with a plain value are allowed. Anything else (e.g. "quit", or a value containing a quote or ';') could run console commands.
        public static bool IsAllowedMatchCvar(string name, string value, Func<string, bool> isEngineConVar, ISet<string> pluginFakeConVars, out string reason)
        {
            reason = "";
            if (string.IsNullOrEmpty(name) || !CvarNameRegex.IsMatch(name))
            {
                reason = "invalid name";
                return false;
            }
            if (BlockedMatchCvars.Contains(name))
            {
                reason = "not allowed in a match config";
                return false;
            }
            if (value.IndexOfAny(UnsafeValueChars) >= 0)
            {
                reason = "value contains a quote, ';' or a line break";
                return false;
            }
            if (PathCvars.Contains(name) && !IsSafeRelativePath(value))
            {
                reason = "value must be a relative path without '..'";
                return false;
            }
            bool isPluginName = name.StartsWith("fragstack_", StringComparison.OrdinalIgnoreCase) || name.StartsWith("get5_", StringComparison.OrdinalIgnoreCase);
            if (isPluginName)
            {
                if (MatchConfigSettingCommands.Contains(name) || pluginFakeConVars.Contains(name)) return true;
                reason = "not a Fragstack setting (action commands are not allowed)";
                return false;
            }
            if (!isEngineConVar(name))
            {
                reason = "not a convar";
                return false;
            }
            return true;
        }

        public static bool IsSafeRelativePath(string value)
        {
            if (value == "") return true;
            if (value.StartsWith('/') || value.StartsWith('\\') || value.Contains(':')) return false;
            return !value.Split('/', '\\').Any(part => part == "..");
        }

        // A value that can safely be wrapped in double quotes in a console command.
        public static bool IsQuotableValue(string value)
        {
            return value.IndexOfAny(new[] { '"', '\r', '\n' }) < 0;
        }

        public static bool IsSecretCvar(string name)
        {
            return name.Contains("header_value", StringComparison.OrdinalIgnoreCase)
                || name.Contains("password", StringComparison.OrdinalIgnoreCase)
                || name.Contains("token", StringComparison.OrdinalIgnoreCase);
        }

        // URLs can carry credentials (user:pass@host, API keys or presigned signatures in the query string), so strip them before logging.
        public static string RedactUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return url;
            if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? uri)) return "<invalid url>";
            string redacted = $"{uri.Scheme}://{uri.Host}{(uri.IsDefaultPort ? "" : $":{uri.Port}")}{uri.AbsolutePath}";
            if (!string.IsNullOrEmpty(uri.Query)) redacted += "?<redacted>";
            return redacted;
        }

        public static string RedactSecret(string value)
        {
            return string.IsNullOrEmpty(value) ? "" : "<redacted>";
        }

        // For audit logs of console commands: keep the command name, drop the arguments when the command sets a secret.
        public static string RedactConsoleCommand(string commandLine)
        {
            string trimmed = commandLine.Trim();
            int space = trimmed.IndexOfAny(new[] { ' ', '\t' });
            string name = space < 0 ? trimmed : trimmed[..space];
            return IsSecretCvar(name) && space >= 0 ? $"{name} <redacted>" : trimmed;
        }

        private static readonly Regex AdminFlagRegex = new(@"^@[a-z0-9_]+/([a-z0-9_]+|\*)$", RegexOptions.Compiled);

        // Fragstack admins.json values can list CSSharp flags, e.g. "@css/config @css/map" or "@css/config,@css/chat".
        // Only tokens shaped like a flag (@domain/name) count; anything else (a name, a label like "@owner") is ignored.
        public static List<string> GetAdminFlags(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return new();
            return role.Split(new[] { ',', ';', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(flag => flag.ToLowerInvariant())
                .Where(flag => AdminFlagRegex.IsMatch(flag))
                .ToList();
        }

        public static bool AdminFlagsGrant(List<string> adminFlags, IEnumerable<string> requiredPermissions)
        {
            if (adminFlags.Contains("@css/root")) return true;
            foreach (string permission in requiredPermissions)
            {
                string required = permission.ToLowerInvariant();
                foreach (string flag in adminFlags)
                {
                    if (flag == required) return true;
                    // Domain wildcard, e.g. "@css/*" grants "@css/config"
                    if (flag.EndsWith("/*") && required.StartsWith(flag[..^1])) return true;
                }
            }
            return false;
        }
    }
}
