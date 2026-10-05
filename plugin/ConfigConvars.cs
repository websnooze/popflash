using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Core.Attributes.Registration;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Cvars;
using CounterStrikeSharp.API.Modules.Utils;


namespace Fragstack
{
    public partial class Fragstack
    {

        public FakeConVar<bool> smokeColorEnabled = new("fragstack_smoke_color_enabled", "Whether player-specific smoke color is enabled or not. Default: false", false);
        public FakeConVar<bool> techPauseEnabled = new("fragstack_enable_tech_pause", "Whether .tech command is enabled or not. Default: true", true);
        public FakeConVar<string> techPausePermission  = new("fragstack_tech_pause_flag", "Flag required to use tech pause", "");

        public FakeConVar<bool> everyoneIsAdmin = new("fragstack_everyone_is_admin", "If set to true, all the players will have admin privilege. Default: false", false);

        public FakeConVar<bool> showCreditsOnMatchStart = new("fragstack_show_credits_on_match_start", "Whether to show 'Fragstack Plugin by WD-' message on match start. Default: true", true);

        public FakeConVar<string> hostnameFormat = new("fragstack_hostname_format", "The server hostname to use. Set to \"\" to disable/use existing. Default: Fragstack | {TEAM1} vs {TEAM2}", "Fragstack | {TEAM1} vs {TEAM2}");

        public FakeConVar<bool> enableDamageReport = new("fragstack_enable_damage_report", "Whether to show damage report after each round or not. Default: true", true);

        public FakeConVar<bool> stopCommandNoDamage = new("fragstack_stop_command_no_damage", "Whether the stop command becomes unavailable if a player damages a player from the opposing team.", false);

        public FakeConVar<string> matchStartMessage = new("fragstack_match_start_message", "Message to show when the match starts. Use $$$ to break message into multiple lines. Set to \"\" to disable.", "");

        [ConsoleCommand("fragstack_whitelist_enabled_default", "Whether Whitelist is enabled by default or not. Default value: false")]
        public void FragstackWLConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isWhitelistRequired = ParseBoolSetting(args, isWhitelistRequired);
        }
        
