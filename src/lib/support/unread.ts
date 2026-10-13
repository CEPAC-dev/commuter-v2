import { Types } from "mongoose";
import { SupportMessage } from "@/models/SupportMessage";

type SupportConversationReadState = {
  _id: Types.ObjectId;
  customerLastReadAt?: Date | null;
  adminLastReadAt?: Date | null;
};

export async function getUnreadMessageCounts(
  conversations: SupportConversationReadState[],
  reader: "customer" | "admin",
) {
  const counts = new Map<string, number>();
  if (!conversations.length) return counts;

  const conversationIds = conversations.map(({ _id }) => _id);
  const incomingRoles = reader === "customer" ? ["admin"] : ["customer"];
  const readAtField =
    reader === "customer" ? "customerLastReadAt" : "adminLastReadAt";

  const results = await SupportMessage.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        conversationId: { $in: conversationIds },
        senderRole: { $in: incomingRoles },
      },
    },
    {
      $lookup: {
        from: "supportconversations",
        localField: "conversationId",
        foreignField: "_id",
        as: "conversation",
      },
    },
    { $unwind: "$conversation" },
    {
      $match: {
        $expr: {
          $gt: [
            "$createdAt",
            { $ifNull: [`$conversation.${readAtField}`, new Date(0)] },
          ],
        },
      },
    },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);

  for (const result of results) {
    counts.set(String(result._id), result.count);
  }
  return counts;
}
