/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const webPush = require("web-push");

const keys = webPush.generateVAPIDKeys();
const shouldWriteEnv = process.argv.includes("--write-env");

function upsertEnvValue(contents, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const separator = contents.length === 0 || contents.endsWith("\n") ? "" : "\n";
  return `${contents}${separator}${line}\n`;
}

if (shouldWriteEnv) {
  const envPath = path.join(process.cwd(), ".env.local");
  let envContents = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";

  envContents = upsertEnvValue(
    envContents,
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    keys.publicKey,
  );
  envContents = upsertEnvValue(
    envContents,
    "VAPID_PRIVATE_KEY",
    keys.privateKey,
  );

  fs.writeFileSync(envPath, envContents, { encoding: "utf8", mode: 0o600 });

  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log("VAPID_PRIVATE_KEY was written to .env.local and was not printed.");
} else {
  console.log("Add these values to .env.local (never commit the private key):\n");
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
}