        [ConsoleCommand("fragstack_knife_enabled_default", "Whether knife round is enabled by default or not. Default value: true")]
        public void FragstackKnifeConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isKnifeRequired = ParseBoolSetting(args, isKnifeRequired);
        }

        [ConsoleCommand("fragstack_playout_enabled_default", "Whether knife round is enabled by default or not. Default value: true")]
        public void FragstackPlayoutConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isPlayOutEnabled = ParseBoolSetting(args, isPlayOutEnabled);
        }

        [ConsoleCommand("fragstack_save_nades_as_global_enabled", "Whether nades should be saved globally instead of being privated to players by default or not. Default value: false")]
        public void FragstackSaveNadesAsGlobalConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isSaveNadesAsGlobalEnabled = ParseBoolSetting(args, isSaveNadesAsGlobalEnabled);
        }

        [ConsoleCommand("fragstack_kick_when_no_match_loaded", "Whether to kick all clients and prevent anyone from joining the server if no match is loaded. Default value: false")]
        public void FragstackMatchModeOnlyConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            matchModeOnly = ParseBoolSetting(args, matchModeOnly);
        }

        [ConsoleCommand("fragstack_reset_cvars_on_series_end", "Whether parameters from the cvars section of a match configuration are restored to their original values when a series ends. Default value: true")]
        public void FragstackResetCvarsOnSeriesEndConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            resetCvarsOnSeriesEnd = ParseBoolSetting(args, resetCvarsOnSeriesEnd);
        }

        [ConsoleCommand("fragstack_minimum_ready_required", "Minimum ready players required to start the match. Default: 1")]
        public void FragstackMinimumReadyRequired(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            // Since there is already a console command for this purpose, we will use the same.   
            OnReadyRequiredCommand(player, command);
        }

        [ConsoleCommand("fragstack_demo_path", "Path of folder in which demos will be saved. If defined, it must not start with a slash and must end with a slash. Set to empty string to use the csgo root.")]
        public void FragstackDemoPath(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            if (command.ArgCount == 2)
            {
                string path = command.ArgByIndex(1);
                if (path == "")
                {
                    // Empty string means the csgo root, as documented.
                    demoPath = "";
                }
                else if (path[0] == '/' || path[0] == '.' || path[^1] != '/' || path.Contains("//"))
                {
                    Log($"fragstack_demo_path must end with a slash and must not start with a slash or dot. It will be reset to an empty string! Current value: {demoPath}");
                }
                else
                {
                    demoPath = path;
                }
            }
        }

        [ConsoleCommand("fragstack_demo_name_format", "Format of demo filname")]
        public void FragstackDemoNameFormat(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            if (command.ArgCount == 2)
            {
                string format = command.ArgByIndex(1).Trim();

                if (!string.IsNullOrEmpty(format)) 
                {
                    demoNameFormat = format;
                }
            }
        }

        [ConsoleCommand("fragstack_demo_recording_enabled", "Whether to automatically start demo recording when the match goes live. Default value: true")]
        public void FragstackDemoRecordingEnabled(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isDemoRecordingEnabled = ParseBoolSetting(args, isDemoRecordingEnabled);
        }

        [ConsoleCommand("get5_demo_upload_url", "If defined, recorded demos will be uploaded to this URL once the map ends.")]
        [ConsoleCommand("fragstack_demo_upload_url", "If defined, recorded demos will be uploaded to this URL once the map ends.")]
        public void FragstackDemoUploadURL(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string url = command.ArgByIndex(1);
            if (url.Trim() == "") return;
            if (!IsValidUrl(url))
            {
                Log($"[FragstackDemoUploadURL] Invalid URL: {FragstackSecurity.RedactUrl(url)}. Please provide a valid URL for uploading the demo!");
                return;
            }
            demoUploadURL = url;
        }

        [ConsoleCommand("fragstack_stop_command_available", "Whether .stop command is enabled or not (to restore the current round). Default value: false")]
        public void FragstackStopCommandEnabled(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isStopCommandAvailable = ParseBoolSetting(args, isStopCommandAvailable);
        }

        [ConsoleCommand("fragstack_use_pause_command_for_tactical_pause", "Whether to use !pause/.pause command for tactical pause or normal pause (unpauses only when both teams use unpause command, for admin force-unpauses the game). Default value: false")]
        public void FragstackPauseForTacticalCommand(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            isPauseCommandForTactical = ParseBoolSetting(args, isPauseCommandForTactical);
        }

        [ConsoleCommand("fragstack_pause_after_restore", "Whether to pause the match after a round is restored using fragstack. Default value: true")]
        public void FragstackPauseAfterStopEnabled(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            pauseAfterRoundRestore = ParseBoolSetting(args, pauseAfterRoundRestore);
        }

        [ConsoleCommand("fragstack_chat_prefix", "Default value of chat prefix for Fragstack messages. Default value: [{Green}Fragstack{Default}]")]
        public void FragstackChatPrefix(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;

            string args = GetSettingArgument(command);

            if (string.IsNullOrEmpty(args))
            {
                chatPrefix = $"[{ChatColors.Green}Fragstack{ChatColors.Default}]";
                return;
            }

            args = GetColorTreatedString(args);

            chatPrefix = args;

            Log($"[FragstackChatPrefix] chatPrefix: {chatPrefix}");
        }

        [ConsoleCommand("fragstack_admin_chat_prefix", "Chat prefix to show whenever an admin sends message using .asay <message>. Default value: [{Green}Fragstack{Default}]")]
        public void FragstackAdminChatPrefix(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;

            string args = GetSettingArgument(command);

            if (string.IsNullOrEmpty(args))
            {
                adminChatPrefix = $"[{ChatColors.Red}ADMIN{ChatColors.Default}]";
                return;
            }

            args = GetColorTreatedString(args);

            adminChatPrefix = args;

            Log($"[FragstackAdminChatPrefix] adminChatPrefix: {adminChatPrefix}");
        }

        [ConsoleCommand("fragstack_chat_messages_timer_delay", "Number of seconds of delay before sending reminder messages from Fragstack (like unready message, paused message, etc). Default: 12")]
        public void FragstackChatMessagesTimerDelay(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;

            if (command.ArgCount >= 2)
            {
                string commandArg = command.ArgByIndex(1);
                if (!string.IsNullOrWhiteSpace(commandArg))
                {
                    if (int.TryParse(commandArg, out int chatTimerDelayValue) && chatTimerDelayValue >= 0)
                    {
                        chatTimerDelay = chatTimerDelayValue;
                    }
                    else
                    {
                        // ReplyToUserCommand(player, $"Invalid value for fragstack_chat_messages_timer_delay. Please specify a valid non-negative number.");
                        ReplyToUserCommand(player, Localizer["fragstack.cvars.invalidvalue"]);
                    }
                }
            } else if (command.ArgCount == 1) {
                ReplyToUserCommand(player, $"fragstack_chat_messages_timer_delay = {chatTimerDelay}");
            }
        }

        [ConsoleCommand("fragstack_autostart_mode", "Whether the plugin will load the match mode, the practice moder or neither by startup. 0 for neither, 1 for match mode, 2 for practice mode. Default: 1")]
        public void FragstackAutoStartConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            if (int.TryParse(args, out int autoStartModeValue))
            {
                autoStartMode = autoStartModeValue;
            }

        }

        [ConsoleCommand("fragstack_allow_force_ready", "Whether force ready using !forceready is enabled or not (Currently works in Match Setup only). Default value: True")]
        [ConsoleCommand("get5_allow_force_ready", "Whether force ready using !forceready is enabled or not (Currently works in Match Setup only). Default value: True")]
        public void FragstackAllowForceReadyConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            allowForceReady = ParseBoolSetting(args, allowForceReady);
        }

        [ConsoleCommand("fragstack_max_saved_last_grenades", "Maximum number of grenade history that may be saved per-map, per-client. Set to 0 to disable. Default value: 512")]
        public void FragstackMaxSavedLastGrenadesConvar(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string args = GetSettingArgument(command);

            if (int.TryParse(args, out int maxLastGrenadesSavedLimitValue))
            {
                maxLastGrenadesSavedLimit = maxLastGrenadesSavedLimitValue;
            }
            else
            {
                // command.ReplyToCommand("Usage: fragstack_max_saved_last_grenades <number>");
                ReplyToUserCommand(player, Localizer["fragstack.cc.usage", $"fragstack_max_saved_last_grenades <number>"]);
            }
        }

        [ConsoleCommand("get5_remote_backup_url", "A URL to send backup files to over HTTP. Leave empty to disable.")]
        [ConsoleCommand("fragstack_remote_backup_url", "A URL to send backup files to over HTTP. Leave empty to disable.")]
        [CommandHelper(minArgs: 1, usage: "<remote_backup_upload_url>")]
        public void FragstackBackupUploadURL(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string url = command.ArgByIndex(1);
            if (url.Trim() == "") return;
            if (!IsValidUrl(url))
            {
                Log($"[FragstackBackupUploadURL] Invalid URL: {FragstackSecurity.RedactUrl(url)}. Please provide a valid URL for uploading the backup!");
                return;
            }
            backupUploadURL = url;
        }

        [ConsoleCommand("get5_remote_backup_header_key", "If defined, a custom HTTP header with this name is added to the backup HTTP request.")]
        [ConsoleCommand("fragstack_remote_backup_header_key", "If defined, a custom HTTP header with this name is added to the backup HTTP request.")]
        [CommandHelper(minArgs: 1, usage: "<remote_backup_header_key>")]
        public void BackupUploadHeaderKeyCommand(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string header = command.ArgByIndex(1).Trim();

            if (header != "") backupUploadHeaderKey = header;
        }

        [ConsoleCommand("get5_remote_backup_header_value", "If defined, the value of the custom header added to the backup HTTP request.")]
        [ConsoleCommand("fragstack_remote_backup_header_value", "If defined, the value of the custom header added to the backup HTTP request.")]
        [CommandHelper(minArgs: 1, usage: "<remote_backup_header_value>")]
        public void BackupUploadHeaderValueCommand(CCSPlayerController? player, CommandInfo command)
        {
            if (player != null) return;
            string headerValue = command.ArgByIndex(1).Trim();

            if (headerValue != "") backupUploadHeaderValue = headerValue;
        }

    }
}
