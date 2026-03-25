import { GAMEPAD_SENSITIVITY, GAMEPAD_DEADZONE } from "./constants.js";

/**
 * Robust Xbox/generic controller manager.
 *
 * KEY FIX: On macOS, navigator.getGamepads() returns [null,null,null,null]
 * until the user both:
 *   1. Presses a button on the controller
 *   2. The page has received at least one user gesture (click/key)
 *
 * This manager handles:
 *  - Pre-activation scanning (before any button press)
 *  - Stale reference fix (ALWAYS re-reads from getGamepads each frame)
 *  - USB + Bluetooth hot-plug and reconnection
 *  - Visual status indicator
 */

export class GamepadController {
  constructor() {
    // --- Public output state (read each frame by game loop) ---
    this.connected = false;
    this.activated = false;
    this.moveX = 0;
    this.moveZ = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.shooting = false;
    this.aiming = false;
    this.jump = false;
    this.sprint = false;
    this.reload = false;
    this.pause = false;
    this.interact = false;
    this.controllerName = "";

    // --- Internal ---
    this._index = -1;
    this._prevButtons = new Array(20).fill(false);
    this._isStandard = true;
    this._statusEl = null;
    this._fadeTimer = null;
    this._lastLoggedId = "";

    // Standard Xbox button map
    this._BTN = {
      A: 0,
      B: 1,
      X: 2,
      Y: 3,
      LB: 4,
      RB: 5,
      LT: 6,
      RT: 7,
      BACK: 8,
      START: 9,
      L3: 10,
      R3: 11,
      UP: 12,
      DOWN: 13,
      LEFT: 14,
      RIGHT: 15,
    };

    this._createStatusUI();

    // Listen for browser gamepad events
    window.addEventListener("gamepadconnected", (e) => {
      console.log(
        `[Gamepad] Event: connected — "${e.gamepad.id}" index=${e.gamepad.index}`,
      );
      this._bindController(e.gamepad);
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(`[Gamepad] Event: disconnected — "${e.gamepad.id}"`);
      if (e.gamepad.index === this._index) {
        this._unbind();
      }
    });

    // Also poll immediately on any keydown/click — this wakes up
    // the Gamepad API on macOS which requires a user gesture first
    const wakeUp = () => {
      this._scanAll();
    };
    window.addEventListener("keydown", wakeUp, { once: false });
    window.addEventListener("mousedown", wakeUp, { once: false });
    window.addEventListener("pointerdown", wakeUp, { once: false });
  }

  // ── Status UI ───────────────────────────────────────────

