-- Delete scores associated with stale criteria
delete from scores where criterion_id not in (
  select id from criteria where name in (
    'Innovation',
    'Technical Implementation',
    'Functionality',
    'Problem Relevance',
    'Creativity',
    'Demo & Explanation',
    'Overall Impact'
  )
);

-- Delete non-matching criteria
delete from criteria where name not in (
  'Innovation',
  'Technical Implementation',
  'Functionality',
  'Problem Relevance',
  'Creativity',
  'Demo & Explanation',
  'Overall Impact'
);

-- Re-enforce the 7 criteria with their exact weights
insert into criteria (name, weight, position)
values
  ('Innovation', 20.00, 1),
  ('Technical Implementation', 25.00, 2),
  ('Functionality', 20.00, 3),
  ('Problem Relevance', 15.00, 4),
  ('Creativity', 10.00, 5),
  ('Demo & Explanation', 5.00, 6),
  ('Overall Impact', 5.00, 7)
on conflict (name) do update set weight = excluded.weight, position = excluded.position;
