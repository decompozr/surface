import { join, resolve } from 'node:path';

export const commentEvent = (requestId: string, comments: StoredComment[], directory: string, projectRoot: string): CommentEvent => {
  const defaultDirectory = join(projectRoot, '.decompozr/surface/comments-preview');
  return {
    type: 'surface.comments', requestId,
    ...(resolve(directory) === resolve(defaultDirectory) ? {} : { replyTo: resolve(directory) }),
    comments: comments.map(comment => ({ selector: comment.target.selector, text: comment.text,
      ...(comment.capture ? { imagePath: comment.capture.imagePath } : {}) })),
  };
};


/** Agent input only; transport intent and complete source context stay in the store. */
export type CommentEvent = {
  type: 'surface.comments';
  requestId: string;
  replyTo?: string;
  comments: { selector: string; text: string; imagePath?: string }[];
};
export type StoredComment = { target: { selector: string }; text: string; capture?: { imagePath: string } };
