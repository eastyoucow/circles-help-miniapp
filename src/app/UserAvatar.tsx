"use client";

type UserAvatarProps = {
  src: string;
  name: string;
  size: number;
  className?: string;
};

export function UserAvatar({ src, name, size, className }: UserAvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      // Strava CDN hosts vary; a plain img avoids next/image remote allowlists.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
