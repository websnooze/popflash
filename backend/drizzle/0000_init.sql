CREATE TYPE "public"."lobby_status" AS ENUM('waiting', 'ready_check', 'launching', 'in_match', 'closed');--> statement-breakpoint
CREATE TYPE "public"."lobby_team" AS ENUM('unassigned', 'team1', 'team2');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('provisioning', 'booting', 'waiting_players', 'live', 'finished', 'canceled');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_id_64" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"profile_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_steam_id_64_unique" UNIQUE("steam_id_64")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "lobbies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"status" "lobby_status" DEFAULT 'waiting' NOT NULL,
	"team_size" integer DEFAULT 5 NOT NULL,
	"location" text DEFAULT 'stockholm' NOT NULL,
	"map" text,
	"map_pool" jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lobbies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "lobby_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lobby_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team" "lobby_team" DEFAULT 'unassigned' NOT NULL,
	"is_ready" boolean DEFAULT false NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"steam_id_64" text NOT NULL,
	"team" "lobby_team" NOT NULL,
	"nickname" text NOT NULL,
	"connected" integer DEFAULT 0 NOT NULL,
	"kicked" integer DEFAULT 0 NOT NULL,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lobby_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'provisioning' NOT NULL,
	"dathost_server_id" text,
	"dathost_match_id" text,
	"connect_ip" text,
	"connect_port" integer,
	"connect_password" text,
	"map" text NOT NULL,
	"location" text NOT NULL,
	"team_1_name" text DEFAULT 'Team A' NOT NULL,
	"team_2_name" text DEFAULT 'Team B' NOT NULL,
	"team_1_score" integer DEFAULT 0 NOT NULL,
	"team_2_score" integer DEFAULT 0 NOT NULL,
	"cancel_reason" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lobby_players" ADD CONSTRAINT "lobby_players_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lobby_players" ADD CONSTRAINT "lobby_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lobby_players_lobby_user_idx" ON "lobby_players" USING btree ("lobby_id","user_id");