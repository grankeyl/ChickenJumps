import { Assets } from "pixi.js";

export const FONT_FAMILY = "Golos Text";

export async function loadFonts() {
  // Загружаем нужные веса шрифта
  await Promise.all([
    Assets.load({
      alias: "GolosText-Regular",
      src: "/assets/fonts/Golos_Text/GolosText-Regular.ttf",
      data: { family: FONT_FAMILY, weight: "400" }
    }),
    Assets.load({
      alias: "GolosText-Medium",
      src: "/assets/fonts/Golos_Text/GolosText-Medium.ttf",
      data: { family: FONT_FAMILY, weight: "500" }
    }),
    Assets.load({
      alias: "GolosText-SemiBold",
      src: "/assets/fonts/Golos_Text/GolosText-SemiBold.ttf",
      data: { family: FONT_FAMILY, weight: "600" }
    }),
    Assets.load({
      alias: "GolosText-Bold",
      src: "/assets/fonts/Golos_Text/GolosText-Bold.ttf",
      data: { family: FONT_FAMILY, weight: "700" }
    }),
    Assets.load({
      alias: "GolosText-ExtraBold",
      src: "/assets/fonts/Golos_Text/GolosText-ExtraBold.ttf",
      data: { family: FONT_FAMILY, weight: "800" }
    }),
  ]);
}
