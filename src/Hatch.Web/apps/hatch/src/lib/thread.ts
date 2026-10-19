import type { Comment } from '../types';

/**
 * The thread as the page draws it: latest word first. The API hands comments
 * back oldest-first, so this is a plain reverse - and a copy, because the
 * caller's array is state somebody else still reads oldest-first.
 */
export const newestFirst = (comments: Comment[]): Comment[] => [...comments].reverse();

/**
 * What the "newest first" glyph on a section title says, to a screen reader
 * and on hover. Written here, beside the reversal it describes, so the wording
 * is pinned once rather than at each of the four titles that carry the glyph.
 */
export const NEWEST_FIRST_LABEL = 'newest first';
export const NEWEST_FIRST_TITLE = 'Newest first';
