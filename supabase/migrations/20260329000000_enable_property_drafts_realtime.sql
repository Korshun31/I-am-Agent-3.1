-- Enable realtime publication for property_drafts.
-- Required for mobile admin subscription (postgres_changes on property_drafts)
-- to receive events when agents submit or update drafts.
-- Without this, the targeted channel in PropertyDetailScreen silently receives nothing.
ALTER PUBLICATION supabase_realtime ADD TABLE property_drafts;
