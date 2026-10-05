### Match/Players Stats and Data

Fragstack comes with a default database (SQLite), which configures itself automatically. MySQL Database can also be used with Fragstack!
Currently we are using 3 tables, `fragstack_stats_matches`, `fragstack_stats_maps` and `fragstack_stats_players`.
 
As their names suggest, `fragstack_stats_matches` holds the data of every match, like matchid, team names, scores, etc.
`fragstack_stats_maps` stores data of every map in a match.
Whereas, `fragstack_stats_players` stores data/stats of every player who played in that match. It stores data like matchid, kills, deaths, assists, and other important stats!

### Using MySQL Database with Fragstack

To use MySQL Database with Fragstack, open `csgo/cfg/Fragstack/database.json` file. It's content will be like this:
```json
{
    "DatabaseType": "SQLite",
    "MySqlHost": "your_mysql_host",
    "MySqlDatabase": "your_mysql_database",
    "MySqlUsername": "your_mysql_username",
    "MySqlPassword": "your_mysql_password",
    "MySqlPort": 3306
}
```
Here, change the `DatabaseType` from `SQLite` to `MySQL` and then fill-up all the other details like host, database, username, etc.
MySQL Database is useful for those who wants to use a common database across multiple servers!

### CSV Stats
Once a match is over, data is pulled from the database and a CSV file is written in the folder:
`csgo/Fragstack_Stats`. This folder will contain CSV file for each match (file name pattern: `match_data_map{mapNumber}_{matchId}.csv`) and it will have the same data which is present in `fragstack_stats_players`.

There is a scope of improvement here, like having the match score in the CSV file or atleast in the file name patter. I'll make this change soon!
