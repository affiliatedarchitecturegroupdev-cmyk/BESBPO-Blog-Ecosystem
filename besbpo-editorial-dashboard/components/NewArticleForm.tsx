'use client';

import { useState, useTransition, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createArticleAction } from '../app/articles/actions.ts';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function NewArticleForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [divisionTagsInput, setDivisionTagsInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !slug.trim()) {
      setError('Title and slug are both required.');
      return;
    }

    startTransition(async () => {
      const result = await createArticleAction({
        title,
        slug,
        divisionTags: divisionTagsInput
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
      });
      if (result.ok && result.article) {
        router.push(`/articles/${result.article.id}`);
      } else {
        setError(result.error ?? 'Failed to create article');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="new-article-form">
      {error && <p className="article-editor__message article-editor__message--error">{error}</p>}

      <label className="article-editor__field">
        Title
        <input type="text" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => handleTitleChange(e.target.value)} required />
      </label>

      <label className="article-editor__field">
        Slug
        <input
          type="text"
          value={slug}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setSlug(e.target.value);
            setSlugManuallyEdited(true);
          }}
          required
        />
      </label>

      <label className="article-editor__field">
        Division tags (comma-separated)
        <input type="text" value={divisionTagsInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setDivisionTagsInput(e.target.value)} />
      </label>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create draft'}
      </button>
    </form>
  );
}
