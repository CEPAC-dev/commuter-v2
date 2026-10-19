import type { CreateNotificationPayload } from "./notifications/createNotification";

type ChatNotificationPreset =
  | "arrived"
  | "cant_find_you"
  | "where_are_you"
  | "running_late_2"
  | "running_late_5"
  | "at_pickup"
  | "running_late"
  | "on_my_way";

const DRIVER_PRESET_COPY: Record<
  Extract<
    ChatNotificationPreset,
    "arrived" | "cant_find_you" | "where_are_you" | "running_late_2" | "running_late_5"
  >,
  { title: string; body: string; titleAr: string; bodyAr: string }
> = {
  arrived: {
    title: "Your driver has arrived",
    body: "Driver is at the pickup point.",
    titleAr: "وصل السائق",
    bodyAr: "السائق عند نقطة الركوب.",
  },
  cant_find_you: {
    title: "Your driver needs help",
    body: "Driver can't find you at pickup.",
    titleAr: "السائق بحاجة إلى مساعدتك",
    bodyAr: "لا يستطيع السائق العثور عليك عند نقطة الركوب.",
  },
  where_are_you: {
    title: "Your driver is looking for you",
    body: "Driver is asking where you are.",
    titleAr: "السائق يبحث عنك",
    bodyAr: "يسأل السائق عن مكانك.",
  },
  running_late_2: {
    title: "Your driver is running late",
    body: "Driver expects to be about 2 minutes late.",
    titleAr: "السائق متأخر",
    bodyAr: "يتوقع السائق التأخر نحو دقيقتين.",
  },
  running_late_5: {
    title: "Your driver is running late",
    body: "Driver expects to be about 5 minutes late.",
    titleAr: "السائق متأخر",
    bodyAr: "يتوقع السائق التأخر نحو خمس دقائق.",
  },
};

const PASSENGER_PRESET_COPY: Record<
  Extract<ChatNotificationPreset, "at_pickup" | "running_late" | "on_my_way">,
  { title: (number: string) => string; body: string; titleAr: (number: string) => string; bodyAr: string }
> = {
  at_pickup: {
    title: (number) => `Passenger ${number} is at pickup`,
    body: "Your passenger is at the pickup point.",
    titleAr: (number) => `الراكب ${number} عند نقطة الركوب`,
    bodyAr: "الراكب عند نقطة الركوب.",
  },
  running_late: {
    title: (number) => `Passenger ${number} is running late`,
    body: "Your passenger is running late.",
    titleAr: (number) => `الراكب ${number} متأخر`,
    bodyAr: "الراكب متأخر.",
  },
  on_my_way: {
    title: (number) => `Passenger ${number} is on the way`,
    body: "Your passenger is on the way.",
    titleAr: (number) => `الراكب ${number} في الطريق`,
    bodyAr: "الراكب في الطريق.",
  },
};

export type ChatNotificationPlan = {
  recipientId: string;
  throttleKey: string;
  windowMs: number;
  payload: CreateNotificationPayload;
};

function localizeNumber(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

export function buildChatNotificationPlan(input: {
  senderRole: "user" | "driver";
  recipientId: string;
  tripId: string;
  rideId: string;
  kind: "text" | "preset";
  presetKey?: string;
  passengerNumber: number;
}): ChatNotificationPlan | null {
  let title: string;
  let body: string;
  let titleAr: string;
  let bodyAr: string;
  let throttleKey: string;
  let windowMs: number;

  if (input.kind === "text") {
    const passengerLabel = `Passenger ${input.passengerNumber}`;
    const passengerLabelAr = `الراكب ${localizeNumber(input.passengerNumber)}`;
    const senderLabel = input.senderRole === "driver" ? "Driver" : passengerLabel;
    const senderLabelAr = input.senderRole === "driver" ? "السائق" : passengerLabelAr;
    title = `New message from ${input.senderRole === "driver" ? "your driver" : senderLabel}`;
    titleAr = `رسالة جديدة من ${input.senderRole === "driver" ? "السائق" : senderLabelAr}`;
    body = "You have a new message";
    bodyAr = "لديك رسالة جديدة";
    throttleKey = "free_text";
    windowMs = 2 * 60_000;
  } else if (input.senderRole === "driver") {
    const key = input.presetKey as ChatNotificationPreset | undefined;
    if (
      !key ||
      !["arrived", "cant_find_you", "where_are_you", "running_late_2", "running_late_5"].includes(key)
    ) {
      return null;
    }
    const copy = DRIVER_PRESET_COPY[key as keyof typeof DRIVER_PRESET_COPY];
    title = copy.title;
    body = copy.body;
    titleAr = copy.titleAr;
    bodyAr = copy.bodyAr;
    throttleKey = key;
    windowMs = 5 * 60_000;
  } else {
    const key = input.presetKey as ChatNotificationPreset | undefined;
    if (!key || !["at_pickup", "running_late", "on_my_way"].includes(key)) {
      return null;
    }
    const copy = PASSENGER_PRESET_COPY[key as keyof typeof PASSENGER_PRESET_COPY];
    const number = String(input.passengerNumber);
    title = copy.title(number);
    body = copy.body;
    titleAr = copy.titleAr(localizeNumber(input.passengerNumber));
    bodyAr = copy.bodyAr;
    throttleKey = key;
    windowMs = 5 * 60_000;
  }

  return {
    recipientId: input.recipientId,
    throttleKey,
    windowMs,
    payload: {
      userId: input.recipientId,
      type: "trip_chat_message",
      title,
      body,
      titleAr,
      bodyAr,
      data: {
        tripId: input.tripId,
        rideId: input.rideId,
        linkUrl:
          input.senderRole === "driver"
            ? `/my-trips/${input.tripId}`
            : `/my-trips/${input.rideId}`,
      },
    },
  };
}
