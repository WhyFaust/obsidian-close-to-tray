import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import script from "./linux-indicator.py";

export function startLinuxTray(
    labels: { vault: string; tooltip: string },
    png: Buffer,
    handlers: {
        toggle: () => void;
        relaunch: () => void;
        quit: () => void;
        unavailable: () => void;
    },
) {
    const child = spawn("/usr/bin/python3", ["-u", "-c", script]);
    let stopped = false;
    const tray = {
        ready: false,
        setLabels(next: typeof labels) {
            if (!stopped) child.stdin.write(JSON.stringify(next) + "\n");
        },
        destroy() {
            stopped = true;
            tray.ready = false;
            child.stdin.end();
        },
    };
    const unavailable = () => {
        if (tray.ready) {
            tray.ready = false;
            handlers.unavailable();
        }
    };
    child.stdin.on("error", unavailable);
    child.on("error", unavailable);
    child.on("exit", () => {
        stopped = true;
        unavailable();
    });
    child.stderr.resume();
    createInterface({ input: child.stdout }).on("line", (line) => {
        if (stopped) return;
        switch (line) {
            case "ready": tray.ready = true; break;
            case "unavailable": unavailable(); break;
            case "toggle": handlers.toggle(); break;
            case "relaunch": handlers.relaunch(); break;
            case "quit": handlers.quit(); break;
        }
    });
    child.stdin.write(JSON.stringify({ ...labels, png: png.toString("base64") }) + "\n");
    return tray;
}
