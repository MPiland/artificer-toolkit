import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { finished } from "node:stream/promises";

const root = resolve(import.meta.dirname, "..");
const confirmation = "validate-pre-staging-local";
const generatedFiles = [
  "packages/db/src/domains/bootstrap/generated/create_database.bundle.sql",
  "packages/db/src/types/supabase.database.ts",
];

function parseEnvironment(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadLocalEnvironment() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) throw new Error("Root .env.local is required.");
  for (const [name, value] of Object.entries(
    parseEnvironment(await readFile(path, "utf8")),
  )) {
    if (process.env[name] === undefined) process.env[name] = value;
  }

  if (
    process.env.MVP_AUDIT_EMAIL === undefined &&
    process.env.MANAGED_VTT_GM_EMAIL !== undefined
  ) {
    process.env.MVP_AUDIT_EMAIL = process.env.MANAGED_VTT_GM_EMAIL;
  }
  if (
    process.env.MVP_AUDIT_PASSWORD === undefined &&
    process.env.MANAGED_VTT_GM_PASSWORD !== undefined
  ) {
    process.env.MVP_AUDIT_PASSWORD = process.env.MANAGED_VTT_GM_PASSWORD;
  }
}

function run(command, args, { environment = {}, logPath }) {
  return new Promise((resolveRun, rejectRun) => {
    const useCorepackYarn = process.platform === "win32" && command === "yarn";
    const executable = useCorepackYarn ? process.execPath : command;
    const spawnArgs = useCorepackYarn
      ? [
          resolve(
            dirname(process.execPath),
            "node_modules/corepack/dist/yarn.js",
          ),
          ...args,
        ]
      : args;
    const log = createWriteStream(logPath, { flags: "a" });
    const child = spawn(executable, spawnArgs, {
      cwd: root,
      env: { ...process.env, ...environment },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    let logFailure = null;
    const settle = async (error) => {
      if (settled) return;
      settled = true;
      log.end();
      try {
        await finished(log);
      } catch (logError) {
        rejectRun(logError);
        return;
      }
      if (error) rejectRun(error);
      else resolveRun();
    };
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    log.once("error", (error) => {
      logFailure = error;
      if (child.exitCode === null) child.kill();
    });
    child.once("error", (error) => void settle(error));
    child.once(
      "close",
      (code, signal) =>
        void settle(
          logFailure ??
            (code === 0
              ? null
              : new Error(
                  `${command} ${args.join(" ")} failed (${signal ?? `exit ${code}`}).`,
                )),
        ),
    );
  });
}

async function git(...args) {
  const chunks = [];
  await new Promise((resolveGit, rejectGit) => {
    const child = spawn("git", args, {
      cwd: root,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.once("error", rejectGit);
    child.once("close", (code) =>
      code === 0
        ? resolveGit()
        : rejectGit(new Error(`git ${args.join(" ")} failed.`)),
    );
  });
  return Buffer.concat(chunks).toString("utf8").trimEnd();
}

async function sourceIdentity() {
  const [head, branch, status] = await Promise.all([
    git("rev-parse", "HEAD"),
    git("branch", "--show-current"),
    git("status", "--porcelain=v1"),
  ]);
  return {
    branch,
    head,
    statusChecksum: createHash("sha256").update(status).digest("hex"),
    status,
  };
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function stage(name, label, command, args, environment) {
  return { args, command, environment, label, name };
}

const stages = [
  stage("supabase-status", "Local Supabase status", "yarn", [
    "supabase",
    "status",
  ]),
  stage("bootstrap-bundle", "Generate database bootstrap bundle", "yarn", [
    "workspace",
    "@artificer-toolkit/db",
    "generate:bootstrap-bundle",
  ]),
  stage("database-reset", "Reset local Supabase", "yarn", [
    "supabase",
    "db",
    "reset",
    "--local",
  ]),
  stage("database-types", "Generate local Supabase types", "yarn", [
    "workspace",
    "@artificer-toolkit/db",
    "gen:types",
  ]),
  stage("generated-parity", "Require generated artifact parity", "git", [
    "diff",
    "--exit-code",
    "--",
    ...generatedFiles,
  ]),
  stage("build", "Forced serial workspace build", "yarn", [
    "turbo",
    "run",
    "build",
    "--force",
    "--concurrency=1",
  ]),
  stage("netlify-typecheck", "Netlify typecheck", "yarn", [
    "typecheck:netlify",
  ]),
  stage("typecheck", "Forced serial workspace typecheck", "yarn", [
    "turbo",
    "run",
    "typecheck",
    "--force",
    "--concurrency=1",
  ]),
  stage("schema-tests", "Schema tests", "yarn", [
    "workspace",
    "@artificer-toolkit/schema",
    "test",
  ]),
  stage("shared-tests", "Shared tests", "yarn", [
    "workspace",
    "@artificer-toolkit/shared",
    "test",
  ]),
  stage("db-tests", "Database tests", "yarn", [
    "workspace",
    "@artificer-toolkit/db",
    "test",
  ]),
  stage("functions-tests", "Functions tests", "yarn", [
    "workspace",
    "@artificer-toolkit/functions",
    "test",
  ]),
  stage("apis-tests", "API tests", "yarn", [
    "workspace",
    "@artificer-toolkit/apis",
    "test",
  ]),
  stage("design-system-tests", "Design system tests", "yarn", [
    "workspace",
    "@artificer-toolkit/design-system",
    "test",
  ]),
  stage("emails-tests", "Email tests", "yarn", [
    "workspace",
    "@artificer-toolkit/emails",
    "test",
  ]),
  stage("session-worker-tests", "Session Worker tests", "yarn", [
    "workspace",
    "@artificer-toolkit/session-worker",
    "test",
  ]),
  stage("session-host-tests", "Session Host tests", "yarn", [
    "workspace",
    "@artificer-toolkit/session-host",
    "test",
  ]),
  stage("web-unit-tests-1", "Web unit tests shard 1 of 4", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "test",
    "--maxWorkers=1",
    "--no-file-parallelism",
    "--shard=1/4",
  ]),
  stage("web-unit-tests-2", "Web unit tests shard 2 of 4", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "test",
    "--maxWorkers=1",
    "--no-file-parallelism",
    "--shard=2/4",
  ]),
  stage("web-unit-tests-3", "Web unit tests shard 3 of 4", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "test",
    "--maxWorkers=1",
    "--no-file-parallelism",
    "--shard=3/4",
  ]),
  stage("web-unit-tests-4", "Web unit tests shard 4 of 4", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "test",
    "--maxWorkers=1",
    "--no-file-parallelism",
    "--shard=4/4",
  ]),
  stage("web-typecheck-tests", "Web test typecheck", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "typecheck:tests",
  ]),
  stage("web-typecheck-stories", "Web Storybook typecheck", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "typecheck:stories",
  ]),
  stage("web-typecheck-config", "Web configuration typecheck", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "typecheck:config",
  ]),
  stage("web-storybook-tests", "Web Storybook tests", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "test:storybook",
  ]),
  stage("netlify-tests", "Netlify function tests", "yarn", [
    "vitest",
    "run",
    "--config",
    "vitest.config.ts",
    "netlify/tests",
    "--maxWorkers=1",
    "--no-file-parallelism",
  ]),
  stage("seed-and-audit", "Seed local SRD and canonical rules", "yarn", [
    "seed:srd:local",
  ]),
  stage("srd-audit-after-seed", "Audit freshly seeded local SRD", "yarn", [
    "audit:srd",
  ]),
  stage("srd-integration", "SRD integration", "yarn", ["test:srd:integration"]),
  stage("character-integration", "Character lifecycle integration", "yarn", [
    "test:character:integration",
  ]),
  stage("character-sheet-integration", "Character Sheet integration", "yarn", [
    "test:character-sheet:integration",
  ]),
  stage(
    "authored-rate-limit-integration",
    "Authored creation rate-limit integration",
    "yarn",
    [
      "workspace",
      "@artificer-toolkit/db",
      "test:authored-creation-rate-limit:integration",
    ],
  ),
  stage("social-hub-integration", "Social Hub integration", "yarn", [
    "test:social-hub:integration",
  ]),
  stage(
    "campaign-announcement-integration",
    "Campaign announcement integration",
    "yarn",
    ["test:campaign-announcement:integration"],
  ),
  stage("notifications-integration", "Notifications integration", "yarn", [
    "test:notifications:integration",
  ]),
  stage("vtt-map-integration", "VTT map integration", "yarn", [
    "test:vtt-map:integration",
  ]),
  stage(
    "authored-projection-verify-pre-vtt",
    "Verify local authored projections",
    "yarn",
    [
      "workspace",
      "@artificer-toolkit/functions",
      "projections:verify:authored:local",
    ],
  ),
  stage(
    "character-projection-verify-pre-vtt",
    "Verify local Character projections",
    "yarn",
    [
      "workspace",
      "@artificer-toolkit/functions",
      "projections:verify:characters:local",
    ],
  ),
  stage(
    "vtt-provision",
    "Provision local managed VTT fixture",
    "yarn",
    ["provision:vtt-managed-smoke:local"],
    { CONFIRM_MANAGED_VTT_SMOKE_PROVISION: "provision-managed-vtt-smoke" },
  ),
  stage("web-e2e", "Web end-to-end suite", "yarn", [
    "workspace",
    "@artificer-toolkit/web",
    "test:e2e",
  ]),
  stage("vtt-host", "Local authoritative VTT host gate", "yarn", [
    "test:session-host:local",
  ]),
  stage("vtt-browser", "Local exact browser VTT gate", "yarn", [
    "test:web:e2e:vtt-local",
  ]),
  stage(
    "authored-projection-verify-post-vtt",
    "Reverify local authored projections",
    "yarn",
    [
      "workspace",
      "@artificer-toolkit/functions",
      "projections:verify:authored:local",
    ],
  ),
  stage(
    "character-projection-verify-post-vtt",
    "Reverify local Character projections",
    "yarn",
    [
      "workspace",
      "@artificer-toolkit/functions",
      "projections:verify:characters:local",
    ],
  ),
  stage("srd-audit-post-vtt", "Reaudit local SRD", "yarn", ["audit:srd"]),
];

