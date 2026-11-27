// Everything that ties the app to Galayn's own setup lives here.

export type AreaId = "brain" | "eyes" | "hands" | "heart" | "muscles" | "feet";

const N = "https://www.notion.so/";

export const AREAS: Record<AreaId, { name: string; sub: string; link: string; linkName: string; label: string }> = {
  brain: { name: "Brain", sub: "Knowledge, notes, ideas", link: N + "41b87417e3fa819aa673ebbd2296883f", linkName: "Ideas", label: "brain" },
  eyes: { name: "Eyes", sub: "What you watch and read", link: N + "41b87417e3fa816ba5f5dccf9a856c8d", linkName: "03 Reference", label: "eyes" },
  hands: { name: "Hands", sub: "Projects and work", link: N + "41b87417e3fa8108b49aee30904d38f5", linkName: "02 Projects", label: "hands" },
  heart: { name: "Heart", sub: "People and follow-ups", link: N + "41b87417e3fa81229546c001ad1e3a52", linkName: "Contacts", label: "heart" },
  muscles: { name: "Muscles", sub: "Gym tracking", link: N + "42387417e3fa81d79a61cdbf3d3fadaf", linkName: "Workout log", label: "muscles" },
  feet: { name: "Feet", sub: "Admin: documents and vehicles", link: N + "41b87417e3fa81aebe5ae8e4b9245278", linkName: "Expiry Dates", label: "feet" },
};
export const AREA_ORDER: AreaId[] = ["brain", "eyes", "hands", "heart", "muscles", "feet"];

// A Todoist task lands on a body part by label first (@heart, @feet ...),
// then by project name, then falls back to Brain (the Inbox).
export const PROJECT_AREA: { match: RegExp; area: AreaId }[] = [
  { match: /binnenland|brokopondo|documentaire|sprint|suri|tru tori|gvg|halliburton/i, area: "hands" },
  { match: /huishouden|admin|auto|vehicle/i, area: "feet" },
  { match: /gym|workout/i, area: "muscles" },
];

// Notion data sources (API version 2025-09-03 uses data source ids).
export const NOTION = {
  workoutLog: "42387417-e3fa-81b8-8f39-000bb9c9fedf",
  progressPhotos: "42387417-e3fa-81bf-84fc-000bfe9a30d1",
  checkins: "42487417-e3fa-813a-be48-000b9e2ee65d",
  expiryDates: "41b87417-e3fa-8189-bce3-000b645fbcd6",
  // GVG Brain root and its shelves. Open to-dos anywhere under a shelf light up that shelf's body part.
  root: "41b87417e3fa81089cf0e24dbdd86b60",
  shelves: {
    "41b87417e3fa81aa8d42d51fdde710f1": { name: "00 Inbox", area: "brain" as AreaId },
    "41b87417e3fa81b3bc4fcfaff501eb3c": { name: "01 Admin", area: "feet" as AreaId },
    "41b87417e3fa8108b49aee30904d38f5": { name: "02 Projects", area: "hands" as AreaId },
    "41b87417e3fa816ba5f5dccf9a856c8d": { name: "03 Reference", area: "eyes" as AreaId },
    "41b87417e3fa81a686d9f64a3867e9e0": { name: "04 Archive", area: null },
    "41b87417e3fa815bbd3ceee600aa3089": { name: "05 Me", area: "brain" as AreaId },
    "42187417e3fa81068fb7d894ef93978a": { name: "06 Family", area: "heart" as AreaId },
  } as Record<string, { name: string; area: AreaId | null }>,
  // Pages whose quietness makes a body part glow.
  watchPages: [
    { id: "41b87417e3fa819aa673ebbd2296883f", name: "Ideas", area: "brain" as AreaId, quietDays: 28 },
    { id: "41b87417e3fa819786dce715110c77e6", name: "SuriRides", area: "hands" as AreaId, quietDays: 21 },
    { id: "41b87417e3fa812ba936e5d525b59fb1", name: "Tru Tori", area: "hands" as AreaId, quietDays: 21 },
    { id: "41b87417e3fa81229546c001ad1e3a52", name: "Contacts", area: "heart" as AreaId, quietDays: 30 },
  ],
};

// From 05 Me > Weekschema. Weekday numbers: 0 = Sunday.
export const WEEK = {
  gymDays: [3, 5, 6, 0],
  motorDays: [1, 2, 4],
  workUntil: "17:00",
};

export const TIMEZONE = "America/Paramaribo";
