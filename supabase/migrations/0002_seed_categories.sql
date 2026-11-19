-- NBJCreative Hub: seed the initial public product categories.
-- Safe to run more than once; existing categories with these slugs are updated.

insert into public.categories (name, slug, description, sort_order, is_active)
values
  ('Business', 'business', 'Business plans, finance tools and practical templates.', 1, true),
  ('Design & Creative', 'design-creative', 'Brand kits, graphics and presentation assets.', 2, true),
  ('Technology', 'technology', 'Code, website templates and developer resources.', 3, true),
  ('Education', 'education', 'Guides, workbooks and learning resources.', 4, true),
  ('Career', 'career', 'CVs, portfolios and interview resources.', 5, true),
  ('Lifestyle', 'lifestyle', 'Planners, journals and everyday trackers.', 6, true),
  ('Media & Assets', 'media-assets', 'Photos, video, audio and digital art.', 7, true),
  ('Faith', 'faith', 'Devotionals, journals and ministry resources.', 8, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;
