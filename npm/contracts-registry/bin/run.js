#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const PLATFORM_PACKAGES = {
  darwin: { arm64: "contracts-registry-darwin-arm64", x64: "contracts-registry-darwin-x64" },
  linux: { x64: "contracts-registry-linux-x64" },
};

const READY_MARKER = "Server running on ";

function resolveBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;
  const pkgName = PLATFORM_PACKAGES[platform]?.[arch];

  if (!pkgName) {
    console.error(
      `Unsupported platform: ${platform}-${arch}.\n` +
      `Supported: macOS (Intel/Apple Silicon), Linux (x64).`
    );
    process.exit(1);
  }

  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const binName = platform === "win32" ? "contracts-registry.exe" : "contracts-registry";
    return path.join(path.dirname(pkgJsonPath), "bin", binName);
  } catch {
    console.error(
      `Could not find the platform binary ("${pkgName}").\n` +
      `This usually means npm failed to install an optional dependency.\n` +
      `Try: npm install contracts-registry --force`
    );
    process.exit(1);
  }
}

function openBrowser(url) {
  const commands = {
    darwin: ["open", [url]],
    linux: ["xdg-open", [url]],
  };
  const entry = commands[process.platform];
  if (!entry) return;

  const [cmd, args] = entry;
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

const binaryPath = resolveBinaryPath();

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: ["inherit", "pipe", "inherit"],
});

let opened = false;

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);

  if (!opened && chunk.toString().includes(READY_MARKER)) {
    opened = true;
    const line = chunk.toString();
    const match = line.match(/Server running on (\S+)/);
    if (match) openBrowser(match[1]);
  }
});

child.on("exit", (code) => process.exit(code ?? 1));