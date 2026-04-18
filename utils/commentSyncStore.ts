import { BASE_URL } from "./api";

/**
 * Global store to hold recursive reply counts.
 * Structure: { [commentId]: totalRecursiveCount }
 */
export const recursiveReplyCounts: Record<string, number> = {};

/**
 * Cache for top-level comments objects to enable instant display.
 * Structure: { [postId]: Comment[] }
 */
export const postCommentsCache: Record<string, any[]> = {};

/**
 * Cache for recursive replies objects to enable instant display.
 * Structure: { [topLevelCommentId]: Reply[] }
 */
export const recursiveRepliesCache: Record<string, any[]> = {};

// ─── Reactive Store Logic (TikTok-Style) ───────────────────────────────────

type SyncEventType = "COUNT" | "POST_COMMENTS" | "REPLIES_DATA" | "POST_STATS_UPDATE";
type SyncListener = (type: SyncEventType, id: string, payload: any) => void;

const listeners = new Set<SyncListener>();

/**
 * Subscribe to changes in the comment sync store.
 * Used by UI components to update reactively when background tasks finish.
 */
export const subscribeToCommentSync = (l: SyncListener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const notifyListeners = (type: SyncEventType, id: string, payload: any) => {
  listeners.forEach((l) => l(type, id, payload));
};

// ───────────────────────────────────────────────────────────────────────────

/**
 * Fetches the entire reply tree for a comment recursively and updates the global store.
 * This can be run in the background (Pre-fetch) to ensure counts and data are instant.
 */
export const syncRecursiveCount = async (postId: string, topLevelId: string, token: string) => {
  try {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const flat: any[] = [];
    let currentLevelNodes: { id: string; authorName?: string }[] = [{ id: topLevelId }];
    const processedIds = new Set<string>();
    processedIds.add(topLevelId);

    while (currentLevelNodes.length > 0) {
      const batchResults = await Promise.all(
        currentLevelNodes.map(async (node) => {
          try {
            const res = await fetch(
              `${BASE_URL}/posts/${postId}/comments?parent_id=${node.id}`,
              { headers: authHeaders }
            );
            return { parentNode: node, result: await res.json(), ok: res.ok };
          } catch (e) {
            return { parentNode: node, ok: false };
          }
        })
      );

      const nextLevelNodes: { id: string; authorName?: string }[] = [];
      for (const { parentNode, result, ok } of batchResults) {
        if (!ok) continue;
        const commentsInBatch = result.data.comments || [];
        for (const c of commentsInBatch) {
          if (processedIds.has(c._id)) continue;
          processedIds.add(c._id);
          
          const normalizedCmt = { ...c, createdAt: c.createdAt || c.created_at };
          
          if (normalizedCmt._id !== topLevelId) {
            const badge = parentNode.id !== topLevelId ? parentNode.authorName : undefined;
            flat.push({ ...normalizedCmt, parentAuthorName: badge });
          }

          if (normalizedCmt.replies_count > 0) {
            nextLevelNodes.push({ id: normalizedCmt._id, authorName: normalizedCmt.author?.nama });
          }
        }
      }
      currentLevelNodes = nextLevelNodes;
    }

    flat.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Update the global store
    recursiveReplyCounts[topLevelId] = flat.length;
    recursiveRepliesCache[topLevelId] = flat;

    // BROADCAST: Let all components know that data for this comment thread is ready
    notifyListeners("COUNT", topLevelId, flat.length);
    notifyListeners("REPLIES_DATA", topLevelId, flat);
    
    return flat.length;
  } catch (err) {
    console.error("syncRecursiveCount error:", err);
    return 0;
  }
};

/**
 * Public function to notify that post comments have been fetched/cached.
 */
export const notifyPostCommentsUpdated = (postId: string, comments: any[]) => {
  postCommentsCache[postId] = comments;
  notifyListeners("POST_COMMENTS", postId, comments);
};
/**
 * Broadcasts an update to post statistics (commentsCount, likesCount, etc.)
 */
export const broadcastPostStatsUpdate = (postId: string, stats: { 
  comments_count?: number; 
  likes_count?: number; 
  reposts_count?: number;
  shares_count?: number;
}) => {
  notifyListeners("POST_STATS_UPDATE", postId, stats);
};
