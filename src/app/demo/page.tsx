import type { Metadata } from "next";
import DemoExperience from "./DemoExperience";

export const metadata: Metadata = {
  title: "Commuter | Abu Dhabi concept demo",
  description:
    "A concept demonstration of Commuter's ride-booking experience for Abu Dhabi.",
};

export default function DemoPage() {
  return <DemoExperience />;
}
