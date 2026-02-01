import { Game } from "./Game";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

const game = new Game(root);

(async () => {
  try {
    await game.start();
  } catch (e) {
    console.error(e);
    alert(String(e));
  }
})();