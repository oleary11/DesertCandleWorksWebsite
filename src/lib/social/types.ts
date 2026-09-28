export type SocialKind = "reel" | "slideshow" | "meme";

export type SocialStatus =
  | "generating"
  | "rendering" // claimed by one worker while it merges/renders, so parallel webhooks don't double up
  | "pending_review"
  | "approved"
  | "publishing"
  | "published"
  | "failed"
  | "rejected";

/** One fal.ai queue request belonging to a post. */
export type FalJob = {
  key: string; // what this job produces, e.g. "clip-0", "scene-2", "merge", "meme"
  endpoint: string;
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  status: "pending" | "done" | "failed";
  outputUrl?: string;
  error?: string;
};

export type SlidePlan = {
  source: "photo" | "scene"; // photo = the untouched product photo, scene = AI places the product in a new setting
  photoUrl: string;
  scenePrompt?: string;
  detail?: boolean; // photo already used earlier in the post: show a tighter close-up so slides don't repeat
  nameLabel?: boolean; // collection slide: headline is just the product name, set small
  headline: string;
  body?: string;
};

export type ReelPlan = {
  sourceImages: string[]; // the product photos the admin picked
  startFrames: string[]; // same photos cropped to 9:16
  prompts: string[]; // one motion prompt per clip
  motionNotes?: string;
};

export type SlideshowPlan = { slides: SlidePlan[] };

export type MemePlan = { memePrompt: string };

export type SocialPost = {
  id: string;
  kind: SocialKind;
  status: SocialStatus;
  productSlug: string | null;
  hook: string;
  caption: string;
  hashtags: string[];
  plan: ReelPlan | SlideshowPlan | MemePlan | Record<string, never>;
  jobs: FalJob[];
  slides: string[];
  videoUrl: string | null;
  coverImageUrl: string | null;
  costCents: number;
  queueOrder: number | null;
  error: string | null;
  publishedAt: string | null;
  instagramPostId: string | null;
  tiktokPostId: string | null;
  facebookPostId: string | null;
  createdAt: string;
  updatedAt: string;
};
