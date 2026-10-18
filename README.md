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
| `/playercards/` | The player cards of those who opted in with the card's 🌐 Web button — **generated, never edited here** (see below) |

Support and contact go to the Discord server: https://discord.gg/xJgUDyUhtP

## Editing

Plain HTML, one shared stylesheet in `assets/site.css`. No build step, no dependencies, no
JavaScript. Push to `main`: the site goes live within ~10 minutes (see below).

### How it is published (since Oct 18, 2026)

GitHub Pages serves the **`gh-pages`** branch, not `main`. That branch is **built**, never
edited: `C:\DockerFiles\Ops\Publish-SiteCards.ps1` on the home server (scheduled task, every
10 minutes) takes `origin/main`, adds `/playercards/` from the EASSS server's export, and
force-pushes the result as **one commit with no parent**. Nothing is pushed when nothing changed.

Why no history: `/playercards/` holds the cards — avatar included — of the players who opted in
with the card's 🌐 Web button. Someone who opts out must really disappear, not survive in a
public commit history. So the cards never touch `main`, and `gh-pages` keeps no past versions.

`/playercards/` is **generated** by the EASSS server (`SiteExporter`, page source in
`EASSServer/src/main/resources/site/`): change the page in the EASSS repo, never here. Its JSON
holds the opted-in players only, never everyone.

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
