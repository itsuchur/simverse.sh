# Production auto-deploy

Pushes to `main` deploy the VPS. Nothing on the server polls GitHub.

## Trigger

`.github/workflows/deploy.yml` runs on every push to `main`. The job SSHes to `debian@51.255.42.241` with `appleboy/ssh-action@v1.2.5` and the `DEPLOY_SSH_KEY` Actions secret (`command_timeout: 60m`). The remote command is `/usr/local/bin/simverse-deploy`.

That private key is an ed25519 key commented `github-actions-deploy`. Its `authorized_keys` line forces the command and disables forwarding:

```
command="/usr/local/bin/simverse-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 ... github-actions-deploy
```

A leaked Actions secret can start a deploy. It cannot open a shell, run a different command, or forward ports. The normal `debian` login key is a separate line in `authorized_keys` and is the one to use for administration.

The private key was removed from the workstation after `gh secret set`. Manage the secret from a machine logged in as `itsuchur` (`repo` scope):

```bash
gh secret set DEPLOY_SSH_KEY -R itsuchur/simverse.sh < new-key
```

## What the VPS runs

The checkout is `/opt/simverse.sh` on `main`. `.env` is gitignored and stays on the server. GitHub fetches use `~/.ssh/config` (`Host github.com`, `IdentityFile ~/.ssh/github_deploy_key`). That key is how the VPS pulls. It is not the Actions key.

`/usr/local/bin/simverse-deploy` is root-owned and lives outside the checkout, so a bad pull cannot replace the script that pulls. It is not in git. Change it on the server (`sudo install -m 755`), not by editing the repo.

`debian` is in the `docker` group and has passwordless `sudo`. Compose file is `compose.prod.yaml`. The `app` image has no Prisma CLI. Migrations run from the poller image: `bun run db:migrate` is `prisma migrate deploy`.

The script holds `/home/debian/.simverse-deploy.lock` with a blocking `flock`, so two pushes run one after the other. The second one fetches again and deploys the newer SHA.

Sequence:

1. `git fetch origin main`.
2. Compare `origin/main` with `/home/debian/.simverse-deployed-sha`. Equal means exit 0.
3. Refuse a dirty worktree.
4. `git merge --ff-only` onto `origin/main`.
5. `docker compose -f compose.prod.yaml build`.
6. If `git diff` from the stamp to the new SHA shows any change under `prisma/migrations`, stop `app` and `poller`, then `docker compose -f compose.prod.yaml run --rm --no-deps poller bun run db:migrate`. The poller image just built contains the new SQL. Stopping the old processes matters because this repo has shipped migrations that drop columns. Postgres, Redis, Strapi, and backups keep running.
7. `docker compose -f compose.prod.yaml up -d`.
8. Write the new SHA to the stamp only after `up -d` succeeds.

A missing stamp prints `no deployed stamp` and exits 1 before migrate or `up`. Seed the stamp with the SHA that is already running before relying on the script. `prisma migrate deploy` is safe to repeat. A failed migrate leaves the stamp on the previous SHA, so the next push retries the same commit. If `app` and `poller` were stopped for that migrate, they stay stopped until a later run gets through `up -d`.

`docker compose down -v` is not part of this path. `-v` deletes the Postgres and Redis volumes.

## Watching a deploy

The Actions log is the deploy log. The first successful run was [40154736942](https://github.com/itsuchur/simverse.sh/actions/runs/40154736942): fast-forward `7d5cbfc` to `0bbe146` (this workflow), image rebuild, no migration diff, `app` and `poller` recreated.

On the server, the running commit and the stamp should match after a success:

```bash
git -C /opt/simverse.sh rev-parse HEAD
cat /home/debian/.simverse-deployed-sha
docker compose -f /opt/simverse.sh/compose.prod.yaml ps
```

There is no `simverse-deploy` systemd unit or timer. A one-minute `git fetch` loop was installed and then removed so the VPS would not poll GitHub.
