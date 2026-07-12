package webhook

import (
	"context"
	"log"
)

// LoggingDispatcher is a Phase 0 stand-in for a real GitHub API client.
// PHASE 1 TODO for OpenHands: implement a real Dispatcher that POSTs to
// https://api.github.com/repos/{githubRepo}/dispatches with event_type
// "besbpo-content-update" and a bearer token sourced from Coolify env vars
// (see besbpo-blog-architecture ADRs and Doc-04 Section 5).
type LoggingDispatcher struct{}

func NewLoggingDispatcher() *LoggingDispatcher {
	return &LoggingDispatcher{}
}

func (d *LoggingDispatcher) Dispatch(_ context.Context, githubRepo string, articleID string) error {
	log.Printf("[stub] would POST repository_dispatch to %s for article %s", githubRepo, articleID)
	return nil
}
