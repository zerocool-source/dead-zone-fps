// AEON runs entirely client-side (the whole simulation lives in the browser
// bundle). This rules module satisfies the game platform's package contract.
export const meta = {
  name: "AEON: God of Pangaea",
  minPlayers: 1,
  maxPlayers: 1,
  description: "Client-side living-world god game.",
};
export function setup() { return { started: true }; }
export function validateAction() { return true; }
export function applyAction(state) { return state; }
export function isGameOver() { return false; }
export function viewFor(state) { return state; }
