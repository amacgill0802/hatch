import type { Comment } from '../types';

/**
 * The thread as the page draws it: latest word first. The API hands comments
 * back oldest-first, so this is a plain reverse - and a copy, because the
 * caller's array is state somebody else still reads oldest-first.
 */
export const newestFirst = (comments: Comment[]): Comment[] => [...comments].reverse();
