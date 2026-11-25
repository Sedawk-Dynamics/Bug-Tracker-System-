-- A counter that moves on every item change, so open pages can ask cheaply whether anything is new.
CREATE TABLE IF NOT EXISTS revision (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL);
INSERT OR IGNORE INTO revision (id, value) VALUES (1, 0);
CREATE TRIGGER IF NOT EXISTS updates_added AFTER INSERT ON updates BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS updates_changed AFTER UPDATE ON updates BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS updates_removed AFTER DELETE ON updates BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS custom_added AFTER INSERT ON custom_items BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS custom_changed AFTER UPDATE ON custom_items BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS custom_removed AFTER DELETE ON custom_items BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS deleted_added AFTER INSERT ON deleted_items BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS deleted_changed AFTER UPDATE ON deleted_items BEGIN UPDATE revision SET value = value + 1; END;
CREATE TRIGGER IF NOT EXISTS deleted_removed AFTER DELETE ON deleted_items BEGIN UPDATE revision SET value = value + 1; END;
