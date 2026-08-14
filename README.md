# StudyFlow functional self-hosted MVP

This is the Figma Make export converted from a visual mock-up into a real React + PocketBase application for self-hosting on ZimaOS.

Start here:

1. Read `SELF_HOSTING_ZIMAOS.md` from top to bottom.
2. Copy `.env.example` to `.env` and generate `PB_ENCRYPTION_KEY`.
3. Copy the whole folder to `/DATA/AppData/studyflow/app` on ZimaOS.
4. Run `sudo docker compose up -d --build`.
5. Create the PocketBase superuser using the command in the guide.
6. Point the Cloudflare Tunnel hostname to `http://YOUR_ZIMA_IP:8085`.

The database schema is created automatically by:

`pocketbase/pb_migrations/1754350000_initial_studyflow.js`

The frontend's real authentication and database calls are in:

- `src/api.ts`
- `src/App.tsx`

Google login, external calendar synchronization, SMS, payments, push notifications and assignment file uploads are deliberately not connected yet.
