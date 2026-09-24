import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getPostById } from "@/lib/data/posts";
import { getCommentsForPost } from "@/lib/data/comments";
import { PostCard } from "@/components/post/post-card";
import { CommentComposer } from "@/components/post/comment-composer";
import { CommentList } from "@/components/post/comment-list";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await verifySession();

  const post = await getPostById(id, session?.userId);
  if (!post) notFound();

  const comments = await getCommentsForPost(id);

  return (
    <div>
      <PostCard post={post} isAuthenticated={Boolean(session)} isDetail viewerId={session?.userId} />
      {session && (
        <CommentComposer postId={post.id} displayName={session.displayName ?? "You"} avatarUrl={session.avatarUrl} />
      )}
      <CommentList comments={comments} postId={post.id} viewerId={session?.userId} />
    </div>
  );
}
