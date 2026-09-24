-- Owner-controlled TV display prefs: tile layout + contrast live on the station
-- so public TV wall displays (/tv/:slug) render the owner's choice instead of
-- whatever the viewing browser last stored in localStorage.
ALTER TABLE stations ADD COLUMN tile_layout TEXT NOT NULL DEFAULT 'dense';
ALTER TABLE stations ADD COLUMN contrast TEXT NOT NULL DEFAULT 'standard';
