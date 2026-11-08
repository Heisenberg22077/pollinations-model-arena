import type { ColorMode } from "../hooks/useColorMode";
import { GardenScene } from "./GardenScene";

export function GardenBanner({ colorMode }: { colorMode: ColorMode }) {
  return (
    <div className="garden-banner">
      <p className="garden-caption">
        Curiosity, <span>Multiplied.</span>
      </p>
      <GardenScene colorMode={colorMode} closing />
    </div>
  );
}
