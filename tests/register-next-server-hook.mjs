import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "next/server" ? "next/server.js" : specifier,
      context,
    );
  },
});