  _createStatusUI() {
    let el = document.getElementById("gamepad-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "gamepad-status";
      document.body.appendChild(el);
    }
    Object.assign(el.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      color: "#999",
      fontFamily: "'Courier New', monospace",
      fontSize: "13px",
      zIndex: "300",
      pointerEvents: "none",
      transition: "opacity 0.4s",
      opacity: "0",
      textShadow: "0 1px 3px #000",
      background: "rgba(0,0,0,0.5)",
      padding: "4px 10px",
      borderRadius: "4px",
    });
    this._statusEl = el;
  }

  _showStatus(msg, color = "#999") {
    if (!this._statusEl) return;
    this._statusEl.textContent = msg;
    this._statusEl.style.color = color;
    this._statusEl.style.opacity = "1";
    clearTimeout(this._fadeTimer);
  }

  _showStatusTimed(msg, color = "#6c6", ms = 4000) {
    this._showStatus(msg, color);
    this._fadeTimer = setTimeout(() => {
      if (this._statusEl) this._statusEl.style.opacity = "0";
    }, ms);
  }

  // ── Connection management ───────────────────────────────

  _bindController(gp) {
    this._index = gp.index;
    this.connected = true;
    this._isStandard = gp.mapping === "standard";
    this.controllerName = this._identify(gp);

    if (this._lastLoggedId !== gp.id) {
      this._lastLoggedId = gp.id;
      console.log(
        `[Gamepad] Bound: "${gp.id}" idx=${gp.index} mapping=${gp.mapping} axes=${gp.axes.length} btns=${gp.buttons.length}`,
      );
    }

    if (!this.activated) {
      this._showStatus("🎮 Press any button to activate controller", "#cc6");
    } else {
      this._showStatusTimed(`🎮 ${this.controllerName}`, "#6c6");
    }
  }

  _unbind() {
    this.connected = false;
    this.activated = false;
    this._index = -1;
    this._lastLoggedId = "";
    this._clearOutputs();
    this._showStatusTimed("🎮 Controller disconnected", "#c66", 5000);
  }

  _identify(gp) {
    const id = gp.id.toLowerCase();
    let name = "Controller";

    if (id.includes("xbox") || id.includes("xinput") || id.includes("045e")) {
      name = "Xbox Controller";
    } else if (
      id.includes("054c") ||
      id.includes("playstation") ||
      id.includes("dualsense") ||
      id.includes("dualshock")
    ) {
      name = "PlayStation Controller";
    } else if (id.includes("057e") || id.includes("pro controller")) {
      name = "Nintendo Controller";
    }

    if (id.includes("bluetooth") || id.includes("wireless")) {
      name += " (BT)";
    } else if (id.includes("usb") || id.includes("wired")) {
      name += " (USB)";
    }
    return name;
  }

  _clearOutputs() {
    this.moveX = 0;
    this.moveZ = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.shooting = false;
    this.aiming = false;
    this.jump = false;
    this.sprint = false;
    this.reload = false;
    this.pause = false;
    this.interact = false;
  }

  // ── Scanning ────────────────────────────────────────────

  /**
   * Scan all gamepad slots for a connected controller.
   * ALWAYS reads fresh from navigator.getGamepads().
   */
  _scanAll() {
    let gamepads;
    try {
      gamepads = navigator.getGamepads();
    } catch {
      return null;
    }
    if (!gamepads) return null;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        if (!this.connected || this._index !== gp.index) {
          this._bindController(gp);
        }
        return gp;
      }
    }
    return null;
  }

  /**
   * Get a FRESH gamepad object. Never trust cached references.
   */
  _getFresh() {
    let gamepads;
    try {
      gamepads = navigator.getGamepads();
    } catch {
      return null;
    }
    if (!gamepads) return null;

    // Try known index first
    if (this._index >= 0) {
      const gp = gamepads[this._index];
      if (gp && gp.connected) return gp;
      // Stale index — rescan
      this._index = -1;
    }

    // Scan all slots
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        this._bindController(gp);
        return gp;
      }
    }

    return null;
  }

  // ── Input helpers ───────────────────────────────────────

  _deadzone(val) {
    if (Math.abs(val) < GAMEPAD_DEADZONE) return 0;
    const sign = Math.sign(val);
    return (sign * (Math.abs(val) - GAMEPAD_DEADZONE)) / (1 - GAMEPAD_DEADZONE);
  }

  _btn(gp, idx) {
    if (idx >= gp.buttons.length) return false;
    return gp.buttons[idx] ? gp.buttons[idx].pressed : false;
  }

  _btnEdge(gp, idx) {
    const cur = this._btn(gp, idx);
    const prev = this._prevButtons[idx] || false;
    this._prevButtons[idx] = cur;
    return cur && !prev;
  }

  _trigger(gp, idx) {
    if (idx >= gp.buttons.length) return 0;
    return gp.buttons[idx] ? gp.buttons[idx].value : 0;
  }

  _hasInput(gp) {
    for (let i = 0; i < gp.buttons.length; i++) {
      if (
        gp.buttons[i] &&
        (gp.buttons[i].pressed || gp.buttons[i].value > 0.15)
      ) {
        return true;
      }
    }
    for (let i = 0; i < gp.axes.length; i++) {
      if (Math.abs(gp.axes[i]) > GAMEPAD_DEADZONE * 2) return true;
    }
    return false;
  }

  // ── Main poll — call every frame ────────────────────────

  poll(dt) {
    // Step 1: Always get a FRESH gamepad reference
    const gp = this._getFresh();

    if (!gp) {
      if (this.connected) this._unbind();
      return;
    }

    if (!this.connected) {
      this._bindController(gp);
    }

    // Step 2: Activation — require real user input before processing
    if (!this.activated) {
      if (this._hasInput(gp)) {
        this.activated = true;
        console.log("[Gamepad] Activated — user pressed a button");
        this._showStatusTimed(`🎮 ${this.controllerName}`, "#6c6");
      } else {
        this._clearOutputs();
        return; // don't process input until activated
      }
    }

    // Step 3: Read inputs from FRESH gamepad reference

    // Sticks
    this.moveX = this._deadzone(gp.axes[0] || 0);
    this.moveZ = this._deadzone(gp.axes[1] || 0);

    const rawRX = this._deadzone(gp.axes[2] || 0);
    const rawRY = this._deadzone(gp.axes[3] || 0);
    const curve = 1.8;
    this.lookX =
      Math.sign(rawRX) *
      Math.pow(Math.abs(rawRX), curve) *
      GAMEPAD_SENSITIVITY *
      dt;
    this.lookY =
      Math.sign(rawRY) *
      Math.pow(Math.abs(rawRY), curve) *
      GAMEPAD_SENSITIVITY *
      dt;

    // Triggers — try buttons first, fallback to axes 4/5
    let rt = this._trigger(gp, this._BTN.RT);
    if (rt === 0 && gp.axes.length >= 6 && gp.axes[5] > -0.9) {
      rt = (gp.axes[5] + 1) / 2;
    }
    this.shooting = rt > 0.1;

    let lt = this._trigger(gp, this._BTN.LT);
    if (lt === 0 && gp.axes.length >= 5 && gp.axes[4] > -0.9) {
      lt = (gp.axes[4] + 1) / 2;
    }
    this.aiming = lt > 0.1;

    // Buttons
    this.jump = this._btnEdge(gp, this._BTN.A);
    this.reload = this._btnEdge(gp, this._BTN.X);
    this.grenade = this._btnEdge(gp, this._BTN.LB); // LB = throw grenade
    this.sprint = this._btn(gp, this._BTN.L3);
    this.pause = this._btnEdge(gp, this._BTN.START);
    this.interact =
      this._btnEdge(gp, this._BTN.B) || this._btnEdge(gp, this._BTN.Y);

    // Update prev for non-edge buttons
    for (let i = 0; i < gp.buttons.length; i++) {
      const isEdge = [
        this._BTN.A,
        this._BTN.X,
        this._BTN.LB,
        this._BTN.START,
        this._BTN.B,
        this._BTN.Y,
      ].includes(i);
      if (!isEdge) {
        this._prevButtons[i] = this._btn(gp, i);
      }
    }
  }
}
