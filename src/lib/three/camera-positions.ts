import type { TechnicalView } from "../constants";

interface CameraPosition {
  position: [number, number, number];
  target: [number, number, number];
  label: string;
}

export const CAMERA_POSITIONS: Record<TechnicalView, CameraPosition> = {
  front: {
    position: [0, 0, 3],
    target: [0, 0, 0],
    label: "Front",
  },
  back: {
    position: [0, 0, -3],
    target: [0, 0, 0],
    label: "Back",
  },
  left: {
    position: [-3, 0, 0],
    target: [0, 0, 0],
    label: "Left (Medial)",
  },
  right: {
    position: [3, 0, 0],
    target: [0, 0, 0],
    label: "Right (Lateral)",
  },
  top: {
    position: [0, 3, 0],
    target: [0, 0, 0],
    label: "Top",
  },
  bottom: {
    position: [0, -3, 0],
    target: [0, 0, 0],
    label: "Bottom",
  },
  three_quarter: {
    position: [2, 1.5, 2],
    target: [0, 0, 0],
    label: "3/4 View",
  },
};
