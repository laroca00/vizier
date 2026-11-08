# Vizier crawler

Crawls ranked games without stopping, rolls them up into counts and publishes the finished stats (tier lists, builds, counters and the rest) to the Worker's D1 `stat_docs` table every four hours. The Worker serves those rows as they are.

It runs on its own server because a Worker on the free plan gets 50 requests, 10 ms of CPU and a share of 100k D1 writes per run, which holds the crawl to a few thousand games a day. Here the only limit is the Riot key.

- TR and EUW Emerald+ players on the Europe host, KR Challenger on the Asia host. Riot counts limits per host, so the two run side by side.
- The Emerald+ seed follows the ladder: three pages of each Emerald division, two of each Diamond division and a random 600 of Master and above per platform. It is replaced daily.
- Tier lists, pick rates and ban rates count only TR and EUW games (`pool` kinds in `stat_counts`, told apart by the match id prefix). KR Challenger games feed builds, matchups and the rest.
- Raw games stay three days for benchmarks and the CS curve. Everything else comes from `stat_counts`, which keeps the two newest patches.
- The code is the API's own (`services/api/src`). Node 24 runs the TypeScript directly, so there is nothing to build or install.

## Running it locally

```sh
RIOT_API_KEY=RGAPI-... node src/main.ts
```

Without the `CLOUDFLARE_*` variables it crawls and computes but publishes nothing.

## Server setup (Oracle Cloud Always Free)

1. Create a VM: shape `VM.Standard.A1.Flex` with 1 OCPU and 6 GB is enough, image Ubuntu 24.04. It needs no open ports.
2. Install Node 24 and git:

   ```sh
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```

3. Get the code with a read-only deploy key (GitHub: repository settings, Deploy keys):

   ```sh
   ssh-keygen -t ed25519 -f ~/.ssh/vizier_deploy -N ""
   cat ~/.ssh/vizier_deploy.pub   # add this as a deploy key
   sudo git -c core.sshCommand="ssh -i $HOME/.ssh/vizier_deploy" clone git@github.com:laroca00/vizier.git /opt/vizier
   sudo git -C /opt/vizier config core.sshCommand "ssh -i $HOME/.ssh/vizier_deploy"
   ```

4. Create the user, the data folder and the config:

   ```sh
   sudo useradd --system --home /var/lib/vizier vizier
   sudo mkdir -p /var/lib/vizier /etc/vizier
   sudo chown vizier /var/lib/vizier
   sudo cp /opt/vizier/services/crawler/deploy/crawler.env.example /etc/vizier/crawler.env
   echo "RGAPI-..." | sudo tee /etc/vizier/riot-key > /dev/null
   sudo chown root:vizier /etc/vizier/crawler.env /etc/vizier/riot-key
   sudo chmod 640 /etc/vizier/crawler.env /etc/vizier/riot-key
   ```

   Put a Cloudflare API token in `crawler.env`. Create it under My Profile, API Tokens, with only Account > D1 > Edit.

5. Start it:

   ```sh
   sudo cp /opt/vizier/services/crawler/deploy/vizier-crawler.service /etc/systemd/system/
   sudo systemctl enable --now vizier-crawler
   journalctl -fu vizier-crawler
   ```

## Switching the Worker over

1. Apply the migrations to D1 first (`pnpm --filter @vizier/api db:migrate:remote`), so `stat_docs` exists.
2. Start the crawler and wait for its first `publish:` line, about six minutes after the start.
3. Deploy the Worker. From then on it reads `stat_docs` and no longer crawls ranked games itself.

## Day to day

- A development key expires every 24 hours. Write the new one to `/etc/vizier/riot-key`; the crawler picks it up within ten minutes. A personal or production key does not expire.
- Updating the code: `sudo git -C /opt/vizier pull && sudo systemctl restart vizier-crawler`.
- Finding a mode's live queue: `sudo -u vizier env RIOT_API_KEY_FILE=/etc/vizier/riot-key node /opt/vizier/services/crawler/src/probeQueues.ts euw1` asks 12 Challenger players about each ARAM Mayhem, ARAM and Arena queue and prints which have games. It writes nothing and takes about two and a half minutes. Other queues can follow the platform: `... probeQueues.ts tr1 2400 2401`.
