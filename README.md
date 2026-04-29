# Highline-Offshore-Bank
Highline Offshore Bank

## Auto deploy to DigitalOcean

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-droplet.yml`.
On every push to `main`, GitHub connects to your droplet over SSH and runs:

- `git pull --ff-only origin main`
- `npm ci`
- `npm run build`
- `pm2 restart highline-api`

Set these repository secrets before using it:

- `DO_HOST` - droplet public IP (example: `137.184.125.95`)
- `DO_USER` - SSH user (example: `root`)
- `DO_PORT` - SSH port (usually `22`)
- `DO_SSH_PRIVATE_KEY` - private key contents (the key that can SSH into droplet)
