/** "Cardio › Treadmills › Domestic Treadmill" from a category list (admin API). */
export function categoryLabel(category, bySlug) {
  return (category.path || [category.slug]).map((slug) => bySlug.get(slug)?.name || slug).join(" › ");
}

export const bySlugOf = (categories = []) => new Map(categories.map((c) => [c.slug, c]));
