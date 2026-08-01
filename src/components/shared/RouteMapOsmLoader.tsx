"use client";

import dynamic from "next/dynamic";

const RouteMapOsm = dynamic(() => import("./RouteMapOsm"), { ssr: false });

export default RouteMapOsm;
