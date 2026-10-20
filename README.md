# Brivo heartbeat

A small process that asks Brivo’s cloud whether your control panels are connected, then emails you when one stays offline and again when it comes back.

It does not join the shop network and it does not talk to the panel. The panel already checks in with Brivo about once a minute. When that check-in stops, `GET /control-panels` reports the panel as disconnected (or its `lastContact` goes stale), and new access codes will not download until the link returns. Doors can still accept credentials already stored on the panel.

Run it on a computer that stays powered on and online somewhere other than the shop. The same `npm start` command works on Linux, macOS, and Windows.

## What you need from Brivo

The client id and secret identify the application. They are not enough to sign in. This application uses Brivo’s password grant, which also needs the administrator’s username and password, and every API call needs the api-key or Brivo returns “Developer Inactive”.

1. Create an API key in the [Brivo developer portal](https://developer.brivo.com/apps/mykeys).
2. In Brivo Access, open **Marketplace**, choose **Generate API Token**, and create a **Password** application. Copy the client id and client secret.
3. In Brivo Access, open the account menu. Copy the Admin ID listed under the email into `BRIVO_USERNAME`. `BRIVO_PASSWORD` is the password for that Access login, not the developer portal password.

## Setup

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env
```

Fill in the Brivo values in `.env`. The US Brivo cloud is used, and every panel that administrator can see is watched.

`POLL_INTERVAL_MINUTES` is how often `npm start` asks Brivo. `LAST_CONTACT_MAX_MINUTES` is separate: a panel that still says connected counts as down when `lastContact` is older than that many minutes. A disconnected status counts as down immediately, regardless of either number.

## Email

`SMTP_USER` is the full Gmail address that sends the alert, such as `alerts@gmail.com`.

`SMTP_PASS` is not the password you type on the Gmail sign-in page. Google blocks that. Create an app password instead:

1. Sign in to the Google account for that address.
2. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) if it is off.
3. Open [App passwords](https://myaccount.google.com/apppasswords).
4. Create one named Brivo heartbeat. Google shows 16 letters. Paste them into `SMTP_PASS`.

`ALERT_TO` is the inbox that should get the alert. It can be the same address as `SMTP_USER`. Leave `SMTP_HOST` as `smtp.gmail.com`.

For another mail provider, `SMTP_USER` is the mailbox username, `SMTP_PASS` is that mailbox's password or app password, and `SMTP_HOST` is the provider's SMTP server.

Send one test message. This does not contact Brivo:

```bash
npm run test:email
```

Check the inbox, including spam. A rejected login usually means `SMTP_PASS` is the normal Gmail password instead of the app password.

## Run

One check, then exit. This only needs the Brivo values above:

```bash
npm run check
```

Check immediately, then keep checking on `POLL_INTERVAL_MINUTES` until you stop it. This also needs the SMTP settings:

```bash
npm start
```

The first offline email waits for two polls in a row. A single blip does not send mail. Coming back online sends one recovery email on the next healthy check.

`state.json` remembers which panels have already been emailed. It stores panel ids and the down streak only. Do not delete it while a panel is offline, or the next checks will send the offline email again.

On the spare Linux laptop, start it in a way that survives logout, for example `tmux`, `screen`, or a process supervisor. The program itself has no systemd unit or cron file.
