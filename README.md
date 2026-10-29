# Zoom Bot Scheduler

A web page plus a self-hosted Docker worker for scheduling visible, silent Zoom participants. It supports one-time meetings or weekly recurrence on selected days with multiple times per day. The worker does not record audio, video, transcripts, or notes.

## Deploy on Vercel

Run `worker/Dockerfile` on a persistent Linux VM with at least 2 GB RAM and a persistent volume mounted at `/data`. The image supports ARM64 for Oracle Cloud Always Free. Set a long random `WORKER_TOKEN` on that service.

Then add these Production environment variables in **Vercel Project Settings → Environment Variables**:

- `BOT_WORKER_URL`: the worker's HTTPS address
- `BOT_WORKER_TOKEN`: the same private token configured on the worker

Redeploy after saving the variables. Open the deployment URL, fill in the form, and click **Schedule bot**. A successful response displays the bot ID; the browser is no longer needed after that.

The bot appears in Zoom's participant list and stays for up to four hours. It may need the host to admit it from the waiting room. Browser joins can fail when a host disables the Zoom Web App, enables end-to-end encryption, requires sign-in, or Zoom flags the guest join for CAPTCHA.
