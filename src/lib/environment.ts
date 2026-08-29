export const isProduction = process.env.NODE_ENV === "production";

export function getMongoUri(): string {
  const uri = isProduction
    ? process.env.PROD_MONGODB_URI ?? process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  return uri;
}

export function getDbName(): string | undefined {
  return isProduction ? process.env.PROD_DB_NAME ?? process.env.DB_NAME : process.env.DB_NAME;
}