function sanitizeLogExcerpt(value) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/giu, "[REDACTED_CONNECTION_STRING]")
    .replace(
      /\b(?:access[_-]?token|api[_-]?key|password|secret|token)\s*[:=]\s*[^\s'"`]+/giu,
      (match) => {
        const separator = match.search(/[:=]/u);
        return `${match.slice(0, separator + 1)} [REDACTED]`;
      },
    );
}

async function failureExcerpt(logPath) {
  const contents = await readFile(logPath, "utf8").catch(() => "");
  return sanitizeLogExcerpt(contents.slice(-2000)).trim();
}

async function main() {
  const listing = process.argv.includes("--list");
  if (listing) {
    for (const [index, current] of stages.entries()) {
      console.log(`${index + 1}. ${current.name}: ${current.label}`);
      console.log(`   ${current.command} ${current.args.join(" ")}`);
    }
    console.log(
      `${stages.length + 1}. vtt-hardware (optional): existing hardware gate when PRE_STAGING_INCLUDE_VTT_HARDWARE=1`,
    );
    console.log(
      "   VTT_HARDWARE_FPS_GATE=1 yarn test:web:e2e:vtt-load:hardware",
    );
    return;
  }

  await loadLocalEnvironment();
  if (process.env.CONFIRM_PRE_STAGING_LOCAL_RESET !== confirmation) {
    throw new Error(
      `Set CONFIRM_PRE_STAGING_LOCAL_RESET=${confirmation} in the environment or .env.local.`,
    );
  }

  const artifactDirectory = resolve(
    root,
    process.env.PRE_STAGING_VALIDATION_DIR ??
      `.codex/validation/pre-staging-lifecycle/${timestamp()}`,
  );
  await mkdir(artifactDirectory, { recursive: true });
  const manifestPath = resolve(artifactDirectory, "manifest.json");
  const manifest = {
    artifactDirectory,
    startedAt: new Date().toISOString(),
    source: { start: await sourceIdentity() },
    stages: [],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const current of stages) {
    const logPath = resolve(artifactDirectory, `${current.name}.log`);
    const stageStart = Date.now();
    const entry = {
      command: [current.command, ...current.args],
      name: current.name,
      label: current.label,
      startedAt: new Date().toISOString(),
      status: "running",
      log: basename(logPath),
    };
    manifest.stages.push(entry);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[pre-staging] ${current.label}`);
    try {
      await run(current.command, current.args, {
        logPath,
        environment: current.environment,
      });
      entry.status = "passed";
      entry.completedAt = new Date().toISOString();
      entry.durationMs = Date.now() - stageStart;
    } catch {
      entry.status = "failed";
      entry.completedAt = new Date().toISOString();
      entry.durationMs = Date.now() - stageStart;
      entry.error = "Command failed; inspect the stage log.";
      manifest.completedAt = entry.completedAt;
      manifest.status = "failed";
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      const excerpt = await failureExcerpt(logPath);
      console.error(`[pre-staging] FAILED: ${current.label}; see ${logPath}`);
      if (excerpt) console.error(excerpt);
      process.exitCode = 1;
      return;
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  if (process.env.PRE_STAGING_INCLUDE_VTT_HARDWARE === "1") {
    const name = "vtt-hardware";
    const logPath = resolve(artifactDirectory, `${name}.log`);
    const stageStart = Date.now();
    const entry = {
      command: ["yarn", "test:web:e2e:vtt-load:hardware"],
      name,
      label: "Optional VTT hardware gate",
      startedAt: new Date().toISOString(),
      status: "running",
      log: basename(logPath),
    };
    manifest.stages.push(entry);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log("[pre-staging] Optional VTT hardware gate");
    try {
      await run("yarn", ["test:web:e2e:vtt-load:hardware"], {
        logPath,
        environment: { VTT_HARDWARE_FPS_GATE: "1" },
      });
      entry.status = "passed";
      entry.completedAt = new Date().toISOString();
      entry.durationMs = Date.now() - stageStart;
    } catch {
      entry.status = "failed";
      entry.completedAt = new Date().toISOString();
      entry.durationMs = Date.now() - stageStart;
      entry.error = "Command failed; inspect the stage log.";
      manifest.completedAt = entry.completedAt;
      manifest.status = "failed";
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      const excerpt = await failureExcerpt(logPath);
      console.error(`[pre-staging] FAILED: ${entry.label}; see ${logPath}`);
      if (excerpt) console.error(excerpt);
      process.exitCode = 1;
      return;
    }
  }

  const end = await sourceIdentity();
  manifest.source.end = end;
  manifest.completedAt = new Date().toISOString();
  if (JSON.stringify(manifest.source.start) !== JSON.stringify(end)) {
    manifest.status = "failed";
    manifest.source.error = "Source identity changed during validation.";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    throw new Error(
      "Source identity changed during validation; inspect the manifest before staging.",
    );
  }
  manifest.status = "passed";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[pre-staging] PASSED: ${artifactDirectory}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
