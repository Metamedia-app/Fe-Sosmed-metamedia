import { BASE_URL } from "./api";

/**
 * Utility to get a clean, valid avatar URL.
 * Handles:
 * 1. Full URLs (https://...)
 * 2. Relative paths (uploads/avatars/...)
 * 3. Fallback to iran.liara.run with properly encoded names.
 */
export const getAvatarUrl = (
  author?: { avatar_url?: string; avatar?: string; nama?: string; name?: string },
  isPostAuthor: boolean = true
): string => {
  const name = author?.nama || author?.name || "User";
  const avatarUrl = author?.avatar_url;
  const avatar = author?.avatar;

  // 1. If we have a full URL, use it
  if (avatarUrl && avatarUrl.startsWith("http")) {
    return avatarUrl;
  }

  // 2. If we have a relative path in avatar_url or avatar
  const path = avatarUrl || avatar;
  if (path && path.length > 0 && path !== "string") {
    // If it's just a filename or relative path
    if (!path.startsWith("http")) {
      // Stripping /api/v1 from BASE_URL to get the root server URL
      const rootUrl = BASE_URL.replace("/api/v1", "");
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `${rootUrl}${cleanPath}`;
    }
    return path;
  }

  // 3. Fallback to a clean Instagram-style silhouette
  // Using a reliable CDN URL as Data URIs can be inconsistent on some native mobile environments
  // This "Mystery Person" silhouette is standard and works perfectly on all platforms.
  const DEFAULT_AVATAR = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
  
  return DEFAULT_AVATAR;
};
