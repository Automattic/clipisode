#!/usr/bin/env python3
"""Interactive WebSocket server for testing Clipisode muxing integration."""

import asyncio
import json
import readline  # noqa: F401 — enables arrow keys + history for input()
import sys
import websockets

PORT = 63481

# ANSI
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
CYAN = "\033[36m"
WHITE = "\033[37m"
BG_DARK = "\033[48;5;236m"

active_ws = None
current_job = None


def banner():
    print(f"""
{BOLD}{CYAN}╔══════════════════════════════════════════════╗
║  Clipisode Muxing Server  ·  ws://127.0.0.1:{PORT}  ║
╚══════════════════════════════════════════════╝{RESET}
""")


def log_in(msg_type, data):
    print(f"\n{BOLD}{GREEN}◀ {msg_type}{RESET}")
    for k, v in data.items():
        if k == "type":
            continue
        val = json.dumps(v, indent=2) if isinstance(v, (dict, list)) else str(v)
        if "\n" in val:
            print(f"  {DIM}{k}:{RESET}")
            for line in val.split("\n"):
                print(f"    {line}")
        else:
            print(f"  {DIM}{k}:{RESET} {val}")


def log_out(msg_type, data):
    print(f"\n{BOLD}{BLUE}▶ {msg_type}{RESET}")
    for k, v in data.items():
        if k == "type":
            continue
        print(f"  {DIM}{k}:{RESET} {v}")


def show_prompt():
    if current_job:
        print(f"\n{BOLD}{YELLOW}Job: {current_job}{RESET}")
    print(f"{DIM}Commands:{RESET}")
    print(f"  {BOLD}s{RESET} {DIM}phase current total [message]{RESET}  — send job_status")
    print(f"  {BOLD}d{RESET} {DIM}[url]{RESET}                         — send job_done")
    print(f"  {BOLD}e{RESET} {DIM}[message]{RESET}                     — send job_error")
    print(f"  {BOLD}c{RESET}                                — send job_cancelled")
    print(f"  {BOLD}r{RESET}                                — send raw JSON")
    print(f"  {BOLD}q{RESET}                                — quit")
    print()


async def send_msg(data):
    global active_ws
    if not active_ws:
        print(f"{RED}No client connected.{RESET}")
        return
    try:
        raw = json.dumps(data)
        await active_ws.send(raw)
        log_out(data.get("type", "?"), data)
    except Exception as ex:
        print(f"{RED}Send failed: {ex}{RESET}")


async def handle_input(line):
    global current_job
    parts = line.strip().split(None, 1)
    if not parts:
        return

    cmd = parts[0].lower()
    rest = parts[1] if len(parts) > 1 else ""

    if cmd == "q":
        print(f"\n{DIM}Bye.{RESET}")
        sys.exit(0)

    elif cmd == "s":
        tokens = rest.split(None, 3)
        if len(tokens) < 3:
            print(f"{RED}Usage: s <phase> <current> <total> [message]{RESET}")
            print(f"{DIM}  Phases: downloading, trimming, joining{RESET}")
            return
        phase, current, total = tokens[0], tokens[1], tokens[2]
        message = tokens[3] if len(tokens) > 3 else f"{phase} {current}/{total}"
        await send_msg({
            "type": "job_status",
            "job_id": current_job or "",
            "phase": phase,
            "current": int(current),
            "total": int(total),
            "message": message,
        })

    elif cmd == "d":
        url = rest.strip() or "https://mcp.local/wp-content/uploads/fake-output.mp4"
        await send_msg({
            "type": "job_done",
            "job_id": current_job or "",
            "output_url": url,
        })
        current_job = None

    elif cmd == "e":
        message = rest.strip() or "Muxing failed (test error)"
        await send_msg({
            "type": "job_error",
            "job_id": current_job or "",
            "code": "TEST_ERROR",
            "message": message,
        })
        current_job = None

    elif cmd == "c":
        await send_msg({
            "type": "job_cancelled",
            "job_id": current_job or "",
        })
        current_job = None

    elif cmd == "r":
        raw = rest.strip()
        if not raw:
            print(f"{DIM}Enter JSON on one line:{RESET}")
            loop = asyncio.get_event_loop()
            raw = await loop.run_in_executor(None, readline_input, f"{MAGENTA}json> {RESET}")
        try:
            data = json.loads(raw)
            await send_msg(data)
        except json.JSONDecodeError:
            print(f"{RED}Invalid JSON.{RESET}")

    else:
        print(f"{RED}Unknown command: {cmd}{RESET}")


def readline_input(prompt):
    """Blocking input() with readline support (arrow keys, history)."""
    try:
        return input(prompt)
    except EOFError:
        return None


async def input_loop():
    loop = asyncio.get_event_loop()
    while True:
        try:
            line = await loop.run_in_executor(None, readline_input, f"{CYAN}> {RESET}")
            if line is None:
                break
            await handle_input(line)
        except KeyboardInterrupt:
            print(f"\n{DIM}Bye.{RESET}")
            break


async def handler(ws):
    global active_ws, current_job
    active_ws = ws
    addr = ws.remote_address
    print(f"\n{BOLD}{GREEN}● Client connected{RESET} {DIM}{addr}{RESET}")

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"\n{YELLOW}[raw]{RESET} {raw}")
                continue

            msg_type = msg.get("type", "?")
            log_in(msg_type, msg)

            if msg_type == "hello":
                ack = {"type": "hello_ack"}
                await ws.send(json.dumps(ack))
                log_out("hello_ack", ack)

            elif msg_type == "start_job":
                current_job = msg.get("job_id")
                n = len(msg.get("segments", []))
                print(f"\n{BOLD}{MAGENTA}⚡ Job started: {current_job} ({n} segments){RESET}")
                show_prompt()

            elif msg_type == "cancel_job":
                print(f"\n{YELLOW}Client cancelled job.{RESET}")
                current_job = None

    except websockets.ConnectionClosed:
        pass
    finally:
        print(f"\n{RED}● Client disconnected{RESET} {DIM}{addr}{RESET}")
        if active_ws is ws:
            active_ws = None


async def main():
    banner()
    print(f"{DIM}Waiting for client connection...{RESET}\n")

    async with websockets.serve(handler, "127.0.0.1", PORT):
        await input_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{DIM}Bye.{RESET}")
