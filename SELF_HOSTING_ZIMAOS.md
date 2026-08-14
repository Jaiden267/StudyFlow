# StudyFlow: ZimaOS + PocketBase + Cloudflare Tunnel

This project has been converted from the Figma Make mock-up into a functional self-hosted MVP.

## Working features

- Email/password registration
- Login, persistent authentication and logout
- Password-reset request and reset page (after SMTP is configured)
- User-owned data protected by PocketBase API rules
- Create, view, edit and delete assignments
- Create and complete subtasks, with automatic progress updates
- Save assignment notes
- Study planner with saved sessions and cancellation
- Focus timer that saves completed sessions
- Calendar view using saved assignments and sessions
- Dashboard and analytics calculated from live data
- Profile/settings persistence
- Account deletion with cascading removal of owned records

Not included yet: Google login, Google/Outlook calendar sync, SMS, payments, push notifications and assignment file uploads.

## Architecture

```
Internet
  -> Cloudflare Tunnel
  -> http://ZIMAOS-IP:8085
  -> Nginx (React website)
       -> /api/* -> PocketBase:8090
                    -> SQLite database + authentication
```

Only port `8085` is used by the public tunnel. PocketBase port `8090` is bound to `127.0.0.1` and should never be published publicly.

---

## 1. Prepare the project on your computer

Extract the supplied ZIP. The top-level folder must contain:

```
Dockerfile
docker-compose.yml
nginx.conf
package.json
pnpm-lock.yaml
src/
pocketbase/
```

Open a terminal in that folder.

Create the real environment file:

```bash
cp .env.example .env
```

Generate the PocketBase settings-encryption key:

```bash
openssl rand -hex 16
```

Copy the 32-character result into `.env`:

```env
PB_ENCRYPTION_KEY=PASTE_THE_32_CHARACTER_RESULT_HERE
```

Keep this key permanently. Losing or changing it can prevent PocketBase from decrypting encrypted settings such as SMTP credentials.

Do not commit `.env` to Git.

---

## 2. Copy the project to ZimaOS

Use SMB, SCP or another file-transfer method. Recommended destination:

```text
/DATA/AppData/studyflow/app
```

Example from Linux/macOS/PowerShell with OpenSSH:

```bash
scp -r ./studyflow-functional YOUR_USERNAME@YOUR_ZIMA_IP:/DATA/AppData/studyflow/app
```

Then connect to ZimaOS:

```bash
ssh YOUR_USERNAME@YOUR_ZIMA_IP
```

Create persistent data directories:

```bash
sudo mkdir -p /DATA/AppData/studyflow/pb_data
sudo mkdir -p /DATA/AppData/studyflow/pb_backups
sudo chown -R "$USER":"$USER" /DATA/AppData/studyflow
```

Enter the application directory:

```bash
cd /DATA/AppData/studyflow/app
```

Confirm `.env` exists:

```bash
ls -la .env
```

---

## 3. Build and start the containers

Run:

```bash
sudo docker compose up -d --build
```

The first build downloads Node packages and the PocketBase executable, so it can take several minutes.

Check status:

```bash
sudo docker compose ps
```

Both services should become healthy/running:

```text
studyflow-web
studyflow-pocketbase
```

View logs if something fails:

```bash
sudo docker compose logs -f
```

Or inspect one service:

```bash
sudo docker compose logs -f web
sudo docker compose logs -f pocketbase
```

Test the website from the ZimaOS server:

```bash
curl http://127.0.0.1:8085/health
```

Expected response:

```text
healthy
```

Test PocketBase through Nginx:

```bash
curl http://127.0.0.1:8085/api/health
```

The initial database migration runs automatically on PocketBase startup and creates:

- `users`
- `assignments`
- `assignment_tasks`
- `study_sessions`

---

## 4. Create the PocketBase administrator

Run this on ZimaOS, replacing the email and password:

```bash
sudo docker compose exec pocketbase \
  /pb/pocketbase superuser create \
  admin@yourdomain.com \
  'USE-A-UNIQUE-LONG-RANDOM-PASSWORD'
```

