import Image from "next/image";

export type MascotPose =
  | "idle"
  | "napping"
  | "writing"
  | "reading"
  | "researching"
  | "reviewing"
  | "apologetic"
  | "swiping"
  | "carrying"
  | "graveyard"
  | "shy";

const ALT_TEXT: Record<MascotPose, string> = {
  idle: "A cat sitting calmly",
  napping: "A cat curled up asleep",
  writing: "A cat writing at a desk",
  reading: "A cat reading a document wearing glasses",
  researching: "A cat looking through a spyglass",
  reviewing: "A cat thinking with a paw on its chin",
  apologetic: "A cat looking sheepish, with a speech bubble",
  swiping: "A cat swiping something away",
  carrying: "A cat carrying a bag of books",
  graveyard: "Three cats sleeping in a pile on a cushion",
  shy: "A cat blushing shyly with a paw over its mouth",
};

export function Mascot({
  pose,
  size = 48,
  className,
  priority = false,
}: {
  pose: MascotPose;
  size?: number;
  className?: string;
  /** Marks this instance as above-the-fold (e.g. the persistent companion),
   * skipping lazy-load so it doesn't get flagged as a slow LCP image. */
  priority?: boolean;
}) {
  return (
    <Image
      src={`/mascot/${pose}.png`}
      alt={ALT_TEXT[pose]}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      priority={priority}
    />
  );
}
