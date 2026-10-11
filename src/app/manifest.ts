import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Commuter",
    short_name: "Commuter",
    description: "Book private and shared rides across Greater Cairo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B1E3D",
    icons: [
      {
        src: "/assets/images/commuterLogo2.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