Use at least 16 random characters. Do not reuse your normal password.

### Open the admin panel safely

PocketBase Admin is deliberately blocked by the public Nginx site. Access it through SSH tunnelling.

On your computer, run:

```bash
ssh -L 8090:127.0.0.1:8090 YOUR_USERNAME@YOUR_ZIMA_IP
```

Leave that terminal open, then visit:

```text
http://127.0.0.1:8090/_/
```

Log in with the superuser you created.

Do not create a Cloudflare route for port `8090`.

---

## 5. Configure PocketBase application settings

In PocketBase Admin, open **Settings**.

Set:

```text
Application name: StudyFlow
Application URL: https://studyflow.YOURDOMAIN.COM
Sender name: StudyFlow
Sender address: no-reply@YOURDOMAIN.COM
```

Under proxy/IP settings, trust the reverse-proxy headers used by Nginx:

```text
X-Forwarded-For
X-Real-IP
```

The exact setting label may vary by PocketBase version.

Do not enable “require verified email” yet. First configure and test SMTP.

---

## 6. Configure SMTP for password resets

Without SMTP, normal registration and login still work, but password-reset emails will not be delivered.

Use a transactional email provider such as Resend, Postmark, Brevo, AWS SES or SendGrid. Do not run a home email server unless you understand SPF, DKIM, DMARC and deliverability.

In PocketBase Admin, open **Settings -> Mail settings** and enter the values supplied by your email provider:

```text
SMTP enabled: Yes
Host: provider SMTP host
Port: normally 587
Username: provider username
Password: provider password
TLS/STARTTLS: as specified by provider
Sender address: no-reply@YOURDOMAIN.COM
Sender name: StudyFlow
```

Send a test email from PocketBase Admin.

### Password-reset email URL

Edit the `users` auth collection and its password-reset email template. The action URL must point to your frontend:

```text
https://studyflow.YOURDOMAIN.COM/reset-password?token={TOKEN}
```

Use PocketBase's exact token placeholder shown in its template editor. It is normally `{TOKEN}`.

Test this complete flow after Cloudflare is configured:

1. Open StudyFlow login.
2. Enter the account email.
3. Select **Forgot password?**
4. Open the email.
5. Follow the link.
6. Enter and confirm a new password.
7. Log in using the new password.

---

## 7. Configure the Cloudflare Tunnel

You said a Cloudflare Tunnel already exists.

In Cloudflare:

1. Open **Networking -> Tunnels**.
2. Select your tunnel.
3. Open **Routes**.
4. Select **Add route -> Published application**.
5. Set the hostname, for example:

```text
studyflow.YOURDOMAIN.COM
```

6. Set service type to `HTTP`.

Use one of these origins:

### cloudflared runs directly on ZimaOS

```text
http://localhost:8085
```

### cloudflared runs in a separate Docker container

Use the ZimaOS LAN address:

```text
http://192.168.1.50:8085
```

Replace the IP with your server's fixed LAN IP.

### cloudflared shares `studyflow-network`

```text
http://studyflow-web:80
```

Do not configure router port forwarding. Cloudflare Tunnel uses an outbound connection.

Do not publish PocketBase port `8090`.

---

## 8. Cloudflare caching and security

Create a cache rule that bypasses caching for:

```text
studyflow.YOURDOMAIN.COM/api/*
```

The browser must always receive live API/authentication responses.

Static CSS, JavaScript and images can be cached.

Recommended Cloudflare protections:

- Managed WAF rules
- Bot protection appropriate to your plan
- Rate limiting for `/api/collections/users/records`
- Rate limiting for `/api/collections/users/auth-with-password`
- Rate limiting for `/api/collections/users/request-password-reset`

Do not place Cloudflare Access in front of the whole website if members of the public need to register. Cloudflare Access would require a separate Cloudflare identity before users could reach StudyFlow.

---

## 9. First functional test

Open:

```text
https://studyflow.YOURDOMAIN.COM
```

### Account test

