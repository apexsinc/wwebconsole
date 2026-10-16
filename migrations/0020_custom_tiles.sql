-- Custom tile configurations per station: JSON map of tile keys to metric selections
ALTER TABLE stations ADD COLUMN custom_tiles TEXT;
