package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/retry"
)

// dispatchEventType is the event_type subsidiary sites' GitHub Actions
// workflows listen for — matches besbpo-subsidiary-site-template's
// .github/workflows/rebuild.yml (`types: [besbpo-content-update]`).
const dispatchEventType = "besbpo-content-update"

// GitHubDispatcher implements Dispatcher against the real GitHub REST API
// (POST /repos/{owner}/{repo}/dispatches), replacing LoggingDispatcher
// (dispatcher_stub.go) for anything beyond local development/tests.
//
// AUTH NOTE: token should be a fine-grained GitHub Personal Access Token
// (or a GitHub App installation token) scoped ONLY to the `contents: write`
// and `actions: write` permissions on the specific subsidiary-site repos
// this service needs to dispatch to — per Doc-04 Section 5's secrets
// management guidance. It's read from Coolify env vars in main.go, never
// hardcoded.
//
// Closes the retry/backoff gap flagged alongside webhooks.service.ts's
// equivalent TODO on the NestJS side: transient failures (network blips, a
// 502 while GitHub has a bad moment) are retried up to 3 times with
// exponential backoff via internal/retry (unit-tested there in isolation).
// A 4xx is NOT retried — a bad token or an unknown repo won't fix itself
// by trying again (see isRetryableDispatchError below).
type GitHubDispatcher struct {
	token      string
	httpClient *http.Client
	apiBaseURL string // overridable for tests; defaults to https://api.github.com
}

func NewGitHubDispatcher(token string) *GitHubDispatcher {
	return &GitHubDispatcher{
		token:      token,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		apiBaseURL: "https://api.github.com",
	}
}

type dispatchPayload struct {
	EventType     string            `json:"event_type"`
	ClientPayload map[string]string `json:"client_payload"`
}

// httpStatusError carries the HTTP status code from a failed dispatch
// attempt, so isRetryableDispatchError can make a status-aware decision
// without string-parsing an error message.
type httpStatusError struct {
	statusCode int
	repo       string
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("GitHub dispatches API returned %d for %s", e.statusCode, e.repo)
}

// isRetryableDispatchError retries network-level failures (no HTTP
// response at all — err is not an *httpStatusError) and 5xx responses;
// does not retry 4xx (bad token, unknown repo, malformed request — a
// retry can't fix any of those).
func isRetryableDispatchError(err error) bool {
	var httpErr *httpStatusError
	if errors.As(err, &httpErr) {
		return httpErr.statusCode >= 500
	}
	return true
}

// Dispatch implements the webhook.Dispatcher interface (handler.go). Per
// Doc-02 Section 7, `githubRepo` is expected in "owner/repo" form (matching
// the `github_repo` column in besbpo-blog-architecture/db/schema.sql, e.g.
// "besbpo-group/bae-site").
func (d *GitHubDispatcher) Dispatch(ctx context.Context, githubRepo string, articleID string) error {
	return retry.Do(ctx, retry.Options{
		MaxAttempts: 3,
		BaseDelay:   300 * time.Millisecond,
		IsRetryable: isRetryableDispatchError,
	}, func() error {
		return d.attemptDispatch(ctx, githubRepo, articleID)
	})
}

func (d *GitHubDispatcher) attemptDispatch(ctx context.Context, githubRepo string, articleID string) error {
	body := dispatchPayload{
		EventType:     dispatchEventType,
		ClientPayload: map[string]string{"article_id": articleID},
	}
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("encoding dispatch payload: %w", err)
	}

	reqURL := fmt.Sprintf("%s/repos/%s/dispatches", d.apiBaseURL, githubRepo)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyJSON))
	if err != nil {
		return fmt.Errorf("building GitHub dispatch request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+d.token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")

	res, err := d.httpClient.Do(req)
	if err != nil {
		// Network-level failure (DNS, connection refused, timeout) — no
		// httpStatusError wrapping here, so isRetryableDispatchError's
		// errors.As check falls through to "true" (retryable).
		return fmt.Errorf("calling GitHub dispatches API for %s: %w", githubRepo, err)
	}
	defer res.Body.Close()

	// GitHub returns 204 No Content on a successful dispatch.
	if res.StatusCode != http.StatusNoContent {
		return &httpStatusError{statusCode: res.StatusCode, repo: githubRepo}
	}
	return nil
}
