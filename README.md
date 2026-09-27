# elviteamtracker.com

The public site for **Elvi's Team Tracker**, a Discord bot that follows EA NHL Pro Clubs
matches. Static pages on GitHub Pages at **https://elviteamtracker.com**.

It exists for two reasons: to explain the bot to people who are about to install it, and to
satisfy Discord's app-verification requirements, which demand a reachable Terms of Service and
Privacy Policy.

## Pages

| path | what |
|---|---|
| `/` | What the bot does, how to install it, the full command reference, and the permissions it asks for |
| `/changelog/` | Release notes, newest first |
| `/terms/` | Terms of Service |
| `/privacy/` | Privacy Policy — field by field, what is stored and how to have it removed |

Support and contact go to the Discord server: https://discord.gg/xJgUDyUhtP

## Editing

Plain HTML, one shared stylesheet in `assets/site.css`. No build step, no dependencies, no
JavaScript. Push to `main` and GitHub Pages redeploys.

When a feature ships, add an entry at the top of `/changelog/`. When what the bot stores
changes, update `/privacy/` **and** the date at the top of it — the date is the version.

## Keep off this site

Furball Coins, bets, parlays and **tournaments** are exclusive to the Frosty Furballs server and
are deliberately not described here — not in the features, not in the commands, not in the
changelog. The Privacy Policy still has to be accurate about sign-up data, so it describes it
generically ("a sign-up sheet") rather than naming the feature.

The other gated features (challenges, milestones, streak records, duels) get one honest line on
the overview page and no detail.

Weekly availability is the exception: it stays on the overview page, flagged **Coming soon**,
because it is meant for everyone eventually.