1. Create Account.
2. Use a real email address and a password of at least 8 characters.
3. Confirm that the dashboard opens.
4. Refresh `/dashboard` directly.
5. Log out.
6. Log in again.

### Assignment test

1. Open Assignments.
2. Add an assignment with subtasks.
3. Refresh the browser.
4. Confirm the assignment still exists.
5. Open it.
6. Complete a subtask.
7. Confirm progress updates.
8. Edit the title and description.
9. Save notes.
10. Delete a test assignment.

### Planner/timer test

1. Add a planned study session.
2. Confirm it appears in Calendar.
3. Use Focus Timer for one or two minutes.
4. Select **Finish & Save**.
5. Confirm the saved time appears in Analytics.

### User isolation test — essential

Create two accounts in two private/incognito browser windows.

- Account A must not see Account B's assignments.
- Account B must not see Account A's assignments.
- Copy an assignment URL from A and open it as B. It should fail to load.

PocketBase API rules in the migration enforce ownership at database/API level, not only in the interface.

---

## 10. Backups

All live application data is stored under:

```text
/DATA/AppData/studyflow/pb_data
```

Back up this directory every night.

Minimum safe plan:

- Nightly local backup to a second physical disk
- Encrypted off-site copy
- Keep at least 7 daily and 4 weekly copies
- Test a restore monthly

You can also create backups from PocketBase Admin.

A backup stored only on the same disk as the live database is not a proper backup.

Keep these files in Git or another safe location:

```text
pocketbase/pb_migrations/
Dockerfile
docker-compose.yml
nginx.conf
src/
```

Keep `.env` out of Git, but store the encryption key in a password manager.

---

## 11. Updating the website

After changing code:

```bash
cd /DATA/AppData/studyflow/app
sudo docker compose up -d --build web
```

After changing PocketBase migrations or the PocketBase version:

```bash
sudo docker compose up -d --build pocketbase
```

View logs:

```bash
sudo docker compose logs -f --tail=200
```

Update PocketBase only after reading its changelog. PocketBase is pre-1.0 and may occasionally require manual migration changes.

---

## 12. Common problems

### Website shows 502 through Cloudflare

Check locally:

```bash
curl http://127.0.0.1:8085/health
sudo docker compose ps
sudo docker compose logs --tail=200 web
```

Make sure the tunnel origin uses `http://`, not `https://`, because Nginx listens for local HTTP on port 8085.

### Registration returns a collection-not-found error

Check PocketBase migration logs:

```bash
sudo docker compose logs --tail=300 pocketbase
```

Confirm the migration file exists:

```bash
ls pocketbase/pb_migrations
```

### Login works but data requests fail

Confirm Nginx can reach PocketBase:

```bash
curl http://127.0.0.1:8085/api/health
```

Then inspect browser Developer Tools -> Network for the failing `/api/` request.

### Directly refreshing `/dashboard` gives 404

Use the supplied `nginx.conf`. Its `try_files ... /index.html` rule is required for client-side routing.

### Password-reset email arrives but opens the wrong page

Change the `users` collection reset-email action URL to:

```text
https://studyflow.YOURDOMAIN.COM/reset-password?token={TOKEN}
```

### PocketBase Admin is inaccessible

That is intentional through the public site. Use the SSH tunnel:

```bash
ssh -L 8090:127.0.0.1:8090 YOUR_USERNAME@YOUR_ZIMA_IP
```

Then open `http://127.0.0.1:8090/_/`.

---

## Production checklist

```text
[ ] Unique PocketBase superuser password
[ ] PB_ENCRYPTION_KEY stored in password manager
[ ] .env excluded from Git
[ ] Port 8090 not publicly exposed
[ ] No router port forwarding
[ ] Cloudflare hostname uses HTTPS
[ ] /api/* bypasses Cloudflare cache
[ ] SMTP tested
[ ] Password-reset flow tested
[ ] Two-account isolation tested
[ ] Nightly backups enabled
[ ] Restore tested
[ ] ZimaOS and Docker kept updated
[ ] PocketBase changelog reviewed before upgrades
```
