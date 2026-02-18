# Clipisode Plugin — Agent Notes

## Rules

- No fallback or workaround code. If something needs changing in the environment or setup, ask — don't code around it.
- Production code only. No MVPs, no "good enough for now."
- Do not add validation, features, or behavior that wasn't requested.
- When deleting data (themes, posts, etc.) via MySQL, always update any foreign key references (e.g. `invitation_id` on topics) in the same step.
- When creating a new block, register it in PHP (`class-invitation.php`) — not just the JS/build side.

## Local MySQL Access

Always use this command to access the local WordPress database:

```bash
MYSQL_UNIX_PORT="/Users/christoph/Library/Application Support/Local/run/bAZpacUqd/mysql/mysqld.sock" mysql -u root -proot local
```

Database name: `local`
User: `root`
Password: `root`
Socket: `/Users/christoph/Library/Application Support/Local/run/bAZpacUqd/mysql/mysqld.sock`

Do NOT use `wp db query` or try to guess connection details. Use this exact command.

## WP-CLI

WP-CLI requires the socket too:

```bash
MYSQL_UNIX_PORT="/Users/christoph/Library/Application Support/Local/run/bAZpacUqd/mysql/mysqld.sock" wp --path="/Users/christoph/dev/wp-local/mcp/app/public" <command>
```
