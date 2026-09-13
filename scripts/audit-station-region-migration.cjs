/* Read-only migration readiness report. It performs no station mutation. */
const { MongoClient } = require("mongodb");
async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const stations = db.collection("stations");
  const [total, assigned, indexes, duplicateObjectIds] = await Promise.all([
    stations.countDocuments(),
    stations.countDocuments({ regionCode: { $exists: true } }),
    stations.indexes(),
    stations.aggregate([{ $group: { _id: "$objectId", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $count: "count" }]).toArray(),
  ]);
  const hello = await db.admin().command({ hello: 1 });
  console.log(JSON.stringify({ totalStations: total, assignedStations: assigned, unassignedStations: total - assigned, duplicateObjectIds: duplicateObjectIds[0]?.count ?? 0, indexes, transactionCapable: Boolean(hello.setName || hello.msg === "isdbgrid") }, null, 2));
  await client.close();
}
main().catch((error) => { console.error(error); process.exit(1); });